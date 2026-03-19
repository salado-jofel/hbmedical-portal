import { getTrainingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import TrainingCards from "./(sections)/TrainingCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export default async function TrainingsPage() {
  const trainings = await getTrainingMaterials();

  return (
    <Providers trainings={trainings}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Trainings"
          description="Your training documents & resources"
        />
        <TrainingCards />
      </div>
    </Providers>
  );
}
