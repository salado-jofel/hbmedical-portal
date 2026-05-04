import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SMS MFA session: a server-side row that proves a sales rep completed
 * Twilio Verify recently. Cookie holds the raw token; DB holds the SHA-256
 * hash. The cookie is httpOnly + secure + signed by Next on outbound, and
 * we double-check user_id on every gate call so a stolen cookie alone
 * can't grant access without also having the matching Supabase session.
 *
 * Layout responsibility:
 *   - signIn server action  → creates session after Twilio approves the code
 *   - dashboard layout gate → calls hasActiveSmsMfaSession() before render
 *   - signOut / revoke      → clear the cookie + mark row revoked
 */

const COOKIE_NAME = "mp_sms_mfa";
const SESSION_TTL_HOURS = 12;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new SMS MFA session for the given user. Inserts a row, sets the
 * httpOnly cookie, and returns nothing — caller redirects after.
 */
export async function createSmsMfaSession(userId: string): Promise<void> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const headerList = await headers();
  const userAgent = headerList.get("user-agent");
  // x-forwarded-for is the cleanest IP source on Vercel/most proxies. Fall
  // back to x-real-ip. Either may be a comma-separated list — take the first.
  const xff = headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip");
  const ipAddress = xff?.split(",")[0]?.trim() ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from("sms_mfa_sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    user_agent: userAgent,
    ip_address: ipAddress,
  });
  if (error) {
    throw new Error(`Failed to create SMS MFA session: ${error.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/**
 * Check whether the current request has a valid SMS MFA session for the
 * given user. Returns true only if all of:
 *   - cookie present
 *   - DB row matches token_hash
 *   - row.user_id === userId
 *   - row.expires_at > now
 *   - row.revoked_at IS NULL
 */
export async function hasActiveSmsMfaSession(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const tokenHash = hashToken(raw);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sms_mfa_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return false;
  if (data.user_id !== userId) return false;
  if (data.revoked_at) return false;
  if (new Date(data.expires_at).getTime() <= Date.now()) return false;
  return true;
}

/**
 * Revoke the current SMS MFA session (called on sign-out, password change,
 * admin force-logout, etc.). Idempotent — a missing cookie or missing row
 * is treated as success.
 */
export async function revokeCurrentSmsMfaSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);
  if (!raw) return;

  const tokenHash = hashToken(raw);
  const admin = createAdminClient();
  await admin
    .from("sms_mfa_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
}
