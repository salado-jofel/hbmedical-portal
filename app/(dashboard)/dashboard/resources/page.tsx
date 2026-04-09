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
import Providers from "./(sections)/Providers";
import ResourcesView from "./(sections)/ResourcesView";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const [marketing, contracts, trainings, hospitalOnboarding] = await Promise.all([
    getMarketingMaterials(),
    getContractMaterials(),
    getTrainingMaterials(),
    getHospitalOnboardingMaterials(),
  ]);

  return (
    <Providers
      marketing={marketing}
      contracts={contracts}
      trainings={trainings}
      hospitalOnboarding={hospitalOnboarding}
    >
      <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
        <ResourcesView />
      </div>
    </Providers>
  );
}
