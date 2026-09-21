import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getSalesRepsWithFacilities } from "@/app/(dashboard)/dashboard/onboarding/(services)/onboarding-read-actions";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import { PageHeader } from "@/app/(components)/PageHeader";
import { ManualOnboardingWizard } from "./(sections)/ManualOnboardingWizard";

export const metadata: Metadata = { title: "Onboard Clinic Manually" };
export const dynamic = "force-dynamic";

export default async function ManualOnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  const adminUser = isAdmin(role);
  if (!adminUser && !isSalesRep(role)) redirect("/dashboard");

  const user = await getCurrentUserOrThrow(supabase);

  // Reps must have their office set up first — same rule as the invite link.
  if (!adminUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_completed_setup")
      .eq("id", user.id)
      .single();
    if (!profile?.has_completed_setup) redirect("/dashboard/onboarding");
  }

  const reps: RepWithFacility[] = adminUser ? await getSalesRepsWithFacilities() : [];

  return (
    <>
      <PageHeader
        title="Onboard Clinic Manually"
        subtitle="Enter the clinic's details and upload the agreements they signed on paper"
      />
      <ManualOnboardingWizard isAdmin={adminUser} reps={reps} />
    </>
  );
}
