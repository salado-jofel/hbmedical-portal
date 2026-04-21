export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getMarketingMaterials } from "../marketing/(services)/actions";
import { getContractMaterials } from "../contracts/(services)/actions";
import { getTrainingMaterials } from "../trainings/(services)/actions";
import { getHospitalOnboardingMaterials } from "../hospital-onboarding/(services)/actions";
import {
  getMySignedSalesRepContracts,
  getAllSignedSalesRepContracts,
  getRepOfficesForFilter,
  getSalesRepsForFilter,
} from "./(services)/signed-contracts-actions";
import Providers from "./(sections)/Providers";
import ResourcesView from "./(sections)/ResourcesView";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const [marketing, contracts, trainings, hospitalOnboarding] =
    await Promise.all([
      getMarketingMaterials(),
      getContractMaterials(),
      getTrainingMaterials(),
      getHospitalOnboardingMaterials(),
    ]);

  const [signedContracts, repOffices, salesReps] = await Promise.all([
    isAdmin(role)
      ? getAllSignedSalesRepContracts()
      : isSalesRep(role)
        ? getMySignedSalesRepContracts()
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
