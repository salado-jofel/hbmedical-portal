/* Prefill resolution for the order forms (IVR, Order Form, 1500).
 *
 * A form is assembled from several sources — AI extraction of the uploaded
 * facesheet / clinical docs, the clinic's enrollment form, the provider's
 * credentials, and the order's own patient / facility records. The prefill is
 * a helping hand, not an answer: providers review it and correct what's wrong.
 *
 * Extraction re-runs on every facesheet / clinical-doc upload, so a second run
 * must never get a second vote on a value that is already there. Whatever the
 * row holds wins — a provider's correction above all — and each run may only
 * fill columns that are still blank.
 */

/* Blank means "no answer given": null, undefined, or a string with nothing in
 * it. Notably NOT false and NOT 0 — "do not contact this patient" and a zero
 * deductible are real answers, and `a || b` would discard both. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export type FillBlanksResult = {
  /** The payload to write: on an update, only the columns that were blank. */
  payload: Record<string, unknown>;
  /** Columns this run contributed a value to. */
  filled: number;
  /** Columns left alone because the row already had an answer. */
  preserved: number;
  /** True when there is no row yet, so the payload writes in full. */
  isInsert: boolean;
};

/**
 * Reduces `payload` to the columns that are still blank on `existing`.
 *
 * With no existing row the payload passes through untouched — the first run
 * populates everything. With a row present, a column is written only when the
 * payload has a value for it AND the row does not; anything already answered is
 * preserved.
 *
 * `alwaysWrite` names bookkeeping columns that are the caller's own record of
 * the run (order_id, ai_extracted, ai_extracted_at) and are written every time
 * regardless of what the row holds.
 */
export function mergeFillingBlanks(
  existing: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown>,
  alwaysWrite: ReadonlyArray<string> = [],
): FillBlanksResult {
  if (!existing) {
    return { payload, filled: 0, preserved: 0, isInsert: true };
  }

  const merged: Record<string, unknown> = {};
  for (const key of alwaysWrite) {
    if (key in payload) merged[key] = payload[key];
  }

  let filled = 0;
  let preserved = 0;
  for (const [key, value] of Object.entries(payload)) {
    if (key in merged) continue;
    if (isBlank(value)) continue;
    if (!isBlank(existing[key])) {
      preserved++;
      continue;
    }
    merged[key] = value;
    filled++;
  }

  return { payload: merged, filled, preserved, isInsert: false };
}
