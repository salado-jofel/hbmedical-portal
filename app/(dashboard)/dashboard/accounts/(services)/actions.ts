"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserOrThrow,
  getUserRole,
  requireAdminOrThrow,
} from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin, isSalesRep, isSupport } from "@/utils/helpers/role";
import {
  ACCOUNTS_PATH,
  ACCOUNTS_TABLE,
  ACCOUNT_SELECT,
  PROFILES_TABLE,
  SALES_REP_SELECT,
} from "@/utils/constants/accounts";
import {
  mapAccount,
  mapAccounts,
  type IAccount,
  type IAccountFilters,
  type RawAccountRecord,
  accountStatusSchema,
  type AccountStatus,
  type AccountPeriod,
  type IAccountWithMetrics,
} from "@/utils/interfaces/accounts";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import { assignTiers } from "@/utils/helpers/tiers";

/* -------------------------------------------------------------------------- */
/* getAccounts                                                                */
/* -------------------------------------------------------------------------- */

export async function getAccounts(
  filters?: Partial<IAccountFilters>,
): Promise<IAccount[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role) && !isSupport(role)) {
    throw new Error("Unauthorized");
  }

  let query = supabase
    .from(ACCOUNTS_TABLE)
    .select(ACCOUNT_SELECT)
    .eq("facility_type", "clinic")   // Accounts = clinic clients only; rep_office facilities must never appear
    .order("name", { ascending: true });

  // Status filter
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Rep filter (admin only)
  if (checkIsAdmin(role) && filters?.rep_id && filters.rep_id !== "all") {
    query = query.eq("assigned_rep", filters.rep_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAccounts] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch accounts.");
  }

  let accounts = mapAccounts((data ?? []) as unknown as RawAccountRecord[]);

  // Client-side search filter
  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    accounts = accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.city.toLowerCase().includes(term) ||
        a.state.toLowerCase().includes(term) ||
        a.contact.toLowerCase().includes(term),
    );
  }

  return accounts;
}

/* -------------------------------------------------------------------------- */
/* getAccountById                                                             */
/* -------------------------------------------------------------------------- */

export async function getAccountById(id: string): Promise<IAccount | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role) && !isSupport(role)) {
    throw new Error("Unauthorized");
  }

  let query = supabase
    .from(ACCOUNTS_TABLE)
    .select(ACCOUNT_SELECT)
    .eq("id", id)
    .eq("facility_type", "clinic");  // Guard: prevents opening a rep_office via direct URL

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getAccountById] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch account.");
  }

  if (!data) return null;

  return mapAccount(data as unknown as RawAccountRecord);
}

/* -------------------------------------------------------------------------- */
/* getSalesReps                                                               */
/* -------------------------------------------------------------------------- */

export async function getSalesReps(): Promise<IRepProfile[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select(SALES_REP_SELECT)
    .eq("role", "sales_representative")
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[getSalesReps] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch sales reps.");
  }

  return (data ?? []) as IRepProfile[];
}

/* -------------------------------------------------------------------------- */
/* updateAccountStatus (admin only)                                          */
/* -------------------------------------------------------------------------- */

export async function updateAccountStatus(
  accountId: string,
  status: AccountStatus,
): Promise<IAccount> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const parsed = accountStatusSchema.parse(status);

  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ status: parsed })
    .eq("id", accountId);

  if (error) {
    console.error("[updateAccountStatus] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to update account status.");
  }

  revalidatePath(ACCOUNTS_PATH);
  revalidatePath(`${ACCOUNTS_PATH}/${accountId}`);

  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("Account not found after update.");
  return updated;
}

/* -------------------------------------------------------------------------- */
/* assignRep (admin only)                                                    */
/* -------------------------------------------------------------------------- */

export async function assignRep(
  accountId: string,
  repId: string | null,
): Promise<IAccount> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ assigned_rep: repId })
    .eq("id", accountId);

  if (error) {
    console.error("[assignRep] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to assign rep.");
  }

  revalidatePath(ACCOUNTS_PATH);
  revalidatePath(`${ACCOUNTS_PATH}/${accountId}`);

  const updated = await getAccountById(accountId);
  if (!updated) throw new Error("Account not found after update.");
  return updated;
}

/* -------------------------------------------------------------------------- */
/* periodBoundsAndWeeks — helper for getAccountsWithMetrics                  */
/* -------------------------------------------------------------------------- */

function periodBoundsAndWeeks(period: AccountPeriod): {
  start: string | null;
  periodWeeks: number;
} {
  const now = new Date();
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSinceStart =
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return { start: start.toISOString(), periodWeeks: Math.max(daysSinceStart / 7, 1) };
  }
  if (period === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { start: start.toISOString(), periodWeeks: 13 };
  }
  return { start: null, periodWeeks: 0 };
}

/* -------------------------------------------------------------------------- */
/* getAccountsWithMetrics                                                     */
/* -------------------------------------------------------------------------- */

