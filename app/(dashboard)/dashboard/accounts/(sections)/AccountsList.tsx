"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { AccountsFilters } from "../(components)/AccountsFilters";
import { AccountsKpiRow } from "./AccountsKpiRow";
import { EmptyState } from "@/app/(components)/EmptyState";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { cn } from "@/utils/utils";
import { formatDate } from "@/utils/helpers/formatter";
import type {
  IRepProfile,
  AccountStatus,
  AccountPeriod,
  AccountTier,
  IAccountWithMetrics,
} from "@/utils/interfaces/accounts";
import { AccountTierBadge } from "../(components)/AccountTierBadge";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";
import { useListParams } from "@/utils/hooks/useListParams";
import { ACCOUNT_SORT_COLUMNS } from "@/utils/constants/accounts-list";
import { pageToRange } from "@/utils/interfaces/paginated";

export function AccountsList({ salesReps, isAdmin, period }: {
  salesReps: IRepProfile[];
  isAdmin: boolean;
  period: AccountPeriod;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accounts = useAppSelector((state) => state.accounts.items);
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const userId = useAppSelector((s) => s.dashboard.userId);
  const isRep = isSalesRep(role);

  // Search is ephemeral (PHI-sensitive — account names / contacts should
  // not land in URL / browser history / logs).
  const [search, setSearch] = useState("");

  // URL-backed list params (pagination / sort / structured filters).
  // Tier is server-wide-ranked so filter/sort on tier is done post-hydration
  // against the full accounts list — we only paginate the visible rows.
  const listParams = useListParams<
    typeof ACCOUNT_SORT_COLUMNS,
    readonly ["status", "tier", "rep", "owner"]
  >({
    defaultSort: "created_at",
    defaultDir: "desc",
    allowedSorts: ACCOUNT_SORT_COLUMNS,
    filterKeys: ["status", "tier", "rep", "owner"] as const,
  });

  // Mirror URL filters into the existing AccountsFilters control state so
  // the filter chips look the same as before.
  const statusFilter = (listParams.filters.status as AccountStatus | null) ?? "all";
  const repFilter = listParams.filters.rep ?? "all";
  const tierFilter = (listParams.filters.tier as AccountTier | null) ?? "all";
  const ownerFilter = (listParams.filters.owner as "mine" | "sub_reps" | null) ?? "all";
  const setStatusFilter = (v: AccountStatus | "all") =>
    listParams.setFilter("status", v === "all" ? null : v);
  const setRepFilter = (v: string) =>
    listParams.setFilter("rep", v === "all" ? null : v);
  const setTierFilter = (v: AccountTier | "all") =>
    listParams.setFilter("tier", v === "all" ? null : v);
  const setOwnerFilter = (v: "all" | "mine" | "sub_reps") =>
    listParams.setFilter("owner", v === "all" ? null : v);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Account list is collaborative — admins approve new facilities, reps
  // see assignments change, status flips between active/pending. Subscribe
  // to facilities (the row itself) and profiles (rep assignments).
  useTableRealtimeRefresh("facilities");
  useTableRealtimeRefresh("profiles");

  const myCount = isRep ? accounts.filter((a) => a.assigned_rep === userId).length : 0;
  const subRepCount = isRep ? accounts.filter((a) => a.assigned_rep && a.assigned_rep !== userId).length : 0;

  // Full filtered view (pre-pagination) — needed for "X of Y" totals and so
  // tier/filter interactions compose correctly with the global tier ranking
  // already computed in Redux.
  const filtered = useMemo(() => {
    let result = accounts;
    if (isRep && ownerFilter === "mine") result = result.filter((a) => a.assigned_rep === userId);
    else if (isRep && ownerFilter === "sub_reps") result = result.filter((a) => a.assigned_rep && a.assigned_rep !== userId);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.city.toLowerCase().includes(term) ||
          a.state.toLowerCase().includes(term) ||
          a.contact.toLowerCase().includes(term),
      );
    }
    if (statusFilter !== "all") result = result.filter((a) => a.status === statusFilter);
    if (isAdmin && repFilter !== "all") result = result.filter((a) => a.assigned_rep === repFilter);
    if (tierFilter !== "all") result = result.filter((a) => a.tier === tierFilter);
    return result;
  }, [accounts, search, statusFilter, repFilter, tierFilter, isAdmin, isRep, ownerFilter, userId]);

  // Apply sort. Tier sort uses A/B/C ordering. Revenue/count sort is
  // numeric; name/status is locale-aware.
  const sorted = useMemo(() => {
    const asc = listParams.dir === "asc" ? 1 : -1;
    const tierRank: Record<string, number> = { A: 0, B: 1, C: 2 };
    return [...filtered].sort((a, b) => {
      let primary = 0;
      switch (listParams.sort) {
        case "name":
          primary = a.name.localeCompare(b.name) * asc;
          break;
        case "status":
          primary = (a.status ?? "").localeCompare(b.status ?? "") * asc;
          break;
        case "tier":
          primary = ((tierRank[a.tier] ?? 3) - (tierRank[b.tier] ?? 3)) * asc;
          break;
        case "delivered_revenue":
          primary = ((a.delivered_revenue ?? 0) - (b.delivered_revenue ?? 0)) * asc;
          break;
        case "signed_count":
          primary = ((a.signed_count ?? 0) - (b.signed_count ?? 0)) * asc;
          break;
        case "created_at":
          primary =
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * asc;
          break;
      }
      return primary !== 0 ? primary : a.name.localeCompare(b.name);
    });
  }, [filtered, listParams.sort, listParams.dir]);

  // Clamp page when filters shrink the dataset below the current page.
  const pageCount = Math.max(1, Math.ceil(sorted.length / listParams.pageSize));
  const clampedPage = Math.min(listParams.page, pageCount);
  const { from, to } = pageToRange(clampedPage, listParams.pageSize);
  const pageRows = sorted.slice(from, to + 1);

  function handlePeriodChange(newPeriod: AccountPeriod) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", newPeriod);
    router.push(`/dashboard/accounts?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <AccountsKpiRow />

      {mounted && isRep && (
        <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5 w-fit">
          {(
            [
              { key: "all", label: "All Accounts", count: accounts.length },
              { key: "mine", label: "My Accounts", count: myCount },
              { key: "sub_reps", label: "Sub-Rep Accounts", count: subRepCount },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setOwnerFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                ownerFilter === key
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              {label}
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                ownerFilter === key ? "bg-[var(--navy)] text-white" : "bg-[#e2e8f0] text-[#64748b]")}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      <AccountsFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        repFilter={repFilter}
        onRepFilterChange={setRepFilter}
        periodFilter={period}
        onPeriodFilterChange={handlePeriodChange}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        salesReps={salesReps}
        isAdmin={isAdmin}
      />

      {isRep && ownerFilter === "mine" && filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 stroke-1" />}
          message="No accounts assigned to you"
          description="Accounts directly assigned to you will appear here"
        />
      ) : isRep && ownerFilter === "sub_reps" && filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 stroke-1" />}
          message="No sub-rep accounts"
          description="Accounts assigned to your sub-representatives will appear here"
        />
      ) : pageRows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 stroke-1" />}
          message="No accounts found"
          description="Adjust your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                  <th className="px-4 py-[9px]">
                    <SortableHeader
                      label="Account / Provider"
                      column="name"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof ACCOUNT_SORT_COLUMNS[number],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-[9px]">
                    <SortableHeader
                      label="Tier"
                      column="tier"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof ACCOUNT_SORT_COLUMNS[number],
                        )
                      }
                      align="center"
                    />
                  </th>
                  <th className="px-4 py-[9px]">
                    <SortableHeader
                      label="Signed"
                      column="signed_count"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof ACCOUNT_SORT_COLUMNS[number],
                        )
                      }
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-[9px]">
                    <SortableHeader
                      label="Delivered"
                      column="delivered_revenue"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof ACCOUNT_SORT_COLUMNS[number],
                        )
                      }
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-[9px] text-[10px] uppercase tracking-[0.6px] font-semibold text-[var(--text3)] hidden lg:table-cell">
                    Invited By
                  </th>
                  <th className="px-4 py-[9px] hidden xl:table-cell">
                    <SortableHeader
                      label="Onboarded"
                      column="created_at"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof ACCOUNT_SORT_COLUMNS[number],
                        )
                      }
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/dashboard/accounts/${a.id}`)}
                    className="group cursor-pointer border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--bg)]"
                  >
                    <td className="px-4 py-2.5 min-w-0">
                      <p className="text-sm font-medium text-[var(--navy)] truncate">
                        {a.name}
                      </p>
                      <p className="text-xs text-[var(--text3)] truncate mt-0.5">
                        {a.city}, {a.state}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="inline-flex">
                        <AccountTierBadge tier={a.tier} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(a.signed_count ?? 0) > 0 ? (
                        <span className="text-sm text-[var(--navy)]">{a.signed_count}</span>
                      ) : (
                        <span className="text-sm text-[var(--text3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(a.delivered_count ?? 0) > 0 ? (
                        <span className="text-sm font-medium text-[var(--green)]">
                          {a.delivered_count}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="text-sm text-[var(--text2)]">
                        {a.invited_by_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden xl:table-cell">
                      <span className="text-sm text-[var(--text2)]">
                        {formatDate(a.onboarded_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={clampedPage}
            pageSize={listParams.pageSize}
            total={sorted.length}
            onPageChange={listParams.setPage}
            onPageSizeChange={listParams.setPageSize}
          />
        </div>
      )}
    </div>
  );
}
