import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/utils/helpers/role";

export type PinGateDecision = { kind: "ok" } | { kind: "must_set_pin" };

/**
 * Clinical providers must have a signing PIN before they can use the portal.
 * Invite-signup providers create one during signup, so this only ever fires
 * for accounts created by manual (offline) onboarding, where `pin_hash` is
 * left NULL on purpose — an admin must never know a provider's PIN.
 *
 * Runs AFTER the MFA gate in the dashboard layout; `/onboarding/pin` checks
 * MFA itself so the PIN can't be set from a password-only session.
 */
export async function evaluatePinGate(
  userId: string,
  role: UserRole,
): Promise<PinGateDecision> {
  if (role !== "clinical_provider") return { kind: "ok" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("provider_credentials")
    .select("pin_hash")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.pin_hash ? { kind: "ok" } : { kind: "must_set_pin" };
}
