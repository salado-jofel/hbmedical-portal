"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow } from "@/lib/supabase/auth";
import {
  pageToRange,
  sanitizeDir,
  sanitizePage,
  sanitizePageSize,
  sanitizeSort,
  type PaginatedQuery,
  type PaginatedResult,
} from "@/utils/interfaces/paginated";
import { safeLogError } from "@/lib/logging/safe-log";

export interface PhiAccessLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  order_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const PHI_LOG_SORT_COLUMNS = ["created_at", "action", "user_email"] as const;
export type PhiLogSortColumn = (typeof PHI_LOG_SORT_COLUMNS)[number];

export type PhiLogFilters = {
  action: string | null;
  resource: string | null;
  user: string | null; // user_email contains
  order: string | null; // order_id exact
};

export async function getPhiAccessLog(
  query: PaginatedQuery<PhiLogFilters>,
): Promise<PaginatedResult<PhiAccessLogRow>> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const page = sanitizePage(query.page);
  const pageSize = sanitizePageSize(query.pageSize);
  const sort = sanitizeSort<readonly PhiLogSortColumn[]>(
    query.sort,
    PHI_LOG_SORT_COLUMNS,
    "created_at",
  );
  const dir = sanitizeDir(query.dir);

  // Service-role read because the table's RLS policy gates SELECT to
  // admins via a profile lookup — same effective gate, but bypassing RLS
  // here lets us compose .or() / .ilike() without triggering the policy
  // re-evaluation per predicate.
  const adminClient = createAdminClient();
  let builder = adminClient
    .from("phi_access_log")
    .select("*", { count: "exact" })
    .order(sort, { ascending: dir === "asc" });

  if (query.filters?.action)
    builder = builder.eq("action", query.filters.action);
  if (query.filters?.resource)
    builder = builder.eq("resource", query.filters.resource);
  if (query.filters?.order)
    builder = builder.eq("order_id", query.filters.order);
  if (query.filters?.user) {
    const term = query.filters.user.replace(/[%_,]/g, (c) => `\\${c}`);
    builder = builder.ilike("user_email", `%${term}%`);
  }
  const searchRaw = (query.search ?? "").trim();
  if (searchRaw.length > 0) {
    const term = searchRaw.replace(/[%_,]/g, (c) => `\\${c}`);
    builder = builder.or(
      `action.ilike.%${term}%,resource.ilike.%${term}%,user_email.ilike.%${term}%`,
    );
  }

  const { from, to } = pageToRange(page, pageSize);
  const { data, error, count } = await builder.range(from, to);

  if (error) {
    safeLogError("getPhiAccessLog", error);
    throw new Error(error.message ?? "Failed to load audit log.");
  }

  return {
    rows: (data ?? []) as PhiAccessLogRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Distinct action values currently in the log — feeds the action filter
 * dropdown. Scoped to the most recent 90 days for query speed; older
 * actions show up only if the operator queries by them directly.
 */
export async function getPhiAccessLogActions(): Promise<string[]> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);
  const adminClient = createAdminClient();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await adminClient
    .from("phi_access_log")
    .select("action")
    .gte("created_at", ninetyDaysAgo);

  const set = new Set<string>();
  for (const row of data ?? []) set.add(row.action as string);
  return Array.from(set).sort();
}
