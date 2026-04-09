import type { Metadata } from "next";
import Providers from "./(sections)/Providers";
import RepHero from "./(sections)/RepHero";
import QuickLogBanner from "./(sections)/QuickLogBanner";
import RepKpiRow from "./(sections)/RepKpiRow";
import RepTables from "./(sections)/RepTables";

export const metadata: Metadata = { title: "My Performance" };

export default function RepPerformancePage() {
  return (
    <Providers>
      <div className="p-4 md:p-8 mx-auto">
        <RepHero />
        <QuickLogBanner />
        <RepKpiRow />
        <RepTables />
      </div>
    </Providers>
  );
}
