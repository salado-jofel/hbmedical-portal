import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Inbound-fax webhook — provider-dispatched.
 *
 * Runtime picks the handler off `FAX_PROVIDER` env:
 *   - "documo"  (legacy, still supported)
 *   - "ifax"    (2026-09-16 — client is migrating off Documo's $200/mo
 *                minimum onto iFax's $35/mo tier with equivalent HIPAA
 *                BAA + webhook + API-key features).
 *
 * Both providers land in the same downstream flow: verify Basic Auth,
 * upload PDF to Supabase Storage, insert intake_documents row so the
 * fax appears on /dashboard/intake for staff triage. The differences
 * are entirely in transport:
 *
 *   Documo → JSON POST + we pull PDF via their REST API using messageId
 *   iFax   → JSON POST + we pull PDF via their REST API using jobId +
 *            transactionId (endpoint returns base64-encoded bytes).
 *            iFax's docs suggested multipart at one point but the live
 *            webhook actually posts application/json — verified against
 *            a real inbound fax 2026-09-16.
 *
 * Environment variables:
 *   FAX_PROVIDER                   documo | ifax  (default: documo)
 *   SUPABASE_BUCKET                Storage bucket; defaults to the HIPAA one.
 *
 *   Documo path:
 *     DOCUMO_WEBHOOK_USERNAME      Basic Auth username Documo sends.
 *     DOCUMO_WEBHOOK_PASSWORD      matching password.
 *     DOCUMO_API_KEY               API key used to pull the PDF bytes.
 *
 *   iFax path:
 *     IFAX_WEBHOOK_BASIC_USERNAME  Basic Auth username configured on
 *                                  iFax's webhook settings.
 *     IFAX_WEBHOOK_BASIC_PASSWORD  matching password.
 *     IFAX_API_KEY                 API key used to pull the PDF bytes
 *                                  via POST /v1/customer/inbound/fax-download
 *                                  (sent as `accessToken` header).
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "hbmedical-bucket-private";

/** Return a shape sketch of an unknown JSON value: keys and their types,
 *  drilling one level down into nested objects. NO scalar values are
 *  emitted — safe to log for debugging Documo's actual webhook shape
 *  without leaking any PHI that might be in a field like patient_name.
 */
function describeShape(v: unknown, depth = 0): unknown {
  if (v === null) return "null";
  if (Array.isArray(v)) {
    return `array(${v.length})${v.length > 0 && depth < 2 ? ":" + JSON.stringify(describeShape(v[0], depth + 1)) : ""}`;
  }
  if (typeof v === "object") {
    if (depth > 2) return "object{...}";
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = describeShape(val, depth + 1);
    }
    return out;
  }
  return typeof v;
}

interface DocumoFaxPayload {
  /** Documo's identifier for this fax — used both as our idempotency
   *  key and as the ID to fetch the PDF from their REST API. */
  faxId: string;
  fromNumber: string | null;
  toNumber: string | null;
  pageCount: number | null;
  receivedAt: string | null;
  fileName: string | null;
  /** True when the fax completed successfully AND the PDF is still
   *  fetchable from Documo (not purged). Failed/purged events get
   *  ACK'd with a 200 + no-op. */
  succeeded: boolean;
}

/**
 * Extract the fields we need from Documo's inbound-fax webhook body.
 *
 * Documo's actual field names (verified 2026-07-31 via shape log):
 *   messageId       - the fax id (also used to fetch the PDF)
 *   faxNumber       - the SENDER's fax number (our "from")
 *   pagesCount      - total pages
 *   pagesComplete   - pages actually received
 *   status          - text status
 *   resultCode      - "0" / short code on success
 *   errorCode       - "0" / empty on success
 *   isFilePurged    - true when the PDF is no longer available
 *   createdAt       - ISO string, when the fax arrived
 *
 * Documo does NOT include a fileUrl in the webhook payload — the PDF
 * must be fetched from their REST API using messageId + an API key.
 * (See fetchDocumoFax below.)
 */
