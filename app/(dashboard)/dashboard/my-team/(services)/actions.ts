"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import type { IRepTreeNode, ISubRepDetail, ICommissionHistoryRow } from "@/utils/interfaces/my-team";
import { getAccountsWithMetrics } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";

export async function getMySubReps() {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const { data: hierarchy } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", user.id);

  if (!hierarchy || hierarchy.length === 0) return [];

  const childIds = hierarchy.map((h) => h.child_rep_id);

  const { data: subReps } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status, role")
    .in("id", childIds)
    .order("first_name");

  if (!subReps) return [];

  const enriched = await Promise.all(
    subReps.map(async (rep) => {
      const { count: accountCount } = await adminClient
        .from("facilities")
        .select("id", { count: "exact", head: true })
        .eq("assigned_rep", rep.id)
        .neq("facility_type", "rep_office");

      const { data: repFacilities } = await adminClient
        .from("facilities")
        .select("id")
        .eq("assigned_rep", rep.id);

      const facilityIds = (repFacilities || []).map((f) => f.id);

      let orderCount = 0;
      let revenue = 0;

      if (facilityIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, order_items(total_amount)")
          .in("facility_id", facilityIds)
          .neq("order_status", "canceled");

        orderCount = orders?.length || 0;
        revenue = (orders || []).reduce((sum, o) => {
          const itemTotal = (
            o.order_items as { total_amount: string | number }[]
          ).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          return sum + itemTotal;
        }, 0);
      }

      const { data: rate } = await adminClient
        .from("commission_rates")
        .select("rate_percent, override_percent")
        .eq("rep_id", rep.id)
        .is("effective_to", null)
        .maybeSingle();

      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { data: commRows } = await adminClient
        .from("commissions")
        .select("final_amount, commission_amount, adjustment")
        .eq("rep_id", rep.id)
        .eq("payout_period", currentPeriod)
        .neq("status", "void");
      const commissionEarned = (commRows ?? []).reduce((sum: number, c: any) => {
        return sum + (c.final_amount != null
          ? Number(c.final_amount)
          : Number(c.commission_amount) + Number(c.adjustment ?? 0));
      }, 0);

      return {
        ...rep,
        accountCount: accountCount || 0,
        orderCount,
        revenue,
        commissionRate: rate?.rate_percent || 0,
        overridePercent: rate?.override_percent || 0,
        commissionEarned,
      };
    }),
  );

  return enriched;
}

