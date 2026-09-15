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
 *   iFax   → multipart/form-data POST with the PDF as a file part
 *            (no follow-up download call needed)
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
 *     IFAX_API_KEY                 API key. Not currently needed at
 *                                  the webhook layer (PDF is in the
 *                                  multipart body) but reserved for
 *                                  future actions like acknowledging
 *                                  or listing faxes on demand.
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
 * iFax's inbound webhook is `multipart/form-data`:
 *   - PDF is a file part named `filename` (verified from their public
 *     docs — see WebFetch cache 2026-09-16).
 *   - Metadata (sender number, receiver number, event type, page count)
 *     lives in other form fields. iFax has not published the exact
 *     schema anywhere I could find, so parseIfaxMultipart uses a
 *     defensive walker of common candidate names AND logs every field
 *     key on first receipt so we can lock in the schema after the
 *     first live fax.
 *   - Basic Auth (username + password) verified against
 *     IFAX_WEBHOOK_BASIC_USERNAME / _PASSWORD, configured on iFax's
 *     "Webhooks" settings page in the Developer API section.
 *
 * Differences vs Documo:
 *   - No follow-up API call needed to fetch the PDF — the bytes are
 *     in the multipart body, one round-trip instead of two.
 *   - We use `provider="ifax"` on the intake_documents row, so the
 *     Fax Intake UI treats them identically alongside Documo rows.
 * ──────────────────────────────────────────────────────────────────────── */

interface IfaxFaxPayload {
  /** iFax's identifier for this fax — used as our idempotency key.
   *  Falls back to a random UUID when the payload doesn't include one
   *  (unlikely, but keeps us from crashing). */
  faxId: string;
  fromNumber: string | null;
  toNumber: string | null;
  pageCount: number | null;
  receivedAt: string | null;
  fileName: string | null;
  /** The actual PDF bytes lifted from the multipart body. */
  bytes: Uint8Array;
  contentType: string;
  /** True on the "received" event; false on failed / status-only events
   *  that we should ACK but not persist. Absence of an event field is
   *  treated as success — safer default given iFax's docs are sparse. */
  succeeded: boolean;
}

/** Same defensive first-non-empty pick used by Documo, extracted here
 *  so both parsers share behavior. Empty-string / whitespace-only /
 *  null / undefined are all treated as "no value". */
function pickFirst(
  candidates: Array<unknown>,
  exclude?: string | null,
): string | null {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (!s) continue;
    if (exclude && s === exclude) continue;
    return s;
  }
  return null;
}

/**
 * Extract fax metadata + PDF bytes from an iFax multipart POST body.
 *
 * Field-name candidates are ordered by "most likely first" based on
 * common webhook naming conventions across the fax-API market. If iFax
 * uses a name not in our candidate list, the `unrecognized_fields` log
 * on the first live receipt will surface it and we can add it here.
 */
