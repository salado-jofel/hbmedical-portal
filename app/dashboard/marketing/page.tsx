export const dynamic = "force-dynamic";

import { getMarketingMaterials } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import MarketingCards from "./(sections)/MarketingCards";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export default async function MarketingPage() {
  const materials = await getMarketingMaterials();

  return (
    <Providers materials={materials}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Marketing"
          description="Your marketing materials & resources"
        />
        <MarketingCards />
      </div>
    </Providers>
  );
}
