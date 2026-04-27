import type { UserRole } from "@/utils/helpers/role";
import { createClient } from "@/lib/supabase/server";

/**
 * Roles where TOTP MFA is mandatory. Every workforce role in this app reads
 * PHI in some form — admin and support_staff see every facility's orders,
 * clinical_provider/clinical_staff see their facility's patient records,
 * and sales_representative sees orders for their assigned facilities
 * (including patient name, DOB, address, ICD-10). HIPAA's "reasonable
 * authentication" standard plus HHS's 2025 update treat MFA as the floor
 * for any account with PHI access, so all five roles are mandatory here.
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
   *  has enrolled and the session is at AAL2. */
  | { kind: "ok" }
  /** User must enroll. Redirect to /dashboard/settings?tab=security. */
  | { kind: "must_enroll" }
  /** User has enrolled but the current session is still aal1. Redirect
   *  to /sign-in/mfa to step up. */
  | { kind: "must_challenge" };

/**
 * Server-side check for whether the current request is allowed onto the
 * dashboard given the user's role + MFA enrollment + session AAL.
 *
 * Call from layouts / server components that need to enforce the gate.
 * Returns "ok" if MFA isn't required for the role.
 */
export async function evaluateMfaGate(role: UserRole): Promise<MfaGateDecision> {
  if (!isMfaMandatoryRole(role)) return { kind: "ok" };

  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (!verified) return { kind: "must_enroll" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { kind: "must_challenge" };

  return { kind: "ok" };
}
