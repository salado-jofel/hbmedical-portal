import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getContractMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import { PageHeader } from "@/app/(components)/PageHeader";
import { Metadata } from "next";
import ContractCards from "./(sections)/ContractCards";

export const metadata: Metadata = {
  title: "Contracts",
};

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const contracts = await getContractMaterials();

  return (
    <>
      <PageHeader title="Contracts" subtitle="Your contractor documents & forms" />
      <Providers contracts={contracts}>
        <ContractCards />
      </Providers>
    </>
  );
}
