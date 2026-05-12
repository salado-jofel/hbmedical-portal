"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasActiveSmsMfaSession,
  revokeCurrentSmsMfaSession,
} from "@/lib/supabase/sms-mfa-session";
import { isMfaMandatoryRole } from "@/lib/supabase/mfa-gate";
import type { UserRole } from "@/utils/helpers/role";
import { isValidE164 } from "@/utils/helpers/phone";

type ActionResult =
  | { success: true }
  | { success: false; error: string; needsMfa?: boolean };

/**
 * Apply a new password from the recovery-email flow.
 *
 * Why a server action with the admin client instead of the client-side
 * `supabase.auth.updateUser({ password })`:
 *
 *   The legacy native MFA factors that lived in `auth.mfa_factors` from the
 *   pre-SMS-migration TOTP era make Supabase reject password updates from an
 *   AAL1 recovery session ("AAL2 session is required to update email or
 *   password when MFA is enabled"). The recovery link only ever issues an
 *   AAL1 session, so the user can never satisfy that check on the password
 *   reset form without first elevating.
 *
 *   We elevate at OUR layer instead — the SMS MFA challenge (Twilio Verify
 *   + sms_mfa_sessions table) IS the second factor. Once that challenge is
 *   passed, this action uses the service role to set the password directly,
 *   bypassing Supabase's stale native MFA check. The user-facing security
 *   posture is unchanged (they still have to pass SMS challenge) — we just
 *   stop relying on Supabase's own AAL2 elevator, which doesn't know about
 *   our SMS factor.
 *
 * Gate logic:
 *   - Caller must have a valid Supabase session (the recovery session).
 *   - If the account's role is MFA-mandatory and a verified phone is on
 *     file, an active SMS MFA session is required. If absent, we return
 *     `needsMfa: true` so the form can route the user to the challenge.
 *   - Otherwise the recovery session alone is sufficient.
 */
export async function resetPasswordAfterMfa(
  password: string,
): Promise<ActionResult> {
  if (typeof password !== "string" || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Your recovery session has expired. Request a new link." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? null) as UserRole;
  const phone = profile?.phone ?? null;
  const phoneVerified =
    !!phone && !!profile?.phone_verified_at && isValidE164(phone);

  // Enforce the SMS factor when both (a) the role mandates MFA and (b) the
  // user has actually enrolled a phone. Accounts that never finished phone
  // enrollment shouldn't be permanently locked out of password recovery —
  // they fall through to the recovery-session-only path.
  if (isMfaMandatoryRole(role) && phoneVerified) {
    const verified = await hasActiveSmsMfaSession(user.id);
    if (!verified) {
      return {
        success: false,
        error: "Verify your phone before resetting your password.",
        needsMfa: true,
      };
    }
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
  });
  if (updateError) {
    console.error("[resetPasswordAfterMfa] update error:", updateError);
    return { success: false, error: updateError.message ?? "Failed to update password." };
  }

  // Tear down both sessions so the user lands on /sign-in fresh. Anyone with
  // a copy of the (now-revoked) cookies can't continue acting on the
  // pre-reset account.
  await revokeCurrentSmsMfaSession().catch(() => {});
  await supabase.auth.signOut().catch(() => {});

  return { success: true };
}
