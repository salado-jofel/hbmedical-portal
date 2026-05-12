import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SmsMfaChallengeForm } from "./(sections)/SmsMfaChallengeForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isMfaMandatoryRole } from "@/lib/supabase/mfa-gate";
import type { UserRole } from "@/utils/helpers/role";
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
 *   - rep with active SMS session → returnTo (default /dashboard)
 *
 * Supports `?returnTo=/some/path` so flows other than sign-in can reuse this
 * challenge (e.g. /reset-password redirects here to elevate AAL before the
 * password update). Only internal paths are honored to prevent open-redirect.
 */
function sanitizeReturnTo(raw: string | string[] | undefined): string {
  if (typeof raw !== "string") return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function SmsMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const sp = await searchParams;
  const returnTo = sanitizeReturnTo(sp.returnTo);

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
  // Roles outside the MFA-mandatory set don't go through SMS MFA.
  if (!isMfaMandatoryRole(profile.role as UserRole)) redirect(returnTo);

  const phone = profile.phone;
  if (!phone || !profile.phone_verified_at || !isValidE164(phone)) {
    redirect("/onboarding/phone");
  }

  if (await hasActiveSmsMfaSession(user.id)) {
    redirect(returnTo);
  }

  // Fire-and-forget initial send. Errors are non-fatal — the form's Resend
  // gives the user a way to retry, and Twilio's rate limit means a duplicate
  // send within the cooldown window will be a no-op anyway.
  await sendVerificationCode(phone).catch(() => {});

  return <SmsMfaChallengeForm maskedPhone={maskPhone(phone)} returnTo={returnTo} />;
}
