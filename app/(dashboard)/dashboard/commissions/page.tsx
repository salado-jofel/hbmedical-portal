import type { Metadata } from "next";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import CommissionCalculator from "./(sections)/CommissionCalculator";
import PayoutTable from "./(sections)/PayoutTable";
import CommissionLedger from "./(sections)/CommissionLedger";

export const metadata: Metadata = { title: "Commissions" };

export default function CommissionsPage() {
  return (
    <Providers>
      <PageHeader title="Commissions" subtitle="Commission calculator and payout tracking" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommissionCalculator />
        <PayoutTable />
      </div>
      <CommissionLedger />
    </Providers>
  );
}