export async function getAccountsWithMetrics(
  period: AccountPeriod = "this_month",
  opts?: { repIdOverride?: string },
): Promise<IAccountWithMetrics[]> {
  const supabase  = await createClient();
  const user      = await getCurrentUserOrThrow(supabase);
  const role      = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role)) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();

  /* 1a. Resolve rep scope (own id + sub-rep ids) for sales reps */
  let repScopeIds: string[] | null = null; // null = admin, no scoping
  if (opts?.repIdOverride) {
    repScopeIds = [opts.repIdOverride];
  } else if (!checkIsAdmin(role)) {
    const { data: hierarchy } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .eq("parent_rep_id", user.id);
    const subRepIds = (hierarchy ?? []).map((h: any) => h.child_rep_id as string);
    repScopeIds = [user.id, ...subRepIds];
  }

  /* 1b. Fetch clinic facilities scoped by rep */
  let facQuery = adminClient
    .from("facilities")
    .select(`
      id, user_id, name, status, contact, phone,
      address_line_1, address_line_2, city, state, postal_code, country,
      stripe_customer_id, assigned_rep, created_at, updated_at,
      assigned_rep_profile:profiles!facilities_assigned_rep_fkey(id, first_name, last_name, email, phone),
      contacts(count)
    `)
    .eq("facility_type", "clinic")
    .order("name", { ascending: true });
  if (repScopeIds) facQuery = facQuery.in("assigned_rep", repScopeIds);
  const { data: facilities, error: facError } = await facQuery;

  if (facError) {
    console.error("[getAccountsWithMetrics] facilities error:", JSON.stringify(facError));
    throw new Error(facError.message);
  }

  const facilityList = facilities ?? [];
  if (facilityList.length === 0) return [];

  const facilityIds = facilityList.map((f: any) => f.id as string);
  const { start, periodWeeks } = periodBoundsAndWeeks(period);
  const now = new Date();

  /* 2. Signed orders (period-filtered) */
  const SIGNED_STATUSES = [
    "pending_signature", "manufacturer_review", "additional_info_needed",
    "approved", "shipped", "delivered",
  ];

  let signedQ = adminClient
    .from("orders")
    .select("id, facility_id, delivery_status, placed_at")
    .in("facility_id", facilityIds)
    .in("order_status", SIGNED_STATUSES);
  if (start) signedQ = signedQ.gte("placed_at", start);
  const { data: signedOrders } = await signedQ;

  /* 3. Pipeline orders (NOT period-filtered — current in-flight) */
  const { data: pipelineOrders } = await adminClient
    .from("orders")
    .select("id, facility_id")
    .in("facility_id", facilityIds)
    .in("order_status", ["approved", "shipped"]);

  /* 4. Order items for all relevant orders */
  const signedIds   = (signedOrders   ?? []).map((o: any) => o.id as string);
  const pipelineIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
  const allOrderIds = [...new Set([...signedIds, ...pipelineIds])];

  const itemTotalByOrderId: Record<string, number> = {};
  if (allOrderIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("order_id, total_amount")
      .in("order_id", allOrderIds);
    for (const item of items ?? []) {
      itemTotalByOrderId[item.order_id] =
        (itemTotalByOrderId[item.order_id] ?? 0) + Number(item.total_amount ?? 0);
    }
  }

  /* 5. Build per-facility metrics */
  const built = facilityList.map((fac: any): Omit<IAccountWithMetrics, "tier"> => {
    const facSigned    = (signedOrders   ?? []).filter((o: any) => o.facility_id === fac.id);
    const facDelivered = facSigned.filter((o: any) => o.delivery_status === "delivered");
    const facPipeline  = (pipelineOrders ?? []).filter((o: any) => o.facility_id === fac.id);

    const signed_count    = facSigned.length;
    const delivered_count = facDelivered.length;

    const onboardedMs = new Date(fac.created_at).getTime();
    const daysSince   = Math.max((now.getTime() - onboardedMs) / (1000 * 60 * 60 * 24), 1);
    const weeksSince  = daysSince / 7;

    const avg_day  = signed_count / daysSince;
    const avg_week = signed_count / weeksSince;

    const delivered_revenue = facDelivered.reduce(
      (sum: number, o: any) => sum + (itemTotalByOrderId[o.id] ?? 0), 0,
    );
    const pipeline_revenue = facPipeline.reduce(
      (sum: number, o: any) => sum + (itemTotalByOrderId[o.id] ?? 0), 0,
    );

    const weeksForProjection = period === "all_time" ? weeksSince : periodWeeks;
    const one_year_projected_revenue =
      weeksForProjection > 0 ? (delivered_revenue / weeksForProjection) * 52 : 0;

    const repProfile = fac.assigned_rep_profile
      ? (Array.isArray(fac.assigned_rep_profile)
          ? fac.assigned_rep_profile[0]
          : fac.assigned_rep_profile)
      : null;

    return {
      id:                  fac.id,
      user_id:             fac.user_id,
      name:                fac.name,
      status:              accountStatusSchema.catch("inactive").parse(fac.status),
      contact:             fac.contact,
      phone:               fac.phone,
      address_line_1:      fac.address_line_1,
      address_line_2:      fac.address_line_2,
      city:                fac.city,
      state:               fac.state,
      postal_code:         fac.postal_code,
      country:             fac.country,
      stripe_customer_id:  fac.stripe_customer_id,
      assigned_rep:        fac.assigned_rep,
      assigned_rep_profile: repProfile,
      orders_count:        signed_count,
      contacts_count:      fac.contacts?.[0]?.count ?? 0,
      created_at:          fac.created_at,
      updated_at:          fac.updated_at,
      signed_count,
      delivered_count,
      avg_day,
      avg_week,
      one_year_est:        Math.round(avg_week * 52),
      onboarded_at:        fac.created_at,
      invited_by_name:     repProfile
                             ? `${repProfile.first_name} ${repProfile.last_name}`.trim()
                             : null,
      delivered_revenue,
      pipeline_revenue,
      one_year_projected_revenue,
    };
  });

  return assignTiers(built);
}
