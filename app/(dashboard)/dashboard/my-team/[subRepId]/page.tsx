import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getSubRepDetail } from "../(services)/actions";
import {
  getCommissionRates,
  getRepCommissionSummary,
} from "@/app/(dashboard)/dashboard/commissions/(services)/actions";
import Providers from "./(sections)/Providers";
import SubRepHero from "./(sections)/SubRepHero";
import SubRepQuotaSection from "./(sections)/SubRepQuotaSection";
import SubRepKpiRow from "./(sections)/SubRepKpiRow";
import SubRepRateSection from "./(sections)/SubRepRateSection";
import SubRepAccounts from "./(sections)/SubRepAccounts";
import SubRepCommissionHistory from "./(sections)/SubRepCommissionHistory";
import AdminApprovalsCard from "./(sections)/AdminApprovalsCard";
import AdminPayoutCard from "./(sections)/AdminPayoutCard";
import AdminSubRepsCard from "./(sections)/AdminSubRepsCard";

export const metadata: Metadata = { title: "Sub-Rep Detail" };
export const dynamic = "force-dynamic";

export default async function SubRepDetailPage({
  params,
}: {
  params: Promise<{ subRepId: string }>;
}) {
  const { subRepId } = await params;
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const adminView = isAdmin(role);

  const [detail, rates, summary] = await Promise.all([
    getSubRepDetail(subRepId),
    getCommissionRates(),
    getRepCommissionSummary(),
  ]);
  if (!detail) notFound();

  // Admin-only: pending commissions for this rep + payout account status +
  // whether this rep has a parent rep (sub-rep vs main rep) + the rep's own
  // direct sub-reps (if any). Override % only applies to sub-reps; main reps
  // have no parent to flow override to.
  interface PendingCommission {
    id: string;
    orderId: string;
    orderNumber: string;
    finalAmount: number;
    createdAt: string;
  }
  let pending: PendingCommission[] = [];
  let pendingTotal = 0;
  let approvedTotal = 0;
  let approvedCount = 0;
  const currentPeriod = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  let payoutsEnabled = false;
  let hasPayoutAccount = false;
  let isSubRep = false;
  let parentRep: { id: string; first_name: string; last_name: string } | null = null;
  let subReps: Array<{ id: string; first_name: string; last_name: string; status: string; commissionEarned: number }> = [];
  if (adminView) {
    const admin = createAdminClient();
    const [
      { data: pendingRows },
      { data: profile },
      { data: parentEdge },
      { data: childEdges },
      { data: approvedRows },
    ] = await Promise.all([
      admin
        .from("commissions")
        .select("id, order_id, final_amount, commission_amount, adjustment, created_at, order:orders!commissions_order_id_fkey(order_number)")
        .eq("rep_id", subRepId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("stripe_connect_account_id, stripe_payouts_enabled")
        .eq("id", subRepId)
        .maybeSingle(),
      admin
        .from("rep_hierarchy")
        .select("id, parent_rep_id, parent:profiles!rep_hierarchy_parent_rep_id_fkey(id, first_name, last_name)")
        .eq("child_rep_id", subRepId)
        .maybeSingle(),
      admin
        .from("rep_hierarchy")
        .select("child_rep_id")
        .eq("parent_rep_id", subRepId),
      admin
        .from("commissions")
        .select("final_amount, commission_amount, adjustment")
        .eq("rep_id", subRepId)
        .eq("payout_period", currentPeriod)
        .eq("status", "approved"),
    ]);
    pending = (pendingRows ?? []).map((c: any) => {
      const order = Array.isArray(c.order) ? c.order[0] : c.order;
      const finalAmount = c.final_amount != null
        ? Number(c.final_amount)
        : Number(c.commission_amount ?? 0) + Number(c.adjustment ?? 0);
      return {
        id: c.id as string,
        orderId: c.order_id as string,
        orderNumber: (order?.order_number as string) ?? "—",
        finalAmount,
        createdAt: c.created_at as string,
      };
    });
    pendingTotal = pending.reduce((sum, p) => sum + p.finalAmount, 0);

    approvedCount = (approvedRows ?? []).length;
    approvedTotal = (approvedRows ?? []).reduce((sum, c: any) => {
      const final = c.final_amount != null
        ? Number(c.final_amount)
        : Number(c.commission_amount ?? 0) + Number(c.adjustment ?? 0);
      return sum + final;
    }, 0);
    hasPayoutAccount = !!profile?.stripe_connect_account_id;
    payoutsEnabled = !!profile?.stripe_payouts_enabled;
    isSubRep = !!parentEdge;
    if (parentEdge) {
      const parent: any = Array.isArray((parentEdge as any).parent)
        ? (parentEdge as any).parent[0]
        : (parentEdge as any).parent;
      if (parent) {
        parentRep = {
          id: parent.id,
          first_name: parent.first_name ?? "",
          last_name: parent.last_name ?? "",
        };
      }
    }

    const childIds = (childEdges ?? []).map((e) => e.child_rep_id as string);
    if (childIds.length > 0) {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [{ data: childProfiles }, { data: childComms }] = await Promise.all([
        admin
          .from("profiles")
          .select("id, first_name, last_name, status")
          .in("id", childIds)
          .eq("has_completed_setup", true)
          .order("first_name"),
        admin
          .from("commissions")
          .select("rep_id, final_amount, commission_amount, adjustment")
          .in("rep_id", childIds)
          .eq("payout_period", currentPeriod)
          .neq("status", "void"),
      ]);
      const earnedByRep: Record<string, number> = {};
      for (const c of childComms ?? []) {
        const rid = c.rep_id as string;
        const amt = (c as any).final_amount != null
          ? Number((c as any).final_amount)
          : Number((c as any).commission_amount ?? 0) + Number((c as any).adjustment ?? 0);
        earnedByRep[rid] = (earnedByRep[rid] ?? 0) + amt;
      }
      subReps = (childProfiles ?? []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        status: p.status ?? "pending",
        commissionEarned: earnedByRep[p.id] ?? 0,
      }));
    }
  }

  return (
    <Providers detail={detail} rates={rates} summary={summary}>
      <div className="mx-auto space-y-6">
        <SubRepHero
          adminView={adminView}
          hasPayoutAccount={hasPayoutAccount}
          payoutsEnabled={payoutsEnabled}
          isSubRep={isSubRep}
          parentRep={parentRep}
        />
        {adminView && (
          <AdminApprovalsCard pending={pending} pendingTotal={pendingTotal} />
        )}
        {adminView && (
          <AdminPayoutCard
            repId={subRepId}
            repName={`${detail.first_name ?? ""} ${detail.last_name ?? ""}`.trim() || "this rep"}
            period={currentPeriod}
            approvedTotal={approvedTotal}
            approvedCount={approvedCount}
            payoutsEnabled={payoutsEnabled}
            hasPayoutAccount={hasPayoutAccount}
          />
        )}
        <SubRepQuotaSection />
        <SubRepKpiRow />
        <SubRepRateSection hideOverride={!isSubRep} />
        <SubRepAccounts />
        {adminView && <AdminSubRepsCard subReps={subReps} />}
        <SubRepCommissionHistory />
      </div>
    </Providers>
  );
}
