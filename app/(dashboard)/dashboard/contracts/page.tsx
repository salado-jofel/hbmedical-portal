import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getContractMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { Metadata } from "next";
import ContractCards from "./(sections)/ContractCards";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const contracts = await getContractMaterials();

  return (
    <Providers contracts={contracts}>
      <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
        <DashboardHeader
          title="Contracts"
          description="Your contractor documents & forms"
        />
        <ContractCards />
      </div>
    </Providers>
  );
}
