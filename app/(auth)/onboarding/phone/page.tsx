import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneEnrollmentForm } from "./(sections)/PhoneEnrollmentForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { tryClaimSmsMfaSend } from "@/lib/supabase/sms-mfa-throttle";
import { isMfaMandatoryRole } from "@/lib/supabase/mfa-gate";
import { isValidE164 } from "@/utils/helpers/phone";
import type { UserRole } from "@/utils/helpers/role";

export const metadata: Metadata = { title: "Enroll your phone" };
export const dynamic = "force-dynamic";

/**
 * One-time phone enrollment for sales reps. Reached when:
 *   - rep signs in for the first time after the SMS-MFA rollout (no
 *     phone_verified_at set yet)
 *   - admin reset the phone (phone or phone_verified_at cleared)
 *
 * If the rep has a phone on profiles.phone (entered during signup or
 * invite-signup) we skip straight to the code-entry phase: the page
 * fires Twilio Verify on render and the form mounts in "code" phase
 * with the existing number locked in. The rep can override via
 * "Use a different number".
 *
 * Auto-send is gated by `tryClaimSmsMfaSend` — same atomic 30s throttle
 * used by /sign-in/sms-mfa. Without it, refresh / multi-tab / back-button
 * during onboarding fires repeated SMSes to the same phone and trips
 * Twilio's fraud filter.
 *
 * Living outside the dashboard layout for the same reason as
 * /sign-in/sms-mfa — the layout's MFA gate redirects HERE, so this
 * page must not trigger it.
 *
 * Redirects:
 *   - not signed in              → /sign-in
 *   - non-rep role               → /dashboard  (only reps use SMS path)
 *   - rep already enrolled       → /sign-in/sms-mfa (challenge instead)
 */
export default async function PhoneEnrollmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) redirect("/sign-in");
  // Roles outside the MFA-mandatory set don't go through SMS MFA at all.
  if (!isMfaMandatoryRole(profile.role as UserRole)) redirect("/dashboard");

  if (profile.phone && profile.phone_verified_at) {
    redirect("/sign-in/sms-mfa");
  }

  // Rep has a phone from signup but never verified it via SMS MFA. Try to
  // claim a send slot; if claimed, fire Twilio and pass any error inline.
  // Slot is intentionally consumed even on failure — Twilio errors are
  // mostly persistent (geo, fraud) and immediate retries don't help.
  const existingPhone =
    profile.phone && isValidE164(profile.phone) ? profile.phone : undefined;

  let initialSendError: string | null = null;

  if (existingPhone) {
    const { claimed } = await tryClaimSmsMfaSend(user.id);
    if (claimed) {
      const result = await sendVerificationCode(existingPhone);
      if (!result.ok) initialSendError = result.error;
    }
  }

  return (
    <PhoneEnrollmentForm
      initialPhone={existingPhone}
      initialSendError={initialSendError}
    />
  );
}
