/**
 * iFax REST client — shared by the inbound webhook
 * (app/api/intake/inbound-fax/route.ts) and the intake re-download
 * server action (dashboard/intake/(services)/actions.ts).
 *
 * Endpoints (verified against https://www.ifaxapp.com/docs/api/v1):
 *   POST /v1/customer/inbound/fax-download   { jobId, transactionId } → base64 PDF
 *   POST /v1/customer/inbound/fax-list-all   { startDate?, endDate?, sortBy?, lastFaxId? }
 *                                            → [{ jobId, transactionId, receivedTime, ... }]
 *
 * Auth is the `accessToken` header on every call. Server-only — never
 * import from a client component.
 */

const IFAX_BASE = "https://api.ifaxapp.com/v1/customer";

export type IfaxDownloadResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; status: number; snippet?: string };

/** Return a shape sketch of an unknown JSON value: keys and their types,
 *  drilling one level down into nested objects. NO scalar values are
 *  emitted — safe to log for debugging a provider's actual response
 *  shape without leaking any PHI that might be in a field like
 *  patient_name.
 */
export function describeShape(v: unknown, depth = 0): unknown {
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

/**
 * Download the PDF bytes for one inbound fax from iFax's REST API.
 * iFax may return either:
 *  - base64 in `data` (as their docs example shows), OR
 *  - a signed URL in `data.url` / `data.file` (some tenants), OR
 *  - raw application/pdf bytes (rare)
 *
 * We walk all three shapes defensively and reject empty results so a
 * 0-byte PDF never lands in intake.
 */
export async function fetchIfaxFax(
  jobId: string,
  transactionId: string,
  apiKey: string,
): Promise<IfaxDownloadResult> {
  const res = await fetch(`${IFAX_BASE}/inbound/fax-download`, {
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

  const respContentType = res.headers.get("content-type") ?? "";

  // Case 1 — raw PDF bytes (some fax APIs bypass the JSON envelope
  // entirely when the file is small). Handle first so we don't try to
  // JSON.parse binary garbage.
  if (respContentType.toLowerCase().startsWith("application/pdf")) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) {
      return { ok: false, status: 200, snippet: "Empty PDF body" };
    }
    return { ok: true, bytes, contentType: "application/pdf" };
  }

  // Case 2 — JSON envelope. iFax's docs example wraps base64 in `data`,
  // but tenants have seen the same field carry either base64 OR a
  // signed URL, and some responses nest one more level under `data.data`
  // or `data.file`. Walk defensively.
  const rawText = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: 200,
      snippet: `Non-JSON body: ${rawText.slice(0, 200)}`,
    };
  }

  // Collect every candidate that might carry the payload — top-level
  // AND one level under `data` (the most common wrapper).
  const inner =
    json.data && typeof json.data === "object"
      ? (json.data as Record<string, unknown>)
      : {};
  const stringCandidates = [
    json.data,
    json.file,
    json.pdf,
    json.base64,
    json.content,
    inner.data,
    inner.file,
    inner.pdf,
    inner.base64,
    inner.content,
    inner.url,
    inner.fileUrl,
    inner.downloadUrl,
    json.url,
    json.fileUrl,
    json.downloadUrl,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (stringCandidates.length === 0) {
    // Log a shape sketch of iFax's response so we can adapt without
    // guessing on the next fax. Values sanitized to types-only.
    console.error(
      "[ifax] download response had no usable data field",
      {
        status: json.status,
        message: json.message,
        shape: describeShape(json),
      },
    );
    return {
      ok: false,
      status: 200,
      snippet: `Missing data field. status=${json.status} message=${json.message}`,
    };
  }

  for (const candidate of stringCandidates) {
    // Signed URL branch — fetch the bytes from wherever iFax stored them.
    if (/^https?:\/\//i.test(candidate)) {
      const inner2 = await fetch(candidate, {
        headers: { accessToken: apiKey },
      });
      if (!inner2.ok) continue;
      const bytes = new Uint8Array(await inner2.arrayBuffer());
      if (bytes.byteLength === 0) continue;
      return {
        ok: true,
        bytes,
        contentType: inner2.headers.get("content-type") ?? "application/pdf",
      };
    }

    // Base64 branch — strip data URI prefix, decode, check length.
    const cleaned = candidate
      .replace(/^data:application\/pdf;base64,/i, "")
      .replace(/^data:[^;]+;base64,/i, "")
      .replace(/\s+/g, "");
    // Very short strings are almost certainly not a real PDF (a valid
    // PDF header alone base64s to ~28 chars, and a 1-page fax is tens
    // of KB minimum).
    if (cleaned.length < 100) continue;
    try {
      const bytes = new Uint8Array(Buffer.from(cleaned, "base64"));
      if (bytes.byteLength < 100) continue;
      // Sanity check: PDFs start with "%PDF"
      const head = String.fromCharCode(...bytes.slice(0, 4));
      if (head !== "%PDF") {
        console.warn(
          "[ifax] decoded bytes don't start with %PDF header",
          { firstBytes: head },
        );
        // Still accept — a fax MIGHT be a TIFF someday. Storing 0 bytes
        // was the real issue, not header mismatch.
      }
      return { ok: true, bytes, contentType: "application/pdf" };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    status: 200,
    snippet: `All candidates yielded empty bytes. status=${json.status} message=${json.message}`,
  };
}

/** Format a Date as MM/DD/YYYY — the only date format fax-list-all accepts. */
function ifaxDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

/**
 * Recover the transactionId for an inbound fax we only know by jobId.
 *
 * Needed for intake rows created before we started persisting
 * provider_transaction_id (every row before 2026-09-18) — the download
 * endpoint requires both IDs. Walks fax-list-all around the fax's
 * received date, following `lastFaxId` pagination until the jobId shows
 * up or the list runs dry.
 */
export async function findIfaxTransactionId(
  jobId: string,
  receivedAt: Date,
  apiKey: string,
): Promise<{ transactionId: string } | { error: string }> {
  // ±2 days around receipt — the webhook's receivedAt is the call-end
  // timestamp, but iFax's own receivedTime may straddle midnight UTC.
  const start = new Date(receivedAt.getTime() - 2 * 86_400_000);
  const end = new Date(receivedAt.getTime() + 2 * 86_400_000);

  let lastFaxId: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${IFAX_BASE}/inbound/fax-list-all`, {
      method: "POST",
      headers: {
        accessToken: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        startDate: ifaxDate(start),
        endDate: ifaxDate(end),
        sortBy: "newest",
        ...(lastFaxId ? { lastFaxId } : {}),
      }),
    });
    if (!res.ok) {
      return { error: `fax-list-all returned HTTP ${res.status}` };
    }

    let json: { data?: unknown; message?: unknown };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      return { error: "fax-list-all returned a non-JSON body" };
    }
    if (!Array.isArray(json.data)) {
      console.error("[ifax] fax-list-all: unexpected shape", {
        shape: describeShape(json),
      });
      return { error: "fax-list-all returned an unexpected shape" };
    }
    if (json.data.length === 0) break;

    for (const row of json.data as Array<Record<string, unknown>>) {
      if (String(row.jobId ?? row.job_id ?? "") === jobId) {
        const tx = row.transactionId ?? row.transaction_id;
        if (tx != null && String(tx).length > 0) {
          return { transactionId: String(tx) };
        }
      }
    }

    const tail = json.data[json.data.length - 1] as Record<string, unknown>;
    const nextCursor = tail?.jobId ?? tail?.job_id;
    if (nextCursor == null || String(nextCursor) === lastFaxId) break;
    lastFaxId = String(nextCursor);
  }

  return { error: `Fax ${jobId} not found in iFax's inbound list.` };
}