function parseDocumoPayload(body: unknown): DocumoFaxPayload | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;

  // Documo may or may not wrap the fax in a `data` envelope depending
  // on account tier. Try flat first, then a couple common wrappers.
  const candidates: Array<Record<string, unknown>> = [root];
  for (const key of ["data", "fax", "payload", "message", "body"]) {
    const val = root[key];
    if (val && typeof val === "object") {
      candidates.push(val as Record<string, unknown>);
      const inner = (val as Record<string, unknown>)["fax"];
      if (inner && typeof inner === "object") {
        candidates.push(inner as Record<string, unknown>);
      }
      const innerData = (val as Record<string, unknown>)["data"];
      if (innerData && typeof innerData === "object") {
        candidates.push(innerData as Record<string, unknown>);
      }
    }
  }

  // Look for messageId (Documo's real name) plus the historical guesses.
  let b: Record<string, unknown> | null = null;
  for (const c of candidates) {
    if (c && (c.messageId ?? c.faxId ?? c.fax_id ?? c.id)) {
      b = c;
      break;
    }
  }
  if (!b) return null;

  const faxId = (b.messageId ?? b.faxId ?? b.fax_id ?? b.id) as
    | string
    | undefined;
  if (!faxId) return null;

  // Success determination — Documo's `errorCode` is "0" or empty on
  // success; `isFilePurged` means the PDF is no longer downloadable.
  // Also fall back to string status when errorCode isn't present.
  const errorCode = String(b.errorCode ?? "").trim();
  const rawStatus = String(b.status ?? b.state ?? b.result ?? "").trim();
  const isFilePurged = Boolean(b.isFilePurged);
  const errorClean =
    errorCode === "" || errorCode === "0" || errorCode === "OK";
  const statusClean =
    rawStatus === "" ||
    /^(success|succeed|succeeded|complete|ok|received)/i.test(rawStatus);
  const succeeded = !isFilePurged && errorClean && statusClean;

  // For inbound, `faxNumber` is OUR own receiving line, not the
  // sender. The sender identity lives in `faxCsid` or `faxCallerId`
  // — verified against Documo's own notification email which labels
  // them "To: <our number>" and "Sender CSID: <sender number>".
  //
  // `??` only falls through on null/undefined, so an empty-string
  // faxCallerId (common when caller ID isn't transmitted) would
  // pin fromNumber to "" instead of falling back to faxCsid. This
  // helper treats null / undefined / empty-string / whitespace-only
  // as "no value" so the fallback chain actually works.
  //
  // Extra safety: also skip any candidate that MATCHES the receiver
  // number (faxNumber) — some Documo tenants echo our own number
  // into faxCallerId, which would show us as our own sender.
  const pick = (
    candidates: Array<unknown>,
    exclude?: string | null,
  ): string | null => {
    for (const c of candidates) {
      if (c == null) continue;
      const s = String(c).trim();
      if (!s) continue;
      if (exclude && s === exclude) continue;
      return s;
    }
    return null;
  };

  const toNumber = pick([
    b.faxNumber,
    b.faxReceiverCsid,
    b.toNumber,
    b.to_number,
    b.to,
  ]);
  const fromNumber = pick(
    [b.faxCallerId, b.faxCsid, b.fromNumber, b.from_number, b.from],
    toNumber, // don't let our own receiver number show up as sender
  );

  // Debug logging (WITH sender-identity fields ONLY; no PHI/message
  // bodies) so a future misroute can be diagnosed in one push. The
  // shape-log fired only on parse failure; this one fires on parse
  // success so we can see the resolved from/to for real faxes.
  console.info("[intake.inbound-fax] Parsed sender identity", {
    faxId,
    fromNumber,
    toNumber,
    raw_faxNumber: b.faxNumber,
    raw_faxCsid: b.faxCsid,
    raw_faxCallerId: b.faxCallerId,
    raw_faxReceiverCsid: b.faxReceiverCsid,
  });

  return {
    faxId,
    fromNumber,
    toNumber,
    pageCount:
      typeof b.pagesCount === "number"
        ? (b.pagesCount as number)
        : typeof b.pageCount === "number"
          ? (b.pageCount as number)
          : typeof b.page_count === "number"
            ? (b.page_count as number)
            : null,
    receivedAt:
      ((b.createdAt ??
        b.resolvedDate ??
        b.receivedAt ??
        b.received_at ??
        b.date) as string | null | undefined) ?? null,
    fileName:
      ((b.fileName ?? b.file_name) as string | null | undefined) ?? null,
    succeeded,
  };
}

