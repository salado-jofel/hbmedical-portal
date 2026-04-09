import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getHospitalOnboardingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import HospitalOnboardingCards from "./(sections)/HospitalOnboardingCards";
import { PageHeader } from "@/app/(components)/PageHeader";
import { Metadata } from "next";
import { getUserData } from "../(services)/actions";

export const metadata: Metadata = {
  title: "Hospital Onboarding",
};

export const dynamic = "force-dynamic";

export default async function HospitalOnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const hospitalOnboardings = await getHospitalOnboardingMaterials();

  return (
    <>
      <PageHeader title="Hospital Onboarding" subtitle="Your onboarding documents & resources" />
      <Providers hospitalOnboardings={hospitalOnboardings}>
        <HospitalOnboardingCards />
      </Providers>
    </>
  );
}
