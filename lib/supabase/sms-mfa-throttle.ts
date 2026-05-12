import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side throttle for Twilio SMS MFA sends.
 *
 * Why this exists: the SMS challenge page (and a couple other entry points)
 * call Twilio Verify when a user lands on them. Without dedup, every refresh,
 * back-button, multi-tab open, or short-lived redirect chain fires a brand-
 * new billed SMS to the same phone. Twilio's fraud heuristic interprets
 * burst sends as spam and blocks the destination — punishing the user, not
 * the bug. A 30-second per-user cooldown enforced at the DB layer keeps us
 * well under Twilio's 5-per-10-min cap and defeats the rapid-retry pattern.
 *
 * Why a DB column instead of cookie / Redis / in-memory:
 *   - Vercel functions are stateless; in-memory doesn't survive across
 *     invocations or replicas.
 *   - Cookies can't be written from server-component renders in Next 16
 *     (and are bypassable by clearing them).
 *   - Redis/Upstash is overkill for a 30s per-user gate.
 *   - A column on profiles fits the existing auth-state shape (alongside
 *     phone_verified_at, has_completed_setup).
 *
 * Why a single atomic UPDATE instead of read-then-write:
 *   Read-then-write has a race window. Two concurrent requests both read
 *   "stale", both decide they're allowed to send, both write. Postgres
 *   row-locks during an UPDATE; the second request sees the updated
 *   timestamp via the WHERE clause and the UPDATE returns 0 rows. Race
 *   closed at the database level. This matters in practice for tab-restore
 *   (multiple tabs opening at once) and for retry-on-network-blip scenarios.
 */

export const SMS_MFA_MIN_RESEND_MS = 30_000;

export type ClaimResult = {
  /** True when this caller won the slot and is allowed to send. */
  claimed: boolean;
  /** Seconds until the next send is allowed. Zero when claimed=true. */
  secondsLeft: number;
};

/**
 * Atomically attempt to claim a send slot for `userId`. Returns
 * `{ claimed: true }` when the slot is awarded — the caller should
 * proceed to call Twilio. Returns `{ claimed: false, secondsLeft }`
 * when another send happened within the last 30 seconds.
 *
 * Fails open on DB error (returns `claimed: true` with `secondsLeft: 0`)
 * so a transient Supabase blip doesn't lock real users out of MFA. Twilio's
 * own per-phone rate limit remains the final backstop in that case, and
 * the error is logged for monitoring.
 */
export async function tryClaimSmsMfaSend(userId: string): Promise<ClaimResult> {
  const admin = createAdminClient();
  const now = new Date();
  const thresholdIso = new Date(now.getTime() - SMS_MFA_MIN_RESEND_MS).toISOString();

  // Atomic conditional UPDATE. Postgres row-locks for the duration of the
  // UPDATE, so two concurrent requests can't both pass the WHERE check.
  const { data, error } = await admin
    .from("profiles")
    .update({ last_sms_mfa_send_at: now.toISOString() })
    .eq("id", userId)
    .or(`last_sms_mfa_send_at.is.null,last_sms_mfa_send_at.lt.${thresholdIso}`)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[sms-mfa-throttle] UPDATE error — failing open:",
      JSON.stringify(error),
    );
    return { claimed: true, secondsLeft: 0 };
  }

  if (data) {
    // UPDATE matched a row → we claimed the slot.
    return { claimed: true, secondsLeft: 0 };
  }

  // UPDATE matched zero rows → another send happened recently. Read back
  // the stored timestamp so we can give the client an accurate "wait N
  // seconds" hint for the cooldown timer.
  const { data: profile } = await admin
    .from("profiles")
    .select("last_sms_mfa_send_at")
    .eq("id", userId)
    .maybeSingle();

  const lastSendIso = profile?.last_sms_mfa_send_at as string | null | undefined;
  if (!lastSendIso) {
    // Edge case: row exists but column was just cleared. Allow the send.
    return { claimed: true, secondsLeft: 0 };
  }

  const elapsed = Date.now() - new Date(lastSendIso).getTime();
  const secondsLeft = Math.max(
    1,
    Math.ceil((SMS_MFA_MIN_RESEND_MS - elapsed) / 1000),
  );
  return { claimed: false, secondsLeft };
}
