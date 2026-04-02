import { getTrainingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import TrainingCards from "./(sections)/TrainingCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainings",
};

export default async function TrainingsPage() {
  const trainings = await getTrainingMaterials();

  return (
    <Providers trainings={trainings}>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <DashboardHeader
          title="Trainings"
          description="Your training documents & resources"
        />
        <TrainingCards />
      </div>
    </Providers>
  );
}
