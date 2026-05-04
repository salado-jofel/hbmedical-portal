"use server";

import { createClient } from "@/lib/supabase/server";
import {
  sendVerificationCode,
  checkVerificationCode,
} from "@/lib/sms/twilio-verify";
import { createSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isValidE164 } from "@/utils/helpers/phone";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Send (or re-send) a verification code via Twilio Verify to the current
 * user's verified phone. Server-trusted: pulls phone from profiles, never
 * accepts it from the client. If phone isn't enrolled yet, the caller
 * should have been routed to /onboarding/phone instead — we surface a
 * clear error rather than silently failing.
 */
export async function requestSmsMfaCode(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  const phone = profile?.phone;
  if (!phone || !profile?.phone_verified_at || !isValidE164(phone)) {
    return {
      success: false,
      error: "No verified phone on file. Enroll a phone number first.",
    };
  }

  const result = await sendVerificationCode(phone);
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * Verify a code against the pending Twilio verification. On approval,
 * create an SMS MFA session row and set the session cookie. Caller
 * (the form) navigates to /dashboard on success — the dashboard layout
 * gate will see the active session and let them through.
 */
export async function verifySmsMfaCode(
  code: string,
): Promise<ActionResult> {
  const trimmed = code.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    return { success: false, error: "Enter the code from the SMS." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  const phone = profile?.phone;
  if (!phone || !profile?.phone_verified_at) {
    return { success: false, error: "No verified phone on file." };
  }

  const result = await checkVerificationCode(phone, trimmed);
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  if (!result.approved) {
    return { success: false, error: "Code is invalid or expired." };
  }

  await createSmsMfaSession(user.id);
  return { success: true };
}
