"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { setQuotaSchema } from "@/utils/validators/quotas";
import { SALES_QUOTAS_TABLE, REP_PERFORMANCE_PATH } from "@/utils/constants/quotas";
import type { IQuota, IQuotaFormState, IRepPerformance, IRepPerformanceSummary } from "@/utils/interfaces/quotas";
import { assignTiers } from "@/utils/helpers/tiers";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function profileName(p: { first_name: string; last_name: string } | null): string {
  if (!p) return "Unknown";
  return `${p.first_name} ${p.last_name}`.trim();
}

function currentPeriodStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodBounds(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1).toISOString(),
    end:   new Date(year, month,     1).toISOString(), // exclusive
  };
}

async function buildRepPerformance(
  repId: string,
  repName: string,
  period: string,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<IRepPerformance> {
  const { start, end } = periodBounds(period);

  // Quota for this rep + period
  const { data: quotaRow } = await adminClient
    .from(SALES_QUOTAS_TABLE)
    .select("target_amount")
    .eq("rep_id", repId)
    .eq("period", period)
    .maybeSingle();

  // Facilities assigned to this rep
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id")
    .eq("assigned_rep", repId);
  const facilityIds = (facs ?? []).map((f: any) => f.id as string);

  let totalOrders = 0;
  let paidOrders = 0;
  let actualRevenue = 0;

  if (facilityIds.length > 0) {
    // All orders placed in period
    const { data: placed } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .gte("placed_at", start)
      .lt("placed_at", end);
    totalOrders = (placed ?? []).length;

    // Paid orders (by paid_at) for revenue
    const { data: paid } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .eq("payment_status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end);
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

  // Commission earned this period
  const { data: commRows } = await adminClient
    .from("commissions")
    .select("final_amount, commission_amount, adjustment")
    .eq("rep_id", repId)
    .eq("payout_period", period)
    .neq("status", "void");
  const commissionEarned = (commRows ?? []).reduce((sum: number, c: any) => {
    return sum + (c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0));
  }, 0);

  const quota = quotaRow ? Number(quotaRow.target_amount) : null;

  return {
    repId,
    repName,
    period,
    quota,
    actualRevenue,
    attainmentPct: quota != null && quota > 0 ? (actualRevenue / quota) * 100 : null,
    totalOrders,
    paidOrders,
    commissionEarned,
    avgOrderValue: paidOrders > 0 ? actualRevenue / paidOrders : 0,
  };
}

export async function getMonthlyRevenue(
  repId: string | null,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<Array<{ period: string; revenue: number }>> {
  const now = new Date();

  // Fetch rep's facilities once (null repId = all orders, no facility filter)
  let facilityIds: string[] | null = null;
  if (repId) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id")
      .eq("assigned_rep", repId);
    facilityIds = (facs ?? []).map((f: any) => f.id as string);
  }

  const results: Array<{ period: string; revenue: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const start = d.toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

    if (facilityIds !== null && facilityIds.length === 0) {
      results.push({ period, revenue: 0 });
      continue;
    }

    let ordersQuery = adminClient
      .from("orders")
      .select("id")
      .eq("payment_status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end);

    if (facilityIds !== null) {
      ordersQuery = ordersQuery.in("facility_id", facilityIds);
    }

    const { data: orders } = await ordersQuery;
    const orderIds = (orders ?? []).map((o: any) => o.id as string);

    let revenue = 0;
    if (orderIds.length > 0) {
      const { data: items } = await adminClient
        .from("order_items")
        .select("total_amount")
        .in("order_id", orderIds);
      revenue = (items ?? []).reduce(
        (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
      );
    }
    results.push({ period, revenue });
  }

  return results;
}

async function buildRevenueExtras(
  repId: string | null,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<{ pipelineRevenue: number; oneYearProjectedRevenue: number }> {
  let facilityIds: string[] | null = null;
  if (repId) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id")
      .eq("assigned_rep", repId);
    facilityIds = (facs ?? []).map((f: any) => f.id as string);
    if (facilityIds.length === 0) return { pipelineRevenue: 0, oneYearProjectedRevenue: 0 };
  }

  let pipelineQ = adminClient
    .from("orders")
    .select("id")
    .in("order_status", ["approved", "shipped"]);
  if (facilityIds) pipelineQ = pipelineQ.in("facility_id", facilityIds);
  const { data: pipelineOrders } = await pipelineQ;

  const pipelineOrderIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
  let pipelineRevenue = 0;
  if (pipelineOrderIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("total_amount")
      .in("order_id", pipelineOrderIds);
    pipelineRevenue = (items ?? []).reduce(
      (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
    );
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();

  let deliveredQ = adminClient
    .from("orders")
    .select("id")
    .eq("delivery_status", "delivered")
    .gte("delivered_at", start);
  if (facilityIds) deliveredQ = deliveredQ.in("facility_id", facilityIds);
  const { data: deliveredOrders } = await deliveredQ;

  const deliveredIds = (deliveredOrders ?? []).map((o: any) => o.id as string);
  let trailing3moRevenue = 0;
  if (deliveredIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("total_amount")
      .in("order_id", deliveredIds);
    trailing3moRevenue = (items ?? []).reduce(
      (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
    );
  }

  const oneYearProjectedRevenue = (trailing3moRevenue / 13) * 52;

  return { pipelineRevenue, oneYearProjectedRevenue };
}

async function buildTierCounts(
  repId: string | null,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<{ A: number; B: number; C: number }> {
  let facilityIds: string[] = [];
  if (repId) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id")
      .eq("assigned_rep", repId);
    facilityIds = (facs ?? []).map((f: any) => f.id as string);
    if (facilityIds.length === 0) return { A: 0, B: 0, C: 0 };
  } else {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id")
      .eq("facility_type", "clinic");
    facilityIds = (facs ?? []).map((f: any) => f.id as string);
    if (facilityIds.length === 0) return { A: 0, B: 0, C: 0 };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();

  const { data: deliveredOrders } = await adminClient
    .from("orders")
    .select("id, facility_id")
    .in("facility_id", facilityIds)
    .eq("delivery_status", "delivered")
    .gte("delivered_at", start);

  const deliveredIds = (deliveredOrders ?? []).map((o: any) => o.id as string);
  const revenueByOrder: Record<string, number> = {};
  if (deliveredIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("order_id, total_amount")
      .in("order_id", deliveredIds);
    for (const it of items ?? []) {
      revenueByOrder[it.order_id] =
        (revenueByOrder[it.order_id] ?? 0) + Number(it.total_amount ?? 0);
    }
  }

  const revenueByFacility: Record<string, number> = {};
  for (const o of deliveredOrders ?? []) {
    const fid = o.facility_id as string;
    revenueByFacility[fid] =
      (revenueByFacility[fid] ?? 0) + (revenueByOrder[o.id] ?? 0);
  }

  const tierInputs = facilityIds.map((id) => ({
    id,
    delivered_revenue: revenueByFacility[id] ?? 0,
  }));

  const tiered = assignTiers(tierInputs);
  let A = 0, B = 0, C = 0;
  for (const t of tiered) {
    if (t.tier === "A") A += 1;
    else if (t.tier === "B") B += 1;
    else C += 1;
  }
  return { A, B, C };
}

/* -------------------------------------------------------------------------- */
/* 1. getQuotas                                                               */
/* -------------------------------------------------------------------------- */

export async function getQuotas(): Promise<IQuota[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminClient = createAdminClient();

  let query = adminClient
    .from(SALES_QUOTAS_TABLE)
    .select(`
      id, rep_id, set_by, period, target_amount, notes, created_at,
      rep:profiles!sales_quotas_rep_id_fkey(first_name, last_name),
      setter:profiles!sales_quotas_set_by_fkey(first_name, last_name)
    `)
    .order("period", { ascending: false });

  if (!isAdmin(role)) {
    query = query.eq("rep_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getQuotas] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to fetch quotas.");
  }

  return (data ?? []).map((q: any) => ({
    id:           q.id,
    repId:        q.rep_id,
    repName:      profileName(q.rep),
    setBy:        q.set_by,
    setByName:    profileName(q.setter),
    period:       q.period,
    targetAmount: Number(q.target_amount),
    notes:        q.notes ?? null,
    createdAt:    q.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* 2. setQuota (admin only)                                                   */
/* -------------------------------------------------------------------------- */

export async function setQuota(
  _prev: IQuotaFormState | null,
  formData: FormData,
): Promise<IQuotaFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role)) {
      if (!isSalesRep(role)) {
        return { success: false, error: "Unauthorized.", fieldErrors: {} };
      }
      const targetRepId = formData.get("rep_id") as string;
      const adminClient = createAdminClient();
      const { data: edge } = await adminClient
        .from("rep_hierarchy")
        .select("child_rep_id")
        .eq("parent_rep_id", user.id)
        .eq("child_rep_id", targetRepId)
        .maybeSingle();
      if (!edge) {
        return { success: false, error: "You can only set quotas for your direct sub-reps.", fieldErrors: {} };
      }
    }

    const raw = {
      rep_id:        formData.get("rep_id") as string,
      period:        formData.get("period") as string,
      target_amount: formData.get("target_amount") as string,
    };

    const parsed = setQuotaSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IQuotaFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IQuotaFormState["fieldErrors"]>;
        fieldErrors[field] = issue.message;
      }
      return { success: false, error: null, fieldErrors };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from(SALES_QUOTAS_TABLE)
      .upsert(
        {
          rep_id:        parsed.data.rep_id,
          set_by:        user.id,
          period:        parsed.data.period,
          target_amount: parsed.data.target_amount,
        },
        { onConflict: "rep_id,period" },
      );

    if (error) {
      console.error("[setQuota] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to set quota." };
    }

    revalidatePath(REP_PERFORMANCE_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[setQuota] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. getRepPerformanceSummary                                                */
/* -------------------------------------------------------------------------- */

export async function getRepPerformanceSummary(): Promise<IRepPerformanceSummary> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminClient = createAdminClient();
  const period = currentPeriodStr();

  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  const myName = profileName(myProfile);

  let myPerformance: IRepPerformance | null = null;
  let subRepPerformance: IRepPerformance[] = [];

  if (isSalesRep(role)) {
    myPerformance = await buildRepPerformance(user.id, myName, period, adminClient);

    const { data: hierarchy } = await adminClient
      .from("rep_hierarchy")
      .select("child:profiles!rep_hierarchy_child_rep_id_fkey(id, first_name, last_name, status)")
      .eq("parent_rep_id", user.id);

    const subReps = (hierarchy ?? [])
      .map((row: any) => {
        const child = Array.isArray(row.child) ? row.child[0] : row.child;
        if (!child?.id || child.status !== "active") return null;
        return { id: child.id as string, name: profileName(child) };
      })
      .filter(Boolean) as Array<{ id: string; name: string }>;

    subRepPerformance = await Promise.all(
      subReps.map((r) => buildRepPerformance(r.id, r.name, period, adminClient)),
    );
  } else if (isAdmin(role)) {
    const { data: allReps } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("role", "sales_representative")
      .eq("status", "active")
      .order("first_name");

    const reps = (allReps ?? []).map((p: any) => ({
      id:   p.id as string,
      name: profileName(p),
    }));

    subRepPerformance = await Promise.all(
      reps.map((r) => buildRepPerformance(r.id, r.name, period, adminClient)),
    );
  }

  const monthlyRevenue = await getMonthlyRevenue(
    isSalesRep(role) ? user.id : null,
    adminClient,
  );

  const [{ pipelineRevenue, oneYearProjectedRevenue }, tierCounts] = await Promise.all([
    buildRevenueExtras(isSalesRep(role) ? user.id : null, adminClient),
    buildTierCounts(isSalesRep(role) ? user.id : null, adminClient),
  ]);

  return {
    currentPeriod: period,
    myPerformance,
    subRepPerformance,
    monthlyRevenue,
    pipelineRevenue,
    oneYearProjectedRevenue,
    tierCounts,
  };
}

/* -------------------------------------------------------------------------- */
/* getAdminPerformanceExtras — admin-only team analytics                      */
/* -------------------------------------------------------------------------- */

export interface IAdminPerformanceExtras {
  monthlyByRep: Array<{ month: string } & Record<string, number | string>>;
  repNames: string[];
  repRanking: Array<{ id: string; name: string; trailing3moRevenue: number }>;
  quotaAttainment: Array<{ id: string; name: string; actualRevenue: number; quota: number | null; pct: number | null }>;
  teamFunnel: Array<{ status: string; label: string; count: number; revenue: number }>;
}

export async function getAdminPerformanceExtras(): Promise<IAdminPerformanceExtras> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isAdmin(role)) {
    return { monthlyByRep: [], repNames: [], repRanking: [], quotaAttainment: [], teamFunnel: [] };
  }
  const adminClient = createAdminClient();

  const { data: reps } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("role", "sales_representative")
    .eq("status", "active")
    .order("first_name");
  const repList = (reps ?? []).map((r: any) => ({
    id: r.id as string,
    name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Rep",
  }));
  if (repList.length === 0) {
    return { monthlyByRep: [], repNames: [], repRanking: [], quotaAttainment: [], teamFunnel: [] };
  }
  const repIds = repList.map((r) => r.id);

  // Facilities assigned per rep
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, assigned_rep")
    .in("assigned_rep", repIds)
    .neq("facility_type", "rep_office");
  const facilitiesByRep: Record<string, string[]> = {};
  for (const f of facs ?? []) {
    const r = f.assigned_rep as string;
    (facilitiesByRep[r] ??= []).push(f.id as string);
  }
  const allFacilityIds = Object.values(facilitiesByRep).flat();
  const repByFacility: Record<string, string> = {};
  for (const r of repIds) for (const fid of facilitiesByRep[r] ?? []) repByFacility[fid] = r;

  /* -------------------- monthlyByRep (last 12 months) -------------------- */
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  const earliest = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

  let deliveredOrders: Array<{ id: string; facility_id: string; delivered_at: string | null; order_items: any[] }> = [];
  if (allFacilityIds.length > 0) {
    const { data } = await adminClient
      .from("orders")
      .select("id, facility_id, delivered_at, order_items(total_amount)")
      .in("facility_id", allFacilityIds)
      .eq("delivery_status", "delivered")
      .gte("delivered_at", earliest);
    deliveredOrders = (data ?? []) as any;
  }

  function orderTotal(o: any): number {
    const items = (o.order_items ?? []) as { total_amount: string | number }[];
    return items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  }

  const monthlyMatrix: Record<string, Record<string, number>> = {};
  for (const m of months) monthlyMatrix[m.key] = {};

  for (const o of deliveredOrders) {
    if (!o.delivered_at) continue;
    const d = new Date(o.delivered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!(key in monthlyMatrix)) continue;
    const rid = repByFacility[o.facility_id];
    if (!rid) continue;
    monthlyMatrix[key][rid] = (monthlyMatrix[key][rid] ?? 0) + orderTotal(o);
  }

  const monthlyByRep = months.map((m) => {
    const row: Record<string, number | string> = { month: m.label };
    for (const r of repList) row[r.name] = Math.round(monthlyMatrix[m.key][r.id] ?? 0);
    return row as { month: string } & Record<string, number | string>;
  });
  const repNames = repList.map((r) => r.name);

  /* -------------------- repRanking (trailing 3 months) -------------------- */
  const cutoff3mo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
  const revenue3moByRep: Record<string, number> = {};
  for (const o of deliveredOrders) {
    if (!o.delivered_at || o.delivered_at < cutoff3mo) continue;
    const rid = repByFacility[o.facility_id];
    if (!rid) continue;
    revenue3moByRep[rid] = (revenue3moByRep[rid] ?? 0) + orderTotal(o);
  }
  const repRanking = repList
    .map((r) => ({ id: r.id, name: r.name, trailing3moRevenue: Math.round(revenue3moByRep[r.id] ?? 0) }))
    .sort((a, b) => b.trailing3moRevenue - a.trailing3moRevenue);

  /* -------------------- quotaAttainment (current period) -------------------- */
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: quotaRows } = await adminClient
    .from("sales_quotas")
    .select("rep_id, target_amount")
    .in("rep_id", repIds)
    .eq("period", currentPeriod);
  const quotaByRep: Record<string, number> = {};
  for (const q of quotaRows ?? []) quotaByRep[q.rep_id as string] = Number(q.target_amount ?? 0);

  // Current-month actual revenue (paid orders in current month)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  let actualByRep: Record<string, number> = {};
  if (allFacilityIds.length > 0) {
    const { data: paid } = await adminClient
      .from("orders")
      .select("id, facility_id, order_items(total_amount)")
      .in("facility_id", allFacilityIds)
      .eq("payment_status", "paid")
      .gte("paid_at", monthStart)
      .lt("paid_at", monthEnd);
    for (const o of paid ?? []) {
      const rid = repByFacility[(o as any).facility_id];
      if (!rid) continue;
      actualByRep[rid] = (actualByRep[rid] ?? 0) + orderTotal(o);
    }
  }

  const quotaAttainment = repList.map((r) => {
    const quota = quotaByRep[r.id] ?? null;
    const actualRevenue = Math.round(actualByRep[r.id] ?? 0);
    const pct = quota != null && quota > 0 ? (actualRevenue / quota) * 100 : null;
    return { id: r.id, name: r.name, actualRevenue, quota, pct };
  });

  /* -------------------- teamFunnel (all statuses across team) -------------------- */
  const FUNNEL_STATUSES = [
    "pending_signature",
    "manufacturer_review",
    "additional_info_needed",
    "approved",
    "shipped",
    "delivered",
  ];
  const FUNNEL_LABELS: Record<string, string> = {
    pending_signature: "Pending Signature",
    manufacturer_review: "Mfr. Review",
    additional_info_needed: "Info Needed",
    approved: "Approved",
    shipped: "Shipped",
    delivered: "Delivered",
  };
  const funnelAcc: Record<string, { count: number; revenue: number }> = {};
  for (const s of FUNNEL_STATUSES) funnelAcc[s] = { count: 0, revenue: 0 };
  if (allFacilityIds.length > 0) {
    const { data: allTeamOrders } = await adminClient
      .from("orders")
      .select("id, facility_id, order_status, order_items(total_amount)")
      .in("facility_id", allFacilityIds)
      .in("order_status", FUNNEL_STATUSES);
    for (const o of allTeamOrders ?? []) {
      const s = (o as any).order_status as string;
      if (!(s in funnelAcc)) continue;
      funnelAcc[s].count += 1;
      funnelAcc[s].revenue += orderTotal(o);
    }
  }
  const teamFunnel = FUNNEL_STATUSES.map((s) => ({
    status: s,
    label: FUNNEL_LABELS[s],
    count: funnelAcc[s].count,
    revenue: Math.round(funnelAcc[s].revenue),
  }));

  return { monthlyByRep, repNames, repRanking, quotaAttainment, teamFunnel };
}
