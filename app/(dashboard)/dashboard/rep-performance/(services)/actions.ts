"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { setQuotaSchema } from "@/utils/validators/quotas";
import { SALES_QUOTAS_TABLE, REP_PERFORMANCE_PATH } from "@/utils/constants/quotas";
import type { IQuota, IQuotaFormState, IRepPerformance, IRepPerformanceSummary } from "@/utils/interfaces/quotas";

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

async function getMonthlyRevenue(
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
    await requireAdminOrThrow(supabase);
    const user = await getCurrentUserOrThrow(supabase);

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

  return { currentPeriod: period, myPerformance, subRepPerformance, monthlyRevenue };
}
