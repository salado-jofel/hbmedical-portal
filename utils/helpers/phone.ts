/**
 * Phone number helpers for SMS MFA enrollment.
 *
 * We accept international E.164 (`+CC...`, 8–15 digits) so reps in any
 * country can be onboarded. The format is enforced both client-side
 * (validators below) and server-side (the profiles.phone CHECK constraint).
 */

/** E.164: leading +, country code starting 1-9, then 7-14 digits. */
const E164_RE = /^\+[1-9][0-9]{7,14}$/;

export function isValidE164(value: string): boolean {
  return E164_RE.test(value);
}

/**
 * Strip everything except digits and a leading +. Useful for normalizing
 * pasted input ("+1 (555) 123-4567" → "+15551234567") before validating.
 */
export function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Mask a phone for display: keep the country code prefix and last 2 digits,
 * dot-out the middle. e.g. "+639310259241" → "+63 ••••••••41".
 */
export function maskPhone(e164: string): string {
  if (!isValidE164(e164)) return e164;
  // Country code is 1-3 digits after the +. We don't try to be exact here —
  // showing the +CC + last-2 is enough for a "we'll text +63 ••41" hint.
  const last2 = e164.slice(-2);
  const cc = e164.slice(0, e164.length >= 12 ? 3 : 2); // +CC or +C
  return `${cc} ••••••••${last2}`;
}
