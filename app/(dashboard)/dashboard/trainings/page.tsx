import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getTrainingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import TrainingCards from "./(sections)/TrainingCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
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
    <Providers trainings={trainings}>
      <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
        <DashboardHeader
          title="Trainings"
          description="Your training documents & resources"
        />
        <TrainingCards />
      </div>
    </Providers>
  );
}
