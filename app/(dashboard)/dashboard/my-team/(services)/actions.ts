"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import type { ISubRepDetail, ICommissionHistoryRow, IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";
import type { AccountPeriod } from "@/utils/interfaces/accounts";
import { getAccountsWithMetrics } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";

export async function getMySubReps(period: AccountPeriod = "this_month") {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();
  const { start: periodStart, end: periodEnd } = periodBounds(period);

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
      let ordersInPeriod = 0;
      let deliveredInPeriod = 0;

      if (facilityIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, placed_at, delivery_status, order_items(total_amount)")
          .in("facility_id", facilityIds)
          .neq("order_status", "canceled");

        orderCount = orders?.length || 0;
        revenue = (orders || []).reduce((sum, o) => {
          const itemTotal = (
            o.order_items as { total_amount: string | number }[]
          ).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          return sum + itemTotal;
        }, 0);

        for (const o of orders ?? []) {
          const placedAt = (o as any).placed_at as string | null;
          if (!placedAt) continue;
          if (periodStart && placedAt < periodStart) continue;
          if (periodEnd && placedAt >= periodEnd) continue;
          ordersInPeriod += 1;
          if ((o as any).delivery_status === "delivered") deliveredInPeriod += 1;
        }
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
        ordersInPeriod,
        deliveredInPeriod,
        commissionInPeriod: commissionEarned,
      };
    }),
  );

  return enriched;
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
    .select(
      "id, payout_period, commission_amount, adjustment, final_amount, status, order_id, created_at, order:orders!commissions_order_id_fkey(order_number)",
    )
    .eq("rep_id", subRepId)
    .order("created_at", { ascending: false })
    .limit(50);
  const historyRows: ICommissionHistoryRow[] = (history ?? []).map((h: any) => {
    const gross = Number(h.commission_amount ?? 0);
    const adjustment = Number(h.adjustment ?? 0);
    const final = h.final_amount != null ? Number(h.final_amount) : gross + adjustment;
    const yourOverride = isAdmin(role) ? null : final * (overridePercent / 100);
    const order = Array.isArray(h.order) ? h.order[0] : h.order;
    return {
      id: h.id,
      period: h.payout_period,
      order_id: (h.order_id as string) ?? null,
      order_number: (order?.order_number as string) ?? null,
      commission_amount: gross,
      adjustment,
      final_amount: final,
      your_override_amount: yourOverride,
      status: h.status,
      created_at: h.created_at as string,
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

function periodBounds(period: AccountPeriod): { start: string | null; end: string | null } {
  const now = new Date();
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return { start, end };
  }
  if (period === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
    return { start, end: null };
  }
  return { start: null, end: null };
}

async function resolveDownlineIds(
  rootId: string,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<{ directIds: string[]; allIds: string[] }> {
  const { data: directEdges } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", rootId);
  const directIds = (directEdges ?? []).map((e: any) => e.child_rep_id as string);

  const { data: allEdges } = await adminClient
    .from("rep_hierarchy")
    .select("parent_rep_id, child_rep_id");
  const childrenByParent: Record<string, string[]> = {};
  for (const e of allEdges ?? []) {
    (childrenByParent[e.parent_rep_id as string] ??= []).push(e.child_rep_id as string);
  }
  const allIds = new Set<string>();
  const stack = [...directIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (allIds.has(id)) continue;
    allIds.add(id);
    for (const child of childrenByParent[id] ?? []) stack.push(child);
  }
  return { directIds, allIds: [...allIds] };
}

export async function getRepList(
  period: AccountPeriod = "this_month",
  statusFilter: "all" | "active" | "inactive" = "all",
): Promise<IRepListRow[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  const adminClient = createAdminClient();

  let inScopeIds: string[];
  let directSet: Set<string>;

  if (isAdmin(role)) {
    const { data: allReps } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "sales_representative");
    inScopeIds = (allReps ?? []).map((r: any) => r.id as string);
    const { data: edges } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .in("child_rep_id", inScopeIds.length > 0 ? inScopeIds : ["__none__"]);
    const hasParent = new Set((edges ?? []).map((e: any) => e.child_rep_id as string));
    directSet = new Set(inScopeIds.filter((id) => !hasParent.has(id)));
  } else if (isSalesRep(role)) {
    const { directIds, allIds } = await resolveDownlineIds(user.id, adminClient);
    inScopeIds = allIds;
    directSet = new Set(directIds);
  } else {
    return [];
  }

  if (inScopeIds.length === 0) return [];

  // Hide reps who were invited but never finished setup — they have no name,
  // no data, and nothing useful to manage. Admin/sales-rep can still re-send
  // the invite via the Onboarding page.
  let profilesQuery = adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, status")
    .in("id", inScopeIds)
    .eq("has_completed_setup", true)
    .order("first_name");
  if (statusFilter !== "all") {
    profilesQuery = profilesQuery.eq("status", statusFilter);
  }
  const { data: profiles } = await profilesQuery;
  const repList = profiles ?? [];
  const filteredIds = repList.map((r: any) => r.id as string);
  if (filteredIds.length === 0) return [];

  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, assigned_rep")
    .in("assigned_rep", filteredIds)
    .neq("facility_type", "rep_office");
  const accountsByRep: Record<string, number> = {};
  const facilitiesByRep: Record<string, string[]> = {};
  for (const f of facs ?? []) {
    const r = f.assigned_rep as string;
    accountsByRep[r] = (accountsByRep[r] ?? 0) + 1;
    (facilitiesByRep[r] ??= []).push(f.id as string);
  }

  const { start, end } = periodBounds(period);
  const allFacilityIds = Object.values(facilitiesByRep).flat();
  const ordersByRep: Record<string, number> = {};
  const deliveredByRep: Record<string, number> = {};
  if (allFacilityIds.length > 0) {
    let q = adminClient
      .from("orders")
      .select("id, facility_id, delivery_status, placed_at")
      .in("facility_id", allFacilityIds)
      .neq("order_status", "canceled");
    if (start) q = q.gte("placed_at", start);
    if (end) q = q.lt("placed_at", end);
    const { data: orders } = await q;

    const repByFacility: Record<string, string> = {};
    for (const rid of filteredIds) for (const fid of facilitiesByRep[rid] ?? []) repByFacility[fid] = rid;

    for (const o of orders ?? []) {
      const rid = repByFacility[o.facility_id as string];
      if (!rid) continue;
      ordersByRep[rid] = (ordersByRep[rid] ?? 0) + 1;
      if (o.delivery_status === "delivered") {
        deliveredByRep[rid] = (deliveredByRep[rid] ?? 0) + 1;
      }
    }
  }

  const { data: rates } = await adminClient
    .from("commission_rates")
    .select("rep_id, rate_percent, override_percent")
    .in("rep_id", filteredIds)
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
  const periodFilter: string[] = [];
  if (period === "this_month") {
    periodFilter.push(currentPeriod);
  } else if (period === "last_3_months") {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periodFilter.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  let commQuery = adminClient
    .from("commissions")
    .select("rep_id, final_amount, commission_amount, adjustment")
    .in("rep_id", filteredIds)
    .neq("status", "void");
  if (periodFilter.length > 0) {
    commQuery = commQuery.in("payout_period", periodFilter);
  }
  const { data: commRows } = await commQuery;
  const commByRep: Record<string, number> = {};
  for (const c of commRows ?? []) {
    const rid = c.rep_id as string;
    const amt = c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0);
    commByRep[rid] = (commByRep[rid] ?? 0) + amt;
  }

  return repList.map((r: any): IRepListRow => ({
    id: r.id,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    email: r.email ?? null,
    status: r.status ?? null,
    isDirect: directSet.has(r.id),
    accountCount: accountsByRep[r.id] ?? 0,
    ordersInPeriod: ordersByRep[r.id] ?? 0,
    deliveredInPeriod: deliveredByRep[r.id] ?? 0,
    commissionInPeriod: commByRep[r.id] ?? 0,
    commissionRate: rateByRep[r.id]?.rate_percent ?? 0,
    overridePercent: rateByRep[r.id]?.override_percent ?? 0,
  }));
}

export async function getMyTeamKpis(period: AccountPeriod = "this_month"): Promise<IMyTeamKpis> {
  const rows = await getRepList(period, "all");

  const totalReps = rows.length;
  const repsDirect = rows.filter((r) => r.isDirect).length;
  const repsIndirect = totalReps - repsDirect;

  const accountsDirect = rows.filter((r) => r.isDirect).reduce((s, r) => s + r.accountCount, 0);
  const accountsViaTeam = rows.filter((r) => !r.isDirect).reduce((s, r) => s + r.accountCount, 0);
  const totalAccounts = accountsDirect + accountsViaTeam;

  const totalOrders = rows.reduce((s, r) => s + r.ordersInPeriod, 0);
  const ordersDelivered = rows.reduce((s, r) => s + r.deliveredInPeriod, 0);

  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const repIds = rows.map((r) => r.id);
  let deliveredRevenue = 0;
  if (repIds.length > 0) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id, assigned_rep")
      .in("assigned_rep", repIds)
      .neq("facility_type", "rep_office");
    const facilityIds = (facs ?? []).map((f: any) => f.id as string);

    if (facilityIds.length > 0) {
      const { start, end } = periodBounds(period);
      let q = adminClient
        .from("orders")
        .select("id, order_items(total_amount)")
        .in("facility_id", facilityIds)
        .eq("delivery_status", "delivered")
        .neq("order_status", "canceled");
      if (start) q = q.gte("placed_at", start);
      if (end) q = q.lt("placed_at", end);
      const { data: orders } = await q;
      for (const o of orders ?? []) {
        const items = (o as any).order_items as { total_amount: string | number }[] | null;
        for (const it of items ?? []) {
          deliveredRevenue += Number(it.total_amount ?? 0);
        }
      }
    }
  }

  const activeReps = rows.filter((r) => r.status === "active").length;

  return {
    totalReps,
    repsDirect,
    repsIndirect,
    totalAccounts,
    accountsDirect,
    accountsViaTeam,
    totalOrders,
    ordersDelivered,
    deliveredRevenue,
    deliveredOrdersConfirmed: ordersDelivered,
    activeReps,
    activeRepsTotalDenominator: totalReps,
  };
}
