import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SmsMfaChallengeForm } from "./(sections)/SmsMfaChallengeForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isSalesRep } from "@/utils/helpers/role";
import { isValidE164, maskPhone } from "@/utils/helpers/phone";

export const metadata: Metadata = { title: "Verify your phone" };
export const dynamic = "force-dynamic";

/**
 * SMS MFA challenge page for sales reps. Mirrors /sign-in/mfa for TOTP roles.
 *
 * Living outside the dashboard layout means the layout's MFA gate can't
 * redirect us back to ourselves — that loop bit us with /sign-in/mfa once
 * (see comment in that file) and the same caveat applies here.
 *
 * Auto-sends a code on first render so the user lands on the form ready to
 * type. If Twilio errors (rate limit, etc.), we still render the form and
 * surface the error inline — Resend can be tried after the cooldown.
 *
 * Redirects:
 *   - not signed in              → /sign-in
 *   - non-rep role               → /sign-in/mfa  (TOTP path)
 *   - rep without verified phone → /onboarding/phone
 *   - rep with active SMS session → /dashboard   (gate already satisfied)
 */
export default async function SmsMfaPage() {
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
  if (!isSalesRep(profile.role)) redirect("/sign-in/mfa");

  const phone = profile.phone;
  if (!phone || !profile.phone_verified_at || !isValidE164(phone)) {
    redirect("/onboarding/phone");
  }

  if (await hasActiveSmsMfaSession(user.id)) {
    redirect("/dashboard");
  }

  // Fire-and-forget initial send. Errors are non-fatal — the form's Resend
  // gives the user a way to retry, and Twilio's rate limit means a duplicate
  // send within the cooldown window will be a no-op anyway.
  await sendVerificationCode(phone).catch(() => {});

  return <SmsMfaChallengeForm maskedPhone={maskPhone(phone)} />;
}
