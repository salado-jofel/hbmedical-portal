import type { UserRole } from "@/utils/helpers/role";
import { createClient } from "@/lib/supabase/server";

/**
 * Roles where TOTP MFA is mandatory. These roles can read or modify PHI
 * across many patients (admin sees everything, clinical_provider signs
 * orders + reads their facility's patients), so HIPAA "reasonable
 * authentication" pushes them above single-factor.
 *
 * Other roles (clinical_staff, sales_representative, support_staff) can
 * voluntarily enroll on the Settings → Security tab.
 */
export const MFA_MANDATORY_ROLES = new Set<UserRole>([
  "admin",
  "clinical_provider",
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
