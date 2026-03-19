import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import FacilitiesTable from "./(sections)/FacilitiesTable";
import Providers from "./(sections)/Providers";
import { getFacilities } from "./(services)/actions";

export default async function FacilitiesPage() {
  const facilities = await getFacilities();
  return (
    <Providers facilities={facilities}>
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
        <DashboardHeader
          title="Facilities"
          description="Manage your healthcare facilities"
        />
        <FacilitiesTable />
      </div>
    </Providers>
  );
}
