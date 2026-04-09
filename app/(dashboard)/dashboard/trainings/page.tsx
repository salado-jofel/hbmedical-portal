import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getTrainingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import TrainingCards from "./(sections)/TrainingCards";
import { PageHeader } from "@/app/(components)/PageHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainings",
};

export const dynamic = "force-dynamic";

export default async function TrainingsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const trainings = await getTrainingMaterials();

  return (
    <>
      <PageHeader title="Trainings" subtitle="Your training documents & resources" />
      <Providers trainings={trainings}>
        <TrainingCards />
      </Providers>
    </>
  );
}
