import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./(sections)/MfaChallengeForm";
import { MfaEnrollForm } from "./(sections)/MfaEnrollForm";

export const metadata: Metadata = { title: "Two-factor authentication" };
export const dynamic = "force-dynamic";

/**
 * MFA gate page. Reached when the dashboard MFA gate sees the current user
 * is in a mandatory-MFA role and one of the following:
 *   - has no verified TOTP factor → render enrollment UI
 *   - has a factor but session is aal1 → render challenge UI
 * Living outside the dashboard layout means we can never trigger the
 * layout's own gate from here, so a redirect-to-self loop is impossible.
 *
 * Redirects:
 *   - not signed in → /sign-in
 *   - aal2 AND verified factor exists → /dashboard (gate already satisfied)
 *
 * Defensive note: the aal2 redirect ALSO requires a verified factor. There's
 * an inconsistent state where the session JWT still claims aal2 but the
 * factor was deleted server-side (e.g. the user just disabled MFA from a
 * still-aal2 session, or an admin reset their factor). Without the factor
 * check, this page would redirect them back to /dashboard, the dashboard
 * MFA gate would see no factor and bounce them back here, and we'd loop.
 * This was the original "URL flicker" bug observed during testing.
 */
export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2" && verified) {
    redirect("/dashboard");
  }

  if (!verified) {
    return <MfaEnrollForm />;
  }

  return <MfaChallengeForm />;
}
