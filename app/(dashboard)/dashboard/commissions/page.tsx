import type { Metadata } from "next";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import Providers from "./(sections)/Providers";
import CommissionCalculator from "./(sections)/CommissionCalculator";
import PayoutTable from "./(sections)/PayoutTable";
import CommissionLedger from "./(sections)/CommissionLedger";

export const metadata: Metadata = { title: "Commissions" };

export default function CommissionsPage() {
  return (
    <Providers>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Commissions"
          description="Track rep payouts and calculate earnings"
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CommissionCalculator />
          <PayoutTable />
        </div>
        <CommissionLedger />
      </div>
    </Providers>
  );
}
