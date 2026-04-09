import type { Metadata } from "next";
import Providers from "./(sections)/Providers";
import { PageHeader } from "@/app/(components)/PageHeader";
import RepHero from "./(sections)/RepHero";
import QuickLogBanner from "./(sections)/QuickLogBanner";
import RepKpiRow from "./(sections)/RepKpiRow";
import RepTables from "./(sections)/RepTables";

export const metadata: Metadata = { title: "My Performance" };

export default function RepPerformancePage() {
  return (
    <Providers>
      <PageHeader title="My Performance" subtitle="Sales performance and quota tracking" />
      <RepHero />
      <QuickLogBanner />
      <RepKpiRow />
      <RepTables />
    </Providers>
  );
}
