import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Documo inbound-fax webhook.
 *
 * Documo POSTs one of these to us every time a fax completes on our
 * dedicated Meridian intake number. We:
 *   1. Verify HTTP Basic Auth on the `Authorization` header. Documo's
 *      webhook config only offers None / Basic Auth / OAuth 2.0 — no
 *      HMAC signing — so Basic Auth is the practical HTTPS-native
 *      defense against a public URL being sprayed with fake PDFs.
 *   2. Idempotency-check by fax_id — Documo retries on 5xx, so a naive
 *      insert would duplicate rows. Unique index in the DB gives us the
 *      hard guarantee; we surface a friendly 200 on the collision.
 *   3. Download the PDF from Documo's file URL and upload it to our
 *      HIPAA-scoped Supabase Storage bucket under intake/<id>.pdf. Bytes
 *      never touch a laptop or Vercel disk — server-to-server only.
 *   4. Insert an intake_documents row with status='pending' so the row
 *      shows up on the Intake Inbox for staff triage.
 *
 * Environment:
 *   DOCUMO_WEBHOOK_USERNAME  — Basic Auth username Documo sends.
 *   DOCUMO_WEBHOOK_PASSWORD  — matching password.
 *   SUPABASE_BUCKET          — Storage bucket; defaults to the HIPAA one.
 *
 * NOTE on the payload shape: Documo publishes the JSON schema at
 * https://developer.documo.com/reference/inbound-fax-webhook. If they
 * ever change field names, edit `parseDocumoPayload` below; nothing else
 * needs to move.
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

  return {
    faxId,
    fromNumber:
      ((b.faxNumber ??
        b.faxCallerId ??
        b.fromNumber ??
        b.from_number ??
        b.from) as string | null | undefined) ?? null,
    toNumber:
      ((b.faxReceiverCsid ??
        b.toNumber ??
        b.to_number ??
        b.to) as string | null | undefined) ?? null,
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

  for (const url of candidates) {
    const res = await fetch(url, {
      headers: {
        // Documo uses NON-STANDARD "Basic" auth: the raw API key goes
        // directly after "Basic ", without base64 encoding and without
        // a colon-separated username. Verified against Documo's
        // published API docs 2026-07-31 — they show
        //   --header 'Authorization: Basic API_KEY'
        // as the canonical form for /v1/faxes/* endpoints.
        //
        // Bug we just fixed: earlier code used `X-API-Key` and
        // `Authorization: Bearer` — Documo silently returns 404 on
        // auth failure to prevent resource enumeration, so every
        // request looked like "endpoint not found" when it was really
        // "wrong auth scheme".
        Authorization: `Basic ${apiKey}`,
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
