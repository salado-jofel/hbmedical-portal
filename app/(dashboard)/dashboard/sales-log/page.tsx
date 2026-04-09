import type { Metadata } from "next";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import Providers from "./(sections)/Providers";
import SalesTable from "./(sections)/SalesTable";

export const metadata: Metadata = { title: "Sales Log" };

export default function SalesLogPage() {
  return (
    <Providers>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <DashboardHeader
          title="Sales Log"
          description="View and filter all recorded sales across reps"
        />
        <SalesTable />
      </div>
    </Providers>
  );
}
