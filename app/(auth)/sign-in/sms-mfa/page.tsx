import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SmsMfaChallengeForm } from "./(sections)/SmsMfaChallengeForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isMfaMandatoryRole } from "@/lib/supabase/mfa-gate";
import type { UserRole } from "@/utils/helpers/role";
import { isValidE164, maskPhone } from "@/utils/helpers/phone";

// Auto-send throttle. Twilio Verify caps SMS at 5 per phone per 10 minutes;
// without throttling, a refresh/back-button on this page burns through that
// budget fast. Cookie holds the unix-second timestamp of the last server-
// triggered send for this browser+user pair.
const AUTO_SEND_COOLDOWN_COOKIE = "mp_sms_autosend_at";
const AUTO_SEND_COOLDOWN_SECONDS = 25;

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

  // Skip the auto-send if we sent one to this browser within the cooldown
  // window. Prevents reload-spamming Twilio (which silently 429s after 5
  // sends in 10 minutes) and stops the user from receiving a stream of
  // duplicate codes.
  const cookieStore = await cookies();
  const lastSentAtRaw = cookieStore.get(AUTO_SEND_COOLDOWN_COOKIE)?.value;
  const lastSentAt = lastSentAtRaw ? parseInt(lastSentAtRaw, 10) : 0;
  const now = Math.floor(Date.now() / 1000);
  const withinCooldown =
    Number.isFinite(lastSentAt) && now - lastSentAt < AUTO_SEND_COOLDOWN_SECONDS;

  let initialSendError: string | null = null;

  if (!withinCooldown) {
    const result = await sendVerificationCode(phone);
    if (result.ok) {
      cookieStore.set({
        name: AUTO_SEND_COOLDOWN_COOKIE,
        value: String(now),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: AUTO_SEND_COOLDOWN_SECONDS,
      });
    } else {
      // Surface the failure to the form so the user knows why no SMS arrived
      // (rate limit, geo permission, missing creds, etc.) instead of staring
      // at an input box and waiting.
      initialSendError = result.error;
    }
  }

  return (
    <SmsMfaChallengeForm
      maskedPhone={maskPhone(phone)}
      returnTo={returnTo}
      initialSendError={initialSendError}
      initialSendSkipped={withinCooldown}
    />
  );
}
