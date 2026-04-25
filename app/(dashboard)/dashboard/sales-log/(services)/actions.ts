"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import {
  pageToRange,
  sanitizeDir,
  sanitizePage,
  sanitizePageSize,
  sanitizeSort,
  type PaginatedQuery,
  type PaginatedResult,
} from "@/utils/interfaces/paginated";
import {
  SALES_LOG_SORT_COLUMNS,
  type SalesLogSortColumn,
  type SalesLogRow,
} from "@/utils/constants/sales-log";

/* -------------------------------------------------------------------------- */
/* getSalesLogPaginated                                                       */
/*                                                                            */
/* The Sales Log is a read of the `commissions` table joined to:              */
/*   - orders     (for order_number + placed_at + status + total_amount)      */
/*   - facilities (for client name)                                           */
/*   - profiles   (for rep name)                                              */
/*                                                                            */
/* Scope:                                                                     */
/*   - admin                 → every commission, every rep                    */
/*   - sales_representative  → own commissions + sub-rep commissions          */
/*                                                                            */
/* Sort columns allowlist: date | amount | commission | rep.                  */
/*                                                                            */
/* Search runs post-join in memory after fetching the current page only —     */
/* cross-table ILIKE inside PostgREST `.or()` is awkward and the volume per   */
/* page is small. Search filters the returned slice, so apparent "total" on   */
/* the footer may be slightly off when a search is active; acceptable for v1. */
/* -------------------------------------------------------------------------- */

type SalesFilters = { rep: string | null };

