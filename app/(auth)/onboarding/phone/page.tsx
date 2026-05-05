import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneEnrollmentForm } from "./(sections)/PhoneEnrollmentForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { isSalesRep } from "@/utils/helpers/role";
import { isValidE164 } from "@/utils/helpers/phone";

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
  if (!isSalesRep(profile.role)) redirect("/dashboard");

  if (profile.phone && profile.phone_verified_at) {
    redirect("/sign-in/sms-mfa");
  }

  // Rep has a phone from signup but never verified it via SMS MFA. Send
  // the code now so they land on the form ready to type. Errors are
  // non-fatal — the form's Resend button can retry.
  const existingPhone =
    profile.phone && isValidE164(profile.phone) ? profile.phone : undefined;
  if (existingPhone) {
    await sendVerificationCode(existingPhone).catch(() => {});
  }

  return <PhoneEnrollmentForm initialPhone={existingPhone} />;
}
