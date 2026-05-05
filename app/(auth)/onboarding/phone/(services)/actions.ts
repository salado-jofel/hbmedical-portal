"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendVerificationCode,
  checkVerificationCode,
} from "@/lib/sms/twilio-verify";
import { createSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isValidE164, normalizePhoneInput } from "@/utils/helpers/phone";

type ActionResult =
  | { success: true; phoneE164: string }
  | { success: false; error: string };

type EnrollResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Step 1 of phone enrollment: user types a phone, we send a Twilio Verify
 * code. We DON'T save the phone to profiles yet — only step 2's confirm
 * locks it in once the user proves ownership. This avoids a half-state
 * where someone types the wrong number, walks away, and we have an
 * unverified phone marked on the profile that won't receive future codes.
 */
export async function startPhoneEnrollment(
  rawPhone: string,
): Promise<ActionResult> {
  const phone = normalizePhoneInput(rawPhone);
  if (!isValidE164(phone)) {
    return {
      success: false,
      error: "Enter a valid international phone (e.g., +639310259241).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const result = await sendVerificationCode(phone);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true, phoneE164: phone };
}

/**
 * Step 2 of enrollment: user enters the SMS code. On approval we:
 *   1. Save phone + phone_verified_at to profiles (admin client — RLS-safe)
 *   2. Create the first SMS MFA session (cookie + DB row)
 * The caller redirects to /dashboard after — gate sees verified phone +
 * active session and lets them in.
 */
export async function confirmPhoneEnrollment(
  phoneE164: string,
  code: string,
): Promise<EnrollResult> {
  if (!isValidE164(phoneE164)) {
    return { success: false, error: "Invalid phone number." };
  }
  const trimmed = code.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    return { success: false, error: "Enter the code from the SMS." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const result = await checkVerificationCode(phoneE164, trimmed);
  if (!result.ok) return { success: false, error: result.error };
  if (!result.approved) {
    return { success: false, error: "Code is invalid or expired." };
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      phone: phoneE164,
      phone_verified_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (updateErr) {
    return {
      success: false,
      error: `Could not save phone: ${updateErr.message}`,
    };
  }

  await createSmsMfaSession(user.id);
  return { success: true };
}