/**
 * Fetch the fax PDF from Documo's REST API. Documo doesn't push the
 * bytes via webhook — we have to pull them ourselves using the
 * messageId. Endpoint is authenticated with an API key from the
 * Documo dashboard (Account Details → API Keys).
 *
 * Documo's file-download endpoint has moved a couple times in their
 * v1 API. We try a small list of known-good paths in order and use
 * whichever returns a 2xx first.
 */
async function fetchDocumoFax(
  faxId: string,
  apiKey: string,
): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string }
  | {
      ok: false;
      status: number;
      attempts: Array<{ url: string; status: number; snippet?: string }>;
    }
> {
  const attempts: Array<{ url: string; status: number; snippet?: string }> = [];

  // Canonical Documo Download Fax URL (verified from published docs
  // 2026-07-31):
  //
  //   GET https://api.documo.com/v1/fax/:messageId/download?format=pdf
  //   Authorization: Basic <API_KEY>       (raw key, non-standard Basic
  //                                         scheme — no base64, no colon)
  //
  // Note: `fax` is SINGULAR here, unlike `/v1/faxes` on Send Fax. Yes,
  // that's inconsistent, and yes, I burned an hour on it. The kept
  // fallbacks below cover the small chance Documo's docs are stale and
  // the plural form works for some tenants; the snippet log will
  // reveal the truth if the canonical URL 404s.
  const canonical = `https://api.documo.com/v1/fax/${faxId}/download?format=pdf`;
  const candidates = [
    canonical,
    // Fallbacks — keep tight; snippet-log will guide further changes
    `https://api.documo.com/v1/faxes/${faxId}/download?format=pdf`,
    `https://api.documo.com/v1/fax/${faxId}`,
  ];

  // Documo's docs write `Authorization: Basic API_KEY` — ambiguous about
  // whether API_KEY is the raw value or a placeholder for the standard
  // base64(user:pass) form. Try the raw form first (matches literal
  // docs example), then base64(apiKey:) as fallback (standard Basic).
  const authRaw = `Basic ${apiKey}`;
  const authBase64 = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  for (const url of candidates) {
    for (const authHeader of [authRaw, authBase64]) {
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: "application/pdf, application/json",
      },
    });

    // Snapshot the first bit of any error body so we can see what
    // Documo is actually complaining about (endpoint not found vs auth
    // rejected vs wrong region etc). Cap at 240 chars to keep the log
    // tidy — no PHI risk since these are pre-download error bodies.
    let snippet: string | undefined;
    if (!res.ok) {
      try {
        const text = await res.text();
        snippet = text.slice(0, 240);
      } catch {
        /* ignore body-read failures */
      }
      attempts.push({ url, status: res.status, snippet });
      continue;
    }

    attempts.push({ url, status: res.status });
    const contentType = res.headers.get("content-type") ?? "application/pdf";

    // Some endpoints return JSON with a `fileUrl` — follow that if so.
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as Record<string, unknown>;
      const nestedUrl =
        (json.fileUrl ??
          json.url ??
          json.downloadUrl ??
          json.pdfUrl ??
          (json.data as Record<string, unknown> | undefined)?.fileUrl ??
          (json.data as Record<string, unknown> | undefined)?.pdfUrl) as
          | string
          | undefined;
      if (nestedUrl) {
        const inner = await fetch(nestedUrl);
        if (inner.ok) {
          const bytes = new Uint8Array(await inner.arrayBuffer());
          return {
            ok: true,
            bytes,
            contentType:
              inner.headers.get("content-type") ?? "application/pdf",
          };
        }
        attempts.push({ url: nestedUrl, status: inner.status });
      }
      continue;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    return { ok: true, bytes, contentType };
    } // end auth-header loop
  }
  return { ok: false, status: attempts.at(-1)?.status ?? 0, attempts };
}

