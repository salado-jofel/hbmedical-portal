export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import { getMarketingMaterials } from "../marketing/(services)/actions";
import { getContractMaterials } from "../contracts/(services)/actions";
import { getTrainingMaterials } from "../trainings/(services)/actions";
import { getHospitalOnboardingMaterials } from "../hospital-onboarding/(services)/actions";
import {
  getMySignedSalesRepContracts,
  getMySignedProviderContracts,
  getAllSignedOnboardingContracts,
  getRepOfficesForFilter,
  getSalesRepsForFilter,
} from "./(services)/signed-contracts-actions";
import Providers from "./(sections)/Providers";
import ResourcesView from "./(sections)/ResourcesView";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role) && !isClinicalProvider(role)) {
    redirect("/dashboard");
  }

  const [marketing, contracts, trainings, hospitalOnboarding] =
    await Promise.all([
      getMarketingMaterials(),
      getContractMaterials(),
      getTrainingMaterials(),
      getHospitalOnboardingMaterials(),
    ]);

  // Admin sees the combined onboarding signatures (rep + provider). Sales reps
  // see only their own rep contracts. Providers see their own BAA + Product &
  // Services. Other roles get an empty array (page is already gated above).
  const [signedContracts, repOffices, salesReps] = await Promise.all([
    isAdmin(role)
      ? getAllSignedOnboardingContracts()
      : isSalesRep(role)
        ? getMySignedSalesRepContracts()
        : isClinicalProvider(role)
          ? getMySignedProviderContracts()
          : Promise.resolve([]),
    isAdmin(role) ? getRepOfficesForFilter() : Promise.resolve([]),
    isAdmin(role) ? getSalesRepsForFilter() : Promise.resolve([]),
  ]);

  return (
    <Providers
      marketing={marketing}
      contracts={contracts}
      trainings={trainings}
      hospitalOnboarding={hospitalOnboarding}
    >
      <ResourcesView
        signedContracts={signedContracts}
        repOffices={repOffices}
        salesReps={salesReps}
      />
    </Providers>
  );
}
