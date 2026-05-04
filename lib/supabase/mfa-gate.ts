import type { UserRole } from "@/utils/helpers/role";
import { isSalesRep } from "@/utils/helpers/role";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";

/**
 * Roles where MFA is mandatory. Every workforce role in this app reads
 * PHI in some form — admin and support_staff see every facility's orders,
 * clinical_provider/clinical_staff see their facility's patient records,
 * and sales_representative sees orders for their assigned facilities
 * (including patient name, DOB, address, ICD-10). HIPAA's "reasonable
 * authentication" standard plus HHS's 2025 update treat MFA as the floor
 * for any account with PHI access, so all five roles are mandatory here.
 *
 * The factor TYPE varies by role:
 *   - sales_representative → SMS OTP via Twilio Verify (this file routes them)
 *   - all other roles      → TOTP (Supabase Auth's built-in factor)
 * Reps were split out because field reps don't reliably carry an authenticator
 * app device, and the client wanted a phone-first flow for that audience.
 */
export const MFA_MANDATORY_ROLES = new Set<UserRole>([
  "admin",
  "support_staff",
  "clinical_provider",
  "clinical_staff",
  "sales_representative",
]);

export function isMfaMandatoryRole(role: UserRole): boolean {
  return !!role && MFA_MANDATORY_ROLES.has(role);
}

export type MfaGateDecision =
  /** Pass-through. Either MFA isn't mandatory for this role, or the user
   *  has enrolled and the session is fully verified. */
  | { kind: "ok" }
  /** TOTP user has no factor enrolled. Redirect to /sign-in/mfa (enrollment). */
  | { kind: "must_enroll_totp" }
  /** TOTP user has factor but session is aal1. Redirect to /sign-in/mfa (challenge). */
  | { kind: "must_challenge_totp" }
  /** Sales rep has no verified phone. Redirect to /onboarding/phone. */
  | { kind: "must_enroll_phone" }
  /** Sales rep has verified phone but no active SMS session. Redirect to /sign-in/sms-mfa. */
  | { kind: "must_challenge_sms" };

/**
 * Server-side check for whether the current request is allowed onto the
 * dashboard given the user's role + MFA enrollment + session level.
 *
 * Call from layouts / server components that need to enforce the gate.
 * Returns "ok" if MFA isn't required for the role.
 */
export async function evaluateMfaGate(role: UserRole): Promise<MfaGateDecision> {
  if (!isMfaMandatoryRole(role)) return { kind: "ok" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "ok" };

  // ── Sales reps: SMS MFA path ────────────────────────────────────────────
  if (isSalesRep(role)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    const phoneVerified = !!profile?.phone && !!profile?.phone_verified_at;
    if (!phoneVerified) return { kind: "must_enroll_phone" };

    const hasSession = await hasActiveSmsMfaSession(user.id);
    if (!hasSession) return { kind: "must_challenge_sms" };

    return { kind: "ok" };
  }

  // ── Everyone else: TOTP path ────────────────────────────────────────────
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (!verified) return { kind: "must_enroll_totp" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { kind: "must_challenge_totp" };

  return { kind: "ok" };
}