export async function getRepTree(): Promise<IRepTreeNode[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const { data: reps } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, status")
    .eq("role", "sales_representative")
    .order("first_name");
  const repList = reps ?? [];
  if (repList.length === 0) return [];

  const repIds = repList.map((r: any) => r.id as string);

  const { data: edges } = await adminClient
    .from("rep_hierarchy")
    .select("parent_rep_id, child_rep_id")
    .in("child_rep_id", repIds);
  const parentByChild: Record<string, string> = {};
  for (const e of edges ?? []) parentByChild[e.child_rep_id] = e.parent_rep_id;

  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, assigned_rep")
    .in("assigned_rep", repIds)
    .neq("facility_type", "rep_office");
  const facilitiesByRep: Record<string, string[]> = {};
  const accountCountByRep: Record<string, number> = {};
  for (const f of facs ?? []) {
    const r = f.assigned_rep as string;
    (facilitiesByRep[r] ??= []).push(f.id as string);
    accountCountByRep[r] = (accountCountByRep[r] ?? 0) + 1;
  }

  const allFacilityIds = Object.values(facilitiesByRep).flat();
  const orderCountByRep: Record<string, number> = {};
  if (allFacilityIds.length > 0) {
    const { data: orders } = await adminClient
      .from("orders")
      .select("id, facility_id")
      .in("facility_id", allFacilityIds)
      .neq("order_status", "canceled");
    const repByFacility: Record<string, string> = {};
    for (const r of repIds) for (const fid of facilitiesByRep[r] ?? []) repByFacility[fid] = r;
    for (const o of orders ?? []) {
      const r = repByFacility[o.facility_id as string];
      if (r) orderCountByRep[r] = (orderCountByRep[r] ?? 0) + 1;
    }
  }

  const { data: rates } = await adminClient
    .from("commission_rates")
    .select("rep_id, rate_percent, override_percent")
    .in("rep_id", repIds)
    .is("effective_to", null);
  const rateByRep: Record<string, { rate_percent: number; override_percent: number }> = {};
  for (const r of rates ?? []) {
    rateByRep[r.rep_id as string] = {
      rate_percent: Number(r.rate_percent ?? 0),
      override_percent: Number(r.override_percent ?? 0),
    };
  }

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: commRows } = await adminClient
    .from("commissions")
    .select("rep_id, final_amount, commission_amount, adjustment, status")
    .in("rep_id", repIds)
    .eq("payout_period", currentPeriod)
    .neq("status", "void");
  const commissionByRep: Record<string, number> = {};
  for (const c of commRows ?? []) {
    const rid = c.rep_id as string;
    const amt = c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0);
    commissionByRep[rid] = (commissionByRep[rid] ?? 0) + amt;
  }

  const nodeById = new Map<string, IRepTreeNode>();
  for (const r of repList) {
    const id = r.id as string;
    nodeById.set(id, {
      id,
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      email: r.email ?? null,
      status: r.status ?? null,
      accountCount: accountCountByRep[id] ?? 0,
      orderCount: orderCountByRep[id] ?? 0,
      commissionEarned: commissionByRep[id] ?? 0,
      commissionRate: rateByRep[id]?.rate_percent ?? 0,
      overridePercent: rateByRep[id]?.override_percent ?? 0,
      children: [],
    });
  }

  const roots: IRepTreeNode[] = [];
  for (const node of nodeById.values()) {
    const parentId = parentByChild[node.id];
    if (parentId && nodeById.has(parentId)) {
      nodeById.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getSubRepDetail(subRepId: string): Promise<ISubRepDetail | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  const adminClient = createAdminClient();

  if (!isAdmin(role)) {
    if (!isSalesRep(role)) return null;
    const { data: edge } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .eq("parent_rep_id", user.id)
      .eq("child_rep_id", subRepId)
      .maybeSingle();
    if (!edge) return null;
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status")
    .eq("id", subRepId)
    .maybeSingle();
  if (!profile) return null;

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endISO   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: quotaRow } = await adminClient
    .from("sales_quotas")
    .select("target_amount")
    .eq("rep_id", subRepId)
    .eq("period", currentPeriod)
    .maybeSingle();
  const quota = quotaRow ? Number(quotaRow.target_amount) : null;

  const { data: facs } = await adminClient
    .from("facilities")
    .select("id")
    .eq("assigned_rep", subRepId);
  const facilityIds = (facs ?? []).map((f: any) => f.id as string);

  let paidOrders = 0;
  let actualRevenue = 0;
  if (facilityIds.length > 0) {
    const { data: paid } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .eq("payment_status", "paid")
      .gte("paid_at", startISO)
      .lt("paid_at", endISO);
    paidOrders = (paid ?? []).length;
    const paidIds = (paid ?? []).map((o: any) => o.id as string);
    if (paidIds.length > 0) {
      const { data: items } = await adminClient
        .from("order_items")
        .select("total_amount")
        .in("order_id", paidIds);
      actualRevenue = (items ?? []).reduce(
        (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
      );
    }
  }

  const { data: commRowsThisPeriod } = await adminClient
    .from("commissions")
    .select("final_amount, commission_amount, adjustment")
    .eq("rep_id", subRepId)
    .eq("payout_period", currentPeriod)
    .neq("status", "void");
  const commissionEarned = (commRowsThisPeriod ?? []).reduce((sum: number, c: any) => {
    return sum + (c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0));
  }, 0);

  let pipelineRevenue = 0;
  if (facilityIds.length > 0) {
    const { data: pipelineOrders } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .in("order_status", ["approved", "shipped"]);
    const pipelineIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
    if (pipelineIds.length > 0) {
      const { data: items } = await adminClient
        .from("order_items")
        .select("total_amount")
        .in("order_id", pipelineIds);
      pipelineRevenue = (items ?? []).reduce(
        (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
      );
    }
  }

  const { data: rate } = await adminClient
    .from("commission_rates")
    .select("rate_percent, override_percent")
    .eq("rep_id", subRepId)
    .is("effective_to", null)
    .maybeSingle();
  const commissionRate = Number(rate?.rate_percent ?? 0);
  const overridePercent = Number(rate?.override_percent ?? 0);

  const overrideEarnedThisPeriod = isAdmin(role)
    ? null
    : commissionEarned * (overridePercent / 100);

  const { data: history } = await adminClient
    .from("commissions")
    .select("id, payout_period, commission_amount, adjustment, final_amount, status")
    .eq("rep_id", subRepId)
    .order("payout_period", { ascending: false })
    .limit(12);
  const historyRows: ICommissionHistoryRow[] = (history ?? []).map((h: any) => {
    const gross = Number(h.commission_amount ?? 0);
    const adjustment = Number(h.adjustment ?? 0);
    const final = h.final_amount != null ? Number(h.final_amount) : gross + adjustment;
    const yourOverride = isAdmin(role) ? null : final * (overridePercent / 100);
    return {
      id: h.id,
      period: h.payout_period,
      commission_amount: gross,
      adjustment,
      final_amount: final,
      your_override_amount: yourOverride,
      status: h.status,
    };
  });

  const accounts = await getAccountsWithMetrics("this_month", { repIdOverride: subRepId });

  const avgOrderValue = paidOrders > 0 ? actualRevenue / paidOrders : 0;
  const attainmentPct = quota != null && quota > 0 ? (actualRevenue / quota) * 100 : null;

  return {
    id: profile.id,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    status: profile.status ?? null,
    currentPeriod,
    actualRevenue,
    paidOrders,
    commissionEarned,
    avgOrderValue,
    pipelineRevenue,
    overrideEarnedThisPeriod,
    commissionRate,
    overridePercent,
    quota,
    attainmentPct,
    history: historyRows,
    accounts: accounts as unknown[],
  };
}
