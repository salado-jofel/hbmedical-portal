/**
 * Server-side log helpers that scrub well-known PHI fields before writing
 * to stdout (which Vercel's serverless logs capture and retain).
 *
 * Two functions:
 *   - safeLogError(tag, err, extra?)
 *   - safeLogInfo (tag, message, extra?)
 *
 * They behave like a tiny structured logger but with a "scrub list" applied
 * recursively to any object passed in. The scrub list is the union of every
 * column name we know to carry patient information: first/last name, DOB,
 * patient address, signature images, etc. Anything matching is replaced
 * with the string "[redacted]".
 *
 * What this catches:
 *   - Postgres error objects that include the failing row (Supabase v2
 *     surfaces this in `error.details`).
 *   - Hand-rolled `console.error("...", JSON.stringify(error))` calls that
 *     migrate to safeLogError.
 *
 * What this does NOT catch:
 *   - Strings that already contain PHI by the time they reach the logger
 *     (e.g. an interpolated template literal). The scrub is field-name based,
 *     not value-based.
 *
 * Hard rule: never `console.log(patient.first_name)` directly. Use the
 * structured form `safeLogInfo("tag", "msg", { firstName: patient.first_name })`
 * which gets scrubbed.
 */

const SENSITIVE_FIELD_PATTERNS = [
  /^first_?name$/i,
  /^last_?name$/i,
  /^full_?name$/i,
  /^patient_?name$/i,
  /^patient_?first_?name$/i,
  /^patient_?last_?name$/i,
  /^patient_?full_?name$/i,
  /^date_?of_?birth$/i,
  /^dob$/i,
  /^patient_?dob$/i,
  /^subscriber_?dob$/i,
  /^patient_?address/i,
  /^address_?line/i,
  /^member_?id$/i,
  /^subscriber_?name$/i,
  /^physician_?signature/i,
  /^patient_?signature/i,
  /^signature_?image$/i,
  /^pin$/i,
  /^pin_?hash$/i,
  /^password$/i,
  /^icd10/i,
  /^clinical_?notes$/i,
  /^chief_?complaint$/i,
];

const MAX_DEPTH = 5;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((rx) => rx.test(key));
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = scrub(v, depth + 1);
    }
  }
  return out;
}

/**
 * Coerce an arbitrary thrown value to a small, log-safe shape. Postgres /
 * PostgREST errors carry `message` + `code` + sometimes `details` (which
 * may include a failing row); we keep message + code, scrub details.
 */
function errToShape(err: unknown): Record<string, unknown> {
  if (!err) return { kind: "empty" };
  if (typeof err === "string") return { message: err };
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    // Supabase / Postgrest error fields
    const anyErr = err as unknown as Record<string, unknown>;
    if (anyErr.code) out.code = anyErr.code;
    if (anyErr.hint) out.hint = anyErr.hint;
    if (anyErr.details) out.details = scrub(anyErr.details);
    return out;
  }
  if (typeof err === "object") {
    return scrub(err) as Record<string, unknown>;
  }
  return { value: String(err) };
}

/**
 * Log a server-side error in a HIPAA-safe way. Replaces patterns like:
 *   console.error("[xxx]", JSON.stringify(error))
 * with:
 *   safeLogError("xxx", error)
 *
 * The `extra` argument is also scrubbed; safe to pass server context.
 */
export function safeLogError(
  tag: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const payload = {
    tag,
    error: errToShape(err),
    ...(extra ? { extra: scrub(extra) } : {}),
  };
  console.error(`[${tag}]`, JSON.stringify(payload));
}

/**
 * Log structured server-side info. Avoid using this in hot paths or when
 * the message itself contains PHI — the message string is NOT scrubbed,
 * only the `extra` object.
 */
export function safeLogInfo(
  tag: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (extra) {
    console.log(`[${tag}] ${message}`, JSON.stringify(scrub(extra)));
  } else {
    console.log(`[${tag}] ${message}`);
  }
}
