import type { Metadata } from "next";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import SalesTable from "./(sections)/SalesTable";

export const metadata: Metadata = { title: "Sales Log" };

export default function SalesLogPage() {
  return (
    <Providers>
      <PageHeader title="Sales" subtitle="Sales log and order tracking" />
      <SalesTable />
    </Providers>
  );
}
