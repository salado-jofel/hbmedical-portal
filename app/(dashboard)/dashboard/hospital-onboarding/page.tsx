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
  const hospitalOnboardings = await getHospitalOnboardingMaterials();

  return (
    <Providers hospitalOnboardings={hospitalOnboardings}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Hospital Onboarding"
          description="Your onboarding documents & resources"
        />
        {/* <HospitalOnboardingCards /> */}
      </div>
    </Providers>
  );
}
