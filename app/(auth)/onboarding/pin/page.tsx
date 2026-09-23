import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { evaluateMfaGate } from "@/lib/supabase/mfa-gate";
import { evaluatePinGate } from "@/lib/supabase/pin-gate";
import { PinSetupForm } from "./(sections)/PinSetupForm";

export const metadata: Metadata = { title: "Create your signing PIN" };
export const dynamic = "force-dynamic";

/**
 * Blocking first-login step for providers onboarded from paper contracts.
 * Lives outside the dashboard layout (whose PIN gate redirects here). MFA
 * is enforced on this page too so the PIN is only ever created from a fully
 * verified session.
 */
export default async function PinSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const role = await getUserRole(supabase);
  if (role !== "clinical_provider") redirect("/dashboard");

  const mfa = await evaluateMfaGate(role);
  if (mfa.kind === "must_enroll_phone") redirect("/onboarding/phone");
  if (mfa.kind === "must_challenge_sms") redirect("/sign-in/sms-mfa");

  const decision = await evaluatePinGate(user.id, role);
  if (decision.kind === "ok") redirect("/dashboard");

  return <PinSetupForm firstName={user.user_metadata?.first_name ?? ""} />;
}
