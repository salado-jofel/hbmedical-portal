import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import { KpiCard } from "@/app/(components)/KpiCard";
import { formatAmount } from "@/utils/helpers/formatter";
import Providers from "./(sections)/Providers";
import PayoutTable from "./(sections)/PayoutTable";
import CommissionLedger from "./(sections)/CommissionLedger";
import TeamEarnings from "./(sections)/TeamEarnings";
import { getMySubReps } from "@/app/(dashboard)/dashboard/my-team/(services)/actions";
import type { ICommissionSummary } from "@/utils/interfaces/commissions";
import {
  getCommissionRates,
  getCommissions,
  getPayouts,
  getRepCommissionSummary,
} from "./(services)/actions";

export const metadata: Metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

const EMPTY_SUMMARY: ICommissionSummary = { totalEarned: 0, totalPending: 0, totalApproved: 0, totalPaid: 0, currentRate: null };

export default async function CommissionsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");
  // Admin commission management lives inside each rep's detail page under
  // Sales Reps. Redirect admins there so they don't hit a rep-centric UI.
  if (isAdmin(role)) redirect("/dashboard/my-team");

  // Each fetch is isolated — one failure must not crash the entire page re-render,
  // since revalidatePath (called from server actions) triggers a full re-render and
  // any thrown error surfaces as "unexpected response" on the client.
  const [rates, commissions, payouts, summary, subReps] = await Promise.all([
    getCommissionRates().catch((e) => { console.error("[commissions/page] getCommissionRates:", e); return []; }),
    getCommissions().catch((e)     => { console.error("[commissions/page] getCommissions:", e);     return []; }),
    getPayouts().catch((e)         => { console.error("[commissions/page] getPayouts:", e);         return []; }),
    getRepCommissionSummary().catch((e) => { console.error("[commissions/page] getSummary:", e);   return EMPTY_SUMMARY; }),
    getMySubReps().catch((e) => { console.error("[commissions/page] getMySubReps:", e); return []; }),
  ]);

  return (
    <>
      <PageHeader title="Commissions" subtitle="Commission rates and payout tracking" />

      <Providers rates={rates} commissions={commissions} payouts={payouts} summary={summary}>
        {/* KPI row */}
        <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
          <KpiCard label="Total Earned"    value={formatAmount(summary.totalEarned)}  accentColor="teal"   />
          <KpiCard label="Pending Approval" value={formatAmount(summary.totalPending)} accentColor="gold"   />
          <KpiCard label="Total Paid"      value={formatAmount(summary.totalPaid)}    accentColor="green"  />
          <KpiCard label="Current Rate"    value={summary.currentRate != null ? `${summary.currentRate}%` : "—"} accentColor="blue" />
        </div>

        {/* Team Earnings — sub-rep override summary */}
        <div className="mb-5">
          <TeamEarnings subReps={subReps} />
        </div>

        {/* Full-width: Ledger */}
        <div className="mb-5">
          <CommissionLedger />
        </div>

        {/* Full-width: Payouts */}
        <div className="mb-5">
          <PayoutTable />
        </div>
      </Providers>
    </>
  );
}
