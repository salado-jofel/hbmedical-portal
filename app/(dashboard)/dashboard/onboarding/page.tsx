import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin, isClinicalProvider } from "@/utils/helpers/role";

export const metadata: Metadata = { title: "Onboarding" };
import {
  getMyInviteTokens,
  getSalesRepsWithFacilities,
} from "@/app/(dashboard)/dashboard/onboarding/(services)/onboarding-read-actions";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import { getMySubReps } from "@/app/(dashboard)/dashboard/onboarding/(services)/sub-rep-actions";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { OnboardingDashboard } from "./(sections)/OnboardingDashboard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const adminUser = isAdmin(role);
  if (!isSalesRep(role) && !adminUser && !isClinicalProvider(role)) redirect("/dashboard");

  const user = await getCurrentUserOrThrow(supabase);

  let hasCompletedSetup = true;
  if (!adminUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_completed_setup")
      .eq("id", user.id)
      .single();
    hasCompletedSetup = profile?.has_completed_setup ?? false;
  }

  const [tokens, repsWithFacilities, subReps] = await Promise.all([
    getMyInviteTokens(),
    adminUser ? getSalesRepsWithFacilities() : Promise.resolve([] as RepWithFacility[]),
    isSalesRep(role) ? getMySubReps() : Promise.resolve([] as ISubRep[]),
  ]);

  const isSalesRepUser = isSalesRep(role);
  const isClinicalProviderUser = isClinicalProvider(role);

  return (
    <>
      <PageHeader title="Onboarding" subtitle="Invite and manage new users" />
      <Providers tokens={tokens}>
        <OnboardingDashboard
          role={role}
          hasCompletedSetup={hasCompletedSetup}
          isAdmin={adminUser}
          isSalesRep={isSalesRepUser}
          isClinicalProvider={isClinicalProviderUser}
          repsWithFacilities={repsWithFacilities}
          subReps={subReps}
        />
      </Providers>
    </>
  );
}
