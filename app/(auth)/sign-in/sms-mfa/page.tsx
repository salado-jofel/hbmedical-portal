import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SmsMfaChallengeForm } from "./(sections)/SmsMfaChallengeForm";
import { sendVerificationCode } from "@/lib/sms/twilio-verify";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import {
  tryClaimSmsMfaSend,
  SMS_MFA_MIN_RESEND_MS,
} from "@/lib/supabase/sms-mfa-throttle";
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
 * Auto-send is gated by `tryClaimSmsMfaSend` (atomic DB throttle, 30s per
 * user). Lets the user land on the form ready to type without us spamming
 * Twilio every time they refresh, hit back, or open a second tab.
 *
 * Twilio failures (rate limit, geo block, bad creds, fraud lock) are
 * caught and passed to the form so it can render an inline alert instead
 * of silently showing an input that will never receive anything.
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

const FULL_COOLDOWN_SECONDS = Math.ceil(SMS_MFA_MIN_RESEND_MS / 1000);

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

  // Atomic claim before firing Twilio. If the slot is taken (a send went
  // out within the last 30s — refresh, multi-tab, back-button, redirect
  // chain), skip the call entirely and tell the form how long until the
  // user can press Resend.
  const { claimed, secondsLeft } = await tryClaimSmsMfaSend(user.id);

  let initialSendError: string | null = null;
  let initialResendSeconds = secondsLeft;

  if (claimed) {
    const result = await sendVerificationCode(phone);
    if (result.ok) {
      initialResendSeconds = FULL_COOLDOWN_SECONDS;
    } else {
      // Surface the failure inline. Keep the throttle slot claimed even on
      // failure — most Twilio errors are persistent (geo, fraud lock), so
      // retrying immediately wouldn't help, and releasing the slot would
      // re-open the burst window.
      initialSendError = result.error;
      initialResendSeconds = FULL_COOLDOWN_SECONDS;
    }
  }

  return (
    <SmsMfaChallengeForm
      maskedPhone={maskPhone(phone)}
      returnTo={returnTo}
      initialSendError={initialSendError}
      initialResendSeconds={initialResendSeconds}
    />
  );
}