async function parseIfaxMultipart(
  formData: FormData,
): Promise<IfaxFaxPayload | null> {
  // ─── 1. The PDF file part ─────────────────────────────────────────
  // Per iFax's docs the file part is named `filename`. We also check a
  // couple of common aliases in case a future iFax API version
  // (v2, v3, etc.) renames it.
  const fileCandidates = ["filename", "file", "attachment", "fax_file", "pdf"];
  let fileBlob: File | null = null;
  for (const name of fileCandidates) {
    const v = formData.get(name);
    if (v instanceof File) {
      fileBlob = v;
      break;
    }
  }
  if (!fileBlob) {
    // Extreme fallback — walk every entry and grab the first File. This
    // helps us survive an undocumented rename without dropping the fax
    // (we can rely on the debug log to add the real name to our list
    // for the next deploy).
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.warn(
          "[intake.inbound-fax] iFax: PDF file part had unexpected name",
          { fieldName: key, size: value.size },
        );
        fileBlob = value;
        break;
      }
    }
  }
  if (!fileBlob) {
    console.error(
      "[intake.inbound-fax] iFax: no file part found on multipart POST",
      {
        formKeys: Array.from(formData.keys()),
      },
    );
    return null;
  }

  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const contentType = fileBlob.type || "application/pdf";
  const uploadedFileName = fileBlob.name || null;

  // ─── 2. Metadata fields ────────────────────────────────────────────
  // Grab everything as strings — FormData values are strings or File,
  // and we only care about string metadata here.
  const str = (name: string): string | null => {
    const v = formData.get(name);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const faxId =
    pickFirst([
      str("fax_id"),
      str("faxId"),
      str("id"),
      str("uuid"),
      str("message_id"),
      str("messageId"),
      str("transaction_id"),
    ]) ?? randomUUID();

  const toNumber = pickFirst([
    str("to"),
    str("toNumber"),
    str("to_number"),
    str("recipient"),
    str("recipient_number"),
    str("destination"),
    str("destination_number"),
    str("receiver"),
    str("receiver_number"),
  ]);

  const fromNumber = pickFirst(
    [
      str("from"),
      str("fromNumber"),
      str("from_number"),
      str("sender"),
      str("sender_number"),
      str("caller"),
      str("caller_id"),
      str("callerId"),
      str("csid"),
      str("ani"),
    ],
    toNumber, // never let our own receiver leak into the sender slot
  );

  const pageCountRaw = pickFirst([
    str("pages"),
    str("page_count"),
    str("pageCount"),
    str("num_pages"),
    str("numPages"),
    str("total_pages"),
  ]);
  const pageCount =
    pageCountRaw && !isNaN(Number(pageCountRaw)) ? Number(pageCountRaw) : null;

  const receivedAt = pickFirst([
    str("received_at"),
    str("receivedAt"),
    str("created_at"),
    str("createdAt"),
    str("timestamp"),
    str("date"),
  ]);

  const fileName =
    pickFirst([
      uploadedFileName,
      str("filename"),
      str("file_name"),
      str("fileName"),
    ]) ?? `fax-${faxId}.pdf`;

  // ─── 3. Event / status classification ─────────────────────────────
  // iFax's Webhooks tab labels the subscription "Inbound Fax Events"
  // (plural) — so the same webhook may fire for received / failed /
  // status-changed. Only "received"-flavored events should insert a
  // row. Anything unrecognized is treated as success (fail-open) so
  // we don't silently drop good faxes if iFax adds a new event value.
  const event = pickFirst([
    str("event"),
    str("event_type"),
    str("eventType"),
    str("type"),
    str("status"),
  ]);
  const succeeded =
    !event ||
    /(received|inbound|complete|success|delivered)/i.test(event);

  // ─── 4. Debug log — first-pass field discovery ────────────────────
  // Fire once per receipt so we can nail down iFax's exact field names
  // after one live fax. Logs KEYS + TYPES only — no values — so PHI
  // stays out of the log stream. Sender/receiver numbers ARE logged
  // (mirrors Documo) since routing debugging needs them.
  const knownFields = new Set([
    "filename",
    "file",
    "attachment",
    "fax_file",
    "pdf",
    "fax_id",
    "faxId",
    "id",
    "uuid",
    "message_id",
    "messageId",
    "transaction_id",
    "to",
    "toNumber",
    "to_number",
    "recipient",
    "recipient_number",
    "destination",
    "destination_number",
    "receiver",
    "receiver_number",
    "from",
    "fromNumber",
    "from_number",
    "sender",
    "sender_number",
    "caller",
    "caller_id",
    "callerId",
    "csid",
    "ani",
    "pages",
    "page_count",
    "pageCount",
    "num_pages",
    "numPages",
    "total_pages",
    "received_at",
    "receivedAt",
    "created_at",
    "createdAt",
    "timestamp",
    "date",
    "file_name",
    "fileName",
    "event",
    "event_type",
    "eventType",
    "type",
    "status",
  ]);
  const unrecognizedFields: Array<{ key: string; kind: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (knownFields.has(key)) continue;
    unrecognizedFields.push({
      key,
      kind: value instanceof File ? "File" : "string",
    });
  }
  console.info("[intake.inbound-fax] iFax parsed", {
    faxId,
    fromNumber,
    toNumber,
    pageCount,
    event,
    succeeded,
    fileBytes: bytes.byteLength,
    unrecognizedFields,
  });

  return {
    faxId,
    fromNumber,
    toNumber,
    pageCount,
    receivedAt,
    fileName,
    bytes,
    contentType,
    succeeded,
  };
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

  // Content-Type guard — iFax always sends multipart/form-data on this
  // webhook. A JSON body would mean something changed on their side
  // and we should surface that loudly instead of silently returning
  // 400 with an unhelpful message.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    console.error(
      "[intake.inbound-fax] iFax: expected multipart/form-data, got:",
      contentType,
    );
    return new NextResponse("Expected multipart/form-data.", { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("[intake.inbound-fax] iFax: multipart parse failed", err);
    return new NextResponse("Invalid multipart body.", { status: 400 });
  }

  const payload = await parseIfaxMultipart(formData);
  if (!payload) {
    return new NextResponse("Unrecognized payload.", { status: 400 });
  }

  if (!payload.succeeded) {
    console.info("[intake.inbound-fax] iFax: skipping non-success event", {
      faxId: payload.faxId,
    });
    return NextResponse.json({ ok: true, skipped: "not_succeeded" });
  }

  const admin = createAdminClient();

  // Idempotency check — iFax retries on 5xx too, and the unique index
  // on (provider, external_id) is what prevents duplicate rows. The
  // pre-check just makes the retry case cheap.
  const { data: existing } = await admin
    .from("intake_documents")
    .select("id")
    .eq("provider", "ifax")
    .eq("external_id", payload.faxId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
  }

  const intakeId = randomUUID();
  const filePath = `intake/${intakeId}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, payload.bytes, {
      contentType: payload.contentType,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[intake.inbound-fax] iFax: storage upload failed", uploadErr);
    return new NextResponse("Storage upload failed.", { status: 500 });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("intake_documents")
    .insert({
      id: intakeId,
      source: "fax",
      provider: "ifax",
      external_id: payload.faxId,
      from_number: payload.fromNumber,
      to_number: payload.toNumber,
      received_at: payload.receivedAt ?? new Date().toISOString(),
      page_count: payload.pageCount,
      bucket: BUCKET,
      file_path: filePath,
      file_name: payload.fileName,
      mime_type: payload.contentType,
      file_size: payload.bytes.byteLength,
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
