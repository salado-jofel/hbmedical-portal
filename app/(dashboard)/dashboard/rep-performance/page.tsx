import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import RepHero from "./(sections)/RepHero";
import QuickLogBanner from "./(sections)/QuickLogBanner";
import RepKpiRow from "./(sections)/RepKpiRow";
import RepTables from "./(sections)/RepTables";
import AdminQuotaBoard from "./(sections)/AdminQuotaBoard";
import TierBreakdown from "./(sections)/TierBreakdown";
import { getRepPerformanceSummary, getQuotas } from "./(services)/actions";
import type { IRepPerformanceSummary, IQuota } from "@/utils/interfaces/quotas";

export const metadata: Metadata = { title: "My Performance" };
export const dynamic = "force-dynamic";

export default async function RepPerformancePage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const [summary, quotas] = await Promise.all([
    getRepPerformanceSummary().catch((e) => {
      console.error("[rep-performance/page] getRepPerformanceSummary:", e);
      return null as IRepPerformanceSummary | null;
    }),
    getQuotas().catch((e) => {
      console.error("[rep-performance/page] getQuotas:", e);
      return [] as IQuota[];
    }),
  ]);

  const repView = isSalesRep(role);

  return (
    <Providers summary={summary} quotas={quotas}>
      <PageHeader
        title={repView ? "My Performance" : "Rep Performance"}
        subtitle={repView ? "Track your sales and quota progress" : "Track all rep quotas and performance"}
      />
      {repView ? (
        <>
          <RepHero />
          <QuickLogBanner />
          <RepKpiRow />
          <TierBreakdown />
          <RepTables />
        </>
      ) : (
        <>
          <RepHero />
          <TierBreakdown />
          <AdminQuotaBoard />
        </>
      )}
    </Providers>
  );
}
