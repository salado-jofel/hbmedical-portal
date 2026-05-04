import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneEnrollmentForm } from "./(sections)/PhoneEnrollmentForm";
import { isSalesRep } from "@/utils/helpers/role";

export const metadata: Metadata = { title: "Enroll your phone" };
export const dynamic = "force-dynamic";

/**
 * One-time phone enrollment for sales reps. Reached when:
 *   - rep signs in for the first time (no phone on profile yet)
 *   - admin reset their phone (phone or phone_verified_at cleared)
 *
 * Living outside the dashboard layout for the same reason as /sign-in/sms-mfa
 * — the layout's MFA gate redirects HERE, so this page must not trigger it.
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

  return <PhoneEnrollmentForm />;
}
