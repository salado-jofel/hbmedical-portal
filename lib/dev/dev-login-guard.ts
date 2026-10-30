import { headers } from "next/headers";

/* Dev-only account switcher — guard.
 *
 * The switcher mints a session for any account WITHOUT a password and WITHOUT
 * the MFA challenge, so that local testing doesn't need a human at the keyboard
 * for every role. That is a complete authentication bypass, so it must be
 * impossible to reach anywhere but a local dev machine.
 *
 * Three independent locks, each sufficient on its own:
 *   1. NODE_ENV must not be "production" — Vercel sets this on every
 *      deployment, preview builds included, so a deploy kills the feature even
 *      if the env var below were set by mistake.
 *   2. ENABLE_DEV_LOGIN must be exactly "true" — explicit opt-in that lives
 *      only in .env.local and is never configured in Vercel.
 *   3. The request host must be loopback — not a tunnel, not a LAN IP, so an
 *      exposed `next dev` can't be driven from another machine.
 *
 * Anything that fails these should 404 rather than 403: the feature should look
 * like it does not exist.
 */

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Env-only part of the check; safe to call anywhere, including the client. */
export function isDevLoginConfigured(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_LOGIN === "true"
  );
}

/** Every lock that is currently closed. Empty means dev login is permitted. */
async function devLoginBlockers(): Promise<string[]> {
  const host = (await headers()).get("host") ?? "";
  const reasons: string[] = [];
  if (process.env.NODE_ENV === "production") reasons.push("NODE_ENV=production");
  if (process.env.ENABLE_DEV_LOGIN !== "true") {
    // Report the shape, never the value, so a mistyped var is diagnosable
    // without echoing environment contents into the log.
    reasons.push(
      process.env.ENABLE_DEV_LOGIN === undefined
        ? "ENABLE_DEV_LOGIN is not set"
        : `ENABLE_DEV_LOGIN is set but not exactly "true" (length ${process.env.ENABLE_DEV_LOGIN.length})`,
    );
  }
  if (!LOOPBACK_HOST.test(host)) reasons.push(`host "${host}" is not loopback`);
  return reasons;
}

/**
 * Silent check. Use where the gate runs on ordinary traffic — the dashboard
 * layout renders on every request, so a log line per render would be noise.
 */
export async function isDevLoginAllowedQuiet(): Promise<boolean> {
  return (await devLoginBlockers()).length === 0;
}

/**
 * Logging check. Use where someone is deliberately trying to reach the
 * switcher, since an unexplained 404 is otherwise impossible to debug.
 */
export async function isDevLoginAllowed(): Promise<boolean> {
  const reasons = await devLoginBlockers();
  if (reasons.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[dev-login] refused: ${reasons.join("; ")}`);
    }
    return false;
  }
  return true;
}
