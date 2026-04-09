export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getMarketingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import MarketingCards from "./(sections)/MarketingCards";
import { PageHeader } from "@/app/(components)/PageHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketing",
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const materials = await getMarketingMaterials();

  return (
    <>
      <PageHeader title="Marketing" subtitle="Your marketing materials & resources" />
      <Providers materials={materials}>
        <MarketingCards />
      </Providers>
    </>
  );
}
