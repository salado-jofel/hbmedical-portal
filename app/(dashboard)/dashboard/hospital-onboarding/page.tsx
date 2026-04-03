import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getHospitalOnboardingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import HospitalOnboardingCards from "./(sections)/HospitalOnboardingCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { Metadata } from "next";
import { getUserData } from "../(services)/actions";

export const metadata: Metadata = {
  title: "Hospital Onboarding",
};

export default async function HospitalOnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const hospitalOnboardings = await getHospitalOnboardingMaterials();

  return (
    <Providers hospitalOnboardings={hospitalOnboardings}>
      <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
        <DashboardHeader
          title="Hospital Onboarding"
          description="Your onboarding documents & resources"
        />
        <HospitalOnboardingCards />
      </div>
    </Providers>
  );
}
