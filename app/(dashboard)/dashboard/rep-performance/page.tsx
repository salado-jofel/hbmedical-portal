import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import RepHero from "./(sections)/RepHero";
import RepKpiRow from "./(sections)/RepKpiRow";
import RepTables from "./(sections)/RepTables";
import AdminQuotaBoard from "./(sections)/AdminQuotaBoard";
import TierBreakdown from "./(sections)/TierBreakdown";
import { AdminRevenueTrend } from "./(sections)/AdminRevenueTrend";
import { AdminRepLeaderboard } from "./(sections)/AdminRepLeaderboard";
import { AdminQuotaAttainment } from "./(sections)/AdminQuotaAttainment";
import { AdminTeamFunnel } from "./(sections)/AdminTeamFunnel";
import {
  getRepPerformanceSummary,
  getQuotas,
  getAdminPerformanceExtras,
  type IAdminPerformanceExtras,
} from "./(services)/actions";
import type { IRepPerformanceSummary, IQuota } from "@/utils/interfaces/quotas";

export const metadata: Metadata = { title: "My Performance" };
export const dynamic = "force-dynamic";

const EMPTY_EXTRAS: IAdminPerformanceExtras = {
  monthlyByRep: [],
  reps: [],
  repRanking: [],
  quotaAttainment: [],
  teamFunnel: [],
};

export default async function RepPerformancePage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const adminUser = isAdmin(role);
  const repView = isSalesRep(role);

  const [summary, quotas, adminExtras] = await Promise.all([
    getRepPerformanceSummary().catch((e) => {
      console.error("[rep-performance/page] getRepPerformanceSummary:", e);
      return null as IRepPerformanceSummary | null;
    }),
    getQuotas().catch((e) => {
      console.error("[rep-performance/page] getQuotas:", e);
      return [] as IQuota[];
    }),
    adminUser
      ? getAdminPerformanceExtras().catch((e) => {
          console.error("[rep-performance/page] getAdminPerformanceExtras:", e);
          return EMPTY_EXTRAS;
        })
      : Promise.resolve(EMPTY_EXTRAS),
  ]);

  return (
    <Providers summary={summary} quotas={quotas}>
      <PageHeader
        title={repView ? "My Performance" : "Rep Performance"}
        subtitle={repView ? "Track your sales and quota progress" : "Track all rep quotas and performance"}
      />
      {repView ? (
        <>
          <RepHero />
          <RepKpiRow />
          <TierBreakdown />
          <RepTables />
        </>
      ) : (
        <>
          <TierBreakdown />

          <div className="mb-5">
            <AdminRevenueTrend data={adminExtras.monthlyByRep} reps={adminExtras.reps} />
          </div>

          <div className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AdminRepLeaderboard data={adminExtras.repRanking} />
            <AdminQuotaAttainment data={adminExtras.quotaAttainment} />
          </div>

          <div className="mb-5">
            <AdminTeamFunnel data={adminExtras.teamFunnel} />
          </div>

          <AdminQuotaBoard />
        </>
      )}
    </Providers>
  );
}
