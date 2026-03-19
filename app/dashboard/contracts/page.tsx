import { getContractMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import ContractCards from "./(sections)/ContractCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export default async function ContractsPage() {
  const contracts = await getContractMaterials();

  return (
    <Providers contracts={contracts}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Contracts"
          description="Your contractor documents & forms"
        />
        <ContractCards />
      </div>
    </Providers>
  );
}