/** Constant-time Basic Auth compare so the caller can't time-attack the
 *  credentials. Both username and password are compared independently
 *  under timingSafeEqual — length-safe padding to avoid the trivial
 *  early-exit on length mismatch. */
function verifyBasicAuth(
  authHeader: string | null,
  expectedUser: string,
  expectedPass: string,
): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const base64 = authHeader.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  const eqLen = (a: string, b: string) => {
    // Pad both to the longer length so timingSafeEqual doesn't reveal
    // whether the difference was in length or content.
    const max = Math.max(Buffer.byteLength(a), Buffer.byteLength(b));
    const pa = Buffer.alloc(max);
    const pb = Buffer.alloc(max);
    pa.write(a);
    pb.write(b);
    const eq = timingSafeEqual(pa, pb);
    return eq && Buffer.byteLength(a) === Buffer.byteLength(b);
  };

  return eqLen(user, expectedUser) && eqLen(pass, expectedPass);
}

export async function POST(request: Request) {
  const provider = (process.env.FAX_PROVIDER ?? "documo").toLowerCase();
  if (provider === "ifax") return handleIfaxInbound(request);
  return handleDocumoInbound(request);
}

async function handleDocumoInbound(request: Request) {
  const expectedUser = process.env.DOCUMO_WEBHOOK_USERNAME;
  const expectedPass = process.env.DOCUMO_WEBHOOK_PASSWORD;
  if (!expectedUser || !expectedPass) {
    console.error(
      "[intake.inbound-fax] Missing DOCUMO_WEBHOOK_USERNAME/PASSWORD",
    );
    return new NextResponse("Server not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyBasicAuth(authHeader, expectedUser, expectedPass)) {
    console.warn("[intake.inbound-fax] Basic auth failed", {
      hasHeader: !!authHeader,
    });
    return new NextResponse("Unauthorized.", { status: 401 });
  }

  const rawBody = await request.text();

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON.", { status: 400 });
  }
  const payload = parseDocumoPayload(payloadJson);
  if (!payload) {
    // Log the SHAPE (top-level keys + one level down) so we can adapt
    // the parser without PHI leaking into logs. Values are stringified
    // with type tags, not contents.
    const shape = describeShape(payloadJson);
    console.error("[intake.inbound-fax] Unrecognized payload shape", {
      shape,
    });
    return new NextResponse("Unrecognized payload.", { status: 400 });
  }

  // `.complete` fires for failed transmissions too — no PDF to store.
  // ACK the event so Documo stops retrying, log it, and move on. We
  // don't create an intake row for failed receptions (the Documo
  // dashboard is the source of truth for failed-fax troubleshooting).
  if (!payload.succeeded) {
    console.info("[intake.inbound-fax] Skipping non-successful event", {
      faxId: payload.faxId,
    });
    return NextResponse.json({ ok: true, skipped: "not_succeeded" });
  }

  const admin = createAdminClient();

  // Idempotency check — if we've already stored this fax, ACK the retry
  // without re-downloading / re-inserting.
  const { data: existing } = await admin
    .from("intake_documents")
    .select("id")
    .eq("provider", "documo")
    .eq("external_id", payload.faxId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
  }

  // Fetch the PDF from Documo's REST API. Documo doesn't push the
  // file URL in the webhook payload — we have to pull it ourselves
  // using the messageId + an API key from the Documo dashboard.
  const apiKey = process.env.DOCUMO_API_KEY;
  if (!apiKey) {
    console.error("[intake.inbound-fax] Missing DOCUMO_API_KEY");
    return new NextResponse("Server not configured (missing API key).", {
      status: 500,
    });
  }
  const fetched = await fetchDocumoFax(payload.faxId, apiKey);
  if (!fetched.ok) {
    console.error("[intake.inbound-fax] Failed to download fax", {
      faxId: payload.faxId,
      status: fetched.status,
      attempts: fetched.attempts,
    });
    return new NextResponse("Failed to download fax file.", { status: 502 });
  }
  const { bytes, contentType } = fetched;

  // Deterministic storage path — one PDF per intake row, easy to sweep.
  const intakeId = randomUUID();
  const filePath = `intake/${intakeId}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, bytes, { contentType, upsert: false });
  if (uploadErr) {
    console.error("[intake.inbound-fax] Storage upload failed", uploadErr);
    return new NextResponse("Storage upload failed.", { status: 500 });
  }

  const fileName =
    payload.fileName ??
    `fax-${payload.faxId}.pdf`;

  const { data: inserted, error: insertErr } = await admin
    .from("intake_documents")
    .insert({
      id: intakeId,
      source: "fax",
      provider: "documo",
      external_id: payload.faxId,
      from_number: payload.fromNumber,
      to_number: payload.toNumber,
      received_at: payload.receivedAt ?? new Date().toISOString(),
      page_count: payload.pageCount,
      bucket: BUCKET,
      file_path: filePath,
      file_name: fileName,
      mime_type: contentType,
      file_size: bytes.byteLength,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    // Cleanup the just-uploaded blob so we don't leak an orphan on
    // failed insert (usually a constraint violation from a stale
    // idempotency check race, or DB downtime).
    await admin.storage
      .from(BUCKET)
      .remove([filePath])
      .catch((e) => console.error("[intake.inbound-fax] cleanup", e));

    // 23505 = duplicate key. Treat as idempotent success — the parallel
    // request that beat us already stored the row.
    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[intake.inbound-fax] Insert failed", insertErr);
    return new NextResponse("Insert failed.", { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}

/* ────────────────────────────────────────────────────────────────────────
 * iFax handler
 *
 * iFax's inbound webhook is JSON (application/json). Confirmed 2026-09-16
 * against a live test fax:
 *
 *   {
 *     "direction":        "inbound",
 *     "jobId":            7067845,
 *     "transactionId":    8660564,
 *     "faxCallLength":    127,
 *     "faxCallStart":     1745442509,     // UTC seconds
 *     "faxCallEnd":       1745442636,
 *     "faxTotalPages":    11,
 *     "faxReceivedPages": 11,
 *     "faxStatus":        "received",
 *     "success":          true,
 *     "fromNumber":       "+2512445025",
 *     "toNumber":         "+12096380085",
 *     "code":             0,
 *     "message":          "NORMAL_CLEARING"
 *   }
 *
 * The webhook does NOT ship the PDF — we pull it in a follow-up call:
 *
 *   POST https://api.ifaxapp.com/v1/customer/inbound/fax-download
 *   Header: accessToken: <IFAX_API_KEY>
 *   Body:   { "jobId": "...", "transactionId": "..." }
 *   Result: { "status": 1, "data": "<base64-PDF>" }
 *
 * Auth on the webhook itself is Basic Auth (username + password
 * configured on iFax's Webhooks settings page), verified against
 * IFAX_WEBHOOK_BASIC_USERNAME / _PASSWORD.
 *
 * Differences vs Documo:
 *   - Auth header source: iFax uses `accessToken`, Documo uses `Basic <apikey>`
 *   - PDF wire format:    iFax returns base64 inside JSON,
 *                         Documo returns raw application/pdf bytes
 *   - Idempotency key:    iFax uses jobId; Documo uses messageId
 *   - We use `provider="ifax"` on the intake_documents row, so the
 *     Fax Intake UI treats them identically alongside Documo rows.
 * ──────────────────────────────────────────────────────────────────────── */

interface IfaxFaxPayload {
  /** iFax's identifier for this fax event — used as our idempotency key
   *  AND the primary parameter to the download API. Non-null on any
   *  webhook we accept. */
  jobId: string;
  transactionId: string;
  fromNumber: string | null;
  toNumber: string | null;
  pageCount: number | null;
  /** ISO-8601. Derived from `faxCallEnd` (UTC seconds) when present. */
  receivedAt: string | null;
  fileName: string | null;
  /** True on the "received"/success event; false on failed / status-only
   *  events that we should ACK but not persist. */
  succeeded: boolean;
}

/**
 * Extract fax metadata from an iFax JSON webhook body.
 *
 * Returns null for events we can't identify as inbound faxes (unknown
 * direction, missing jobId+transactionId, etc.) — the handler ACKs
 * those with a 200 so iFax stops retrying.
 */
function parseIfaxPayload(body: unknown): IfaxFaxPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // Only care about inbound faxes. Outbound / status-change events
  // reuse the same webhook URL when subscribed to "Inbound Fax Events"
  // shouldn't happen, but defense in depth.
  const direction = String(b.direction ?? "").toLowerCase();
  if (direction && direction !== "inbound") return null;

  const jobIdRaw = b.jobId ?? b.job_id;
  const transactionIdRaw = b.transactionId ?? b.transaction_id;
  if (jobIdRaw == null || transactionIdRaw == null) return null;
  const jobId = String(jobIdRaw);
  const transactionId = String(transactionIdRaw);

  const fromNumber =
    typeof b.fromNumber === "string" && b.fromNumber.trim()
      ? b.fromNumber.trim()
      : null;
  const toNumber =
    typeof b.toNumber === "string" && b.toNumber.trim()
      ? b.toNumber.trim()
      : null;

  const pageCount =
    typeof b.faxReceivedPages === "number"
      ? (b.faxReceivedPages as number)
      : typeof b.faxTotalPages === "number"
        ? (b.faxTotalPages as number)
        : null;

  // faxCallEnd is a UTC epoch in SECONDS. Multiply to ms for the ISO.
  const callEnd =
    typeof b.faxCallEnd === "number" ? (b.faxCallEnd as number) : null;
  const receivedAt =
    callEnd && callEnd > 0 ? new Date(callEnd * 1000).toISOString() : null;

  // `success: true` + `faxStatus: "received"` are the canonical happy
  // path. A `code !== 0` or `success === false` means the fax event
  // failed and there's no downloadable file.
  const success = b.success !== false;
  const code = typeof b.code === "number" ? (b.code as number) : 0;
  const status = String(b.faxStatus ?? "").toLowerCase();
  const succeeded =
    success &&
    code === 0 &&
    (status === "" || /(received|success|complete|delivered)/i.test(status));

  return {
    jobId,
    transactionId,
    fromNumber,
    toNumber,
    pageCount,
    receivedAt,
    fileName: `fax-${jobId}.pdf`,
    succeeded,
  };
}

/**
 * Download the PDF bytes for one inbound fax from iFax's REST API.
 * Returns base64 → Uint8Array. Endpoint verified 2026-09-16 against
 * iFax's public API docs (v1).
 */
async function fetchIfaxFax(
  jobId: string,
  transactionId: string,
  apiKey: string,
): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; status: number; snippet?: string }
> {
  const url = "https://api.ifaxapp.com/v1/customer/inbound/fax-download";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accessToken: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ jobId, transactionId }),
  });

  if (!res.ok) {
    let snippet: string | undefined;
    try {
      snippet = (await res.text()).slice(0, 240);
    } catch {
      /* ignore body-read failures */
    }
    return { ok: false, status: res.status, snippet };
  }

  const json = (await res.json()) as {
    status?: number | string;
    message?: string;
    data?: string;
  };
  const b64 = json.data;
  if (!b64 || typeof b64 !== "string") {
    return {
      ok: false,
      status: 200,
      snippet: `Missing data field. status=${json.status} message=${json.message}`,
    };
  }

  // iFax's base64 field may include a data URI prefix; strip if present.
  const cleaned = b64.replace(/^data:application\/pdf;base64,/i, "");
  const bytes = new Uint8Array(Buffer.from(cleaned, "base64"));
  return { ok: true, bytes, contentType: "application/pdf" };
}

async function handleIfaxInbound(request: Request) {
  const expectedUser = process.env.IFAX_WEBHOOK_BASIC_USERNAME;
  const expectedPass = process.env.IFAX_WEBHOOK_BASIC_PASSWORD;
  if (!expectedUser || !expectedPass) {
    console.error(
      "[intake.inbound-fax] Missing IFAX_WEBHOOK_BASIC_USERNAME/PASSWORD",
    );
    return new NextResponse("Server not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyBasicAuth(authHeader, expectedUser, expectedPass)) {
    console.warn("[intake.inbound-fax] iFax: Basic auth failed", {
      hasHeader: !!authHeader,
    });
    return new NextResponse("Unauthorized.", { status: 401 });
  }

  const rawBody = await request.text();
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    console.error("[intake.inbound-fax] iFax: invalid JSON body");
    return new NextResponse("Invalid JSON.", { status: 400 });
  }

  const payload = parseIfaxPayload(payloadJson);
  if (!payload) {
    const shape = describeShape(payloadJson);
    console.error("[intake.inbound-fax] iFax: unrecognized payload shape", {
      shape,
    });
    // 200 (not 400) so iFax doesn't hammer us with retries on payload
    // shapes we don't yet understand. The shape log tells us how to
    // adapt on the next deploy.
    return NextResponse.json({ ok: true, ignored: "unknown_shape" });
  }

  console.info("[intake.inbound-fax] iFax parsed", {
    jobId: payload.jobId,
    transactionId: payload.transactionId,
    fromNumber: payload.fromNumber,
    toNumber: payload.toNumber,
    pageCount: payload.pageCount,
    succeeded: payload.succeeded,
  });

  if (!payload.succeeded) {
    console.info("[intake.inbound-fax] iFax: skipping non-success event", {
      jobId: payload.jobId,
    });
    return NextResponse.json({ ok: true, skipped: "not_succeeded" });
  }

  const admin = createAdminClient();

  // Idempotency check — iFax retries on 5xx too, and the unique index
  // on (provider, external_id) is what prevents duplicate rows.
  const { data: existing } = await admin
    .from("intake_documents")
    .select("id")
    .eq("provider", "ifax")
    .eq("external_id", payload.jobId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
  }

  const apiKey = process.env.IFAX_API_KEY;
  if (!apiKey) {
    console.error("[intake.inbound-fax] iFax: missing IFAX_API_KEY");
    return new NextResponse("Server not configured (missing API key).", {
      status: 500,
    });
  }

  const fetched = await fetchIfaxFax(
    payload.jobId,
    payload.transactionId,
    apiKey,
  );
  if (!fetched.ok) {
    console.error("[intake.inbound-fax] iFax: failed to download fax", {
      jobId: payload.jobId,
      transactionId: payload.transactionId,
      status: fetched.status,
      snippet: fetched.snippet,
    });
    return new NextResponse("Failed to download fax file.", { status: 502 });
  }
  const { bytes, contentType } = fetched;

  const intakeId = randomUUID();
  const filePath = `intake/${intakeId}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, bytes, { contentType, upsert: false });
  if (uploadErr) {
    console.error(
      "[intake.inbound-fax] iFax: storage upload failed",
      uploadErr,
    );
    return new NextResponse("Storage upload failed.", { status: 500 });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("intake_documents")
    .insert({
      id: intakeId,
      source: "fax",
      provider: "ifax",
      external_id: payload.jobId,
      from_number: payload.fromNumber,
      to_number: payload.toNumber,
      received_at: payload.receivedAt ?? new Date().toISOString(),
      page_count: payload.pageCount,
      bucket: BUCKET,
      file_path: filePath,
      file_name: payload.fileName,
      mime_type: contentType,
      file_size: bytes.byteLength,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    await admin.storage
      .from(BUCKET)
      .remove([filePath])
      .catch((e) => console.error("[intake.inbound-fax] iFax: cleanup", e));

    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[intake.inbound-fax] iFax: insert failed", insertErr);
    return new NextResponse("Insert failed.", { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