export async function getSalesLogPaginated(
  query: PaginatedQuery<SalesFilters>,
): Promise<PaginatedResult<SalesLogRow>> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) {
    throw new Error("Unauthorized");
  }

  const page = sanitizePage(query.page);
  const pageSize = sanitizePageSize(query.pageSize);
  const sort = sanitizeSort<readonly SalesLogSortColumn[]>(
    query.sort,
    SALES_LOG_SORT_COLUMNS,
    "date",
  );
  const dir = sanitizeDir(query.dir);
  const repFilter = query.filters?.rep ?? null;

  // Resolve rep scope for non-admins (own + children in rep_hierarchy).
  const adminClient = createAdminClient();
  let repScopeIds: string[] | null = null;
  if (!isAdmin(role)) {
    const { data: hierarchy } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .eq("parent_rep_id", user.id);
    repScopeIds = [user.id, ...(hierarchy ?? []).map((h: any) => h.child_rep_id as string)];
  }

  // Build the commissions query with embedded order + facility + rep info.
  // Sort map: "date" → order.placed_at (can't sort foreign-table server-side
  // reliably with PostgREST — sort locally after fetch when "date" is picked).
  const commissionSortMap: Record<SalesLogSortColumn, string | null> = {
    amount: null,      // order.total_amount — foreign, post-join sort
    commission: "final_amount",
    date: null,        // order.placed_at — foreign, post-join sort
    rep: null,         // rep.first_name — foreign, post-join sort
  };
  const directServerSort = commissionSortMap[sort];

  let builder = adminClient
    .from("commissions")
    .select(
      `
      id, order_id, rep_id, commission_amount, adjustment, final_amount,
      status, created_at,
      order:orders!commissions_order_id_fkey(
        id, order_number, placed_at, order_status,
        order_items(total_amount),
        facility:facilities!orders_facility_id_fkey(name)
      ),
      rep:profiles!commissions_rep_id_fkey(id, first_name, last_name)
    `,
      { count: "exact" },
    )
    .neq("status", "void");

  if (directServerSort) {
    builder = builder.order(directServerSort, { ascending: dir === "asc" });
  } else {
    // Default DB ordering when the requested sort needs post-join — use
    // created_at desc so the page boundary is stable across refreshes.
    builder = builder.order("created_at", { ascending: false });
  }

  if (repScopeIds) builder = builder.in("rep_id", repScopeIds);
  if (repFilter) builder = builder.eq("rep_id", repFilter);

  // For searches and post-join sorts we must fetch a larger chunk to have
  // something meaningful to work with. For direct-server-sort without
  // search, use .range() on the commissions page.
  const hasSearch = (query.search ?? "").trim().length > 0;
  const needsPostFetch = !directServerSort || hasSearch;

  let data: any[] = [];
  let total = 0;

  if (!needsPostFetch) {
    const { from, to } = pageToRange(page, pageSize);
    const res = await builder.range(from, to);
    if (res.error) {
      console.error("[getSalesLogPaginated]", JSON.stringify(res.error));
      throw new Error(res.error.message ?? "Failed to fetch sales log.");
    }
    data = res.data ?? [];
    total = res.count ?? 0;
  } else {
    // Fetch a capped superset for post-join sort/search. The cap bounds
    // memory — flag as follow-up if real sales volume requires unbounded.
    const res = await builder.range(0, 999);
    if (res.error) {
      console.error("[getSalesLogPaginated]", JSON.stringify(res.error));
      throw new Error(res.error.message ?? "Failed to fetch sales log.");
    }
    data = res.data ?? [];
    total = res.count ?? data.length;
  }

  // Normalize into SalesLogRow.
  const rows: SalesLogRow[] = data.map((c: any) => {
    const order = Array.isArray(c.order) ? c.order[0] : c.order;
    const rep = Array.isArray(c.rep) ? c.rep[0] : c.rep;
    const facility = order?.facility
      ? Array.isArray(order.facility)
        ? order.facility[0]
        : order.facility
      : null;
    const items = (order?.order_items ?? []) as Array<{ total_amount: number | string | null }>;
    const orderTotal = items.reduce((sum, it) => sum + Number(it.total_amount ?? 0), 0);
    const final = c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount ?? 0) + Number(c.adjustment ?? 0);
    const orderStatus = String(order?.order_status ?? "");
    const isCompleted = ["approved", "shipped", "delivered"].includes(orderStatus);

    return {
      id: c.id,
      orderId: c.order_id,
      orderNumber: order?.order_number ?? "—",
      repId: c.rep_id,
      repName: rep ? `${rep.first_name ?? ""} ${rep.last_name ?? ""}`.trim() : "—",
      client: facility?.name ?? "—",
      amount: orderTotal,
      commission: final,
      date: order?.placed_at ?? c.created_at,
      status: isCompleted ? "completed" : "pending",
    };
  });

  if (!needsPostFetch) {
    // Direct server sort already applied a page slice — return as-is.
    return { rows, total, page, pageSize };
  }

  // Post-fetch path: apply search, post-join sort, then slice the page.
  let filtered = rows;
  const searchRaw = (query.search ?? "").trim().toLowerCase();
  if (searchRaw.length > 0) {
    filtered = filtered.filter(
      (r) =>
        r.orderNumber.toLowerCase().includes(searchRaw) ||
        r.repName.toLowerCase().includes(searchRaw) ||
        r.client.toLowerCase().includes(searchRaw),
    );
  }

  const asc = dir === "asc" ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case "date":
        primary =
          (new Date(a.date).getTime() - new Date(b.date).getTime()) * asc;
        break;
      case "amount":
        primary = (a.amount - b.amount) * asc;
        break;
      case "commission":
        primary = (a.commission - b.commission) * asc;
        break;
      case "rep":
        primary = a.repName.localeCompare(b.repName) * asc;
        break;
    }
    return primary !== 0
      ? primary
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const { from, to } = pageToRange(page, pageSize);
  return {
    rows: filtered.slice(from, to + 1),
    total: filtered.length,
    page,
    pageSize,
  };
}

/* -------------------------------------------------------------------------- */
/* getSalesLogReps — lightweight rep list for the filter dropdown             */
/* -------------------------------------------------------------------------- */

export async function getSalesLogReps(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) return [];

  const adminClient = createAdminClient();

  // Admin: every sales rep. Rep: self + sub-reps.
  if (isAdmin(role)) {
    const { data } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("role", "sales_representative")
      .order("first_name");
    return (data ?? []).map((p: any) => ({
      id: p.id,
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
    }));
  }

  const { data: hierarchy } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", user.id);
  const ids = [user.id, ...(hierarchy ?? []).map((h: any) => h.child_rep_id as string)];
  const { data } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", ids)
    .order("first_name");
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
  }));
}
