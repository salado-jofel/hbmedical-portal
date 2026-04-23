"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { AccountsFilters } from "../(components)/AccountsFilters";
import { AccountsKpiRow } from "./AccountsKpiRow";
import { DataTable } from "@/app/(components)/DataTable";
import { EmptyState } from "@/app/(components)/EmptyState";
import { cn } from "@/utils/utils";
import { formatDate } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type {
  IRepProfile,
  AccountStatus,
  AccountPeriod,
  AccountTier,
  IAccountWithMetrics,
} from "@/utils/interfaces/accounts";
import { AccountTierBadge } from "../(components)/AccountTierBadge";

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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "sub_reps">("all");
  const [tierFilter, setTierFilter] = useState<AccountTier | "all">("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const myCount = isRep ? accounts.filter((a) => a.assigned_rep === userId).length : 0;
  const subRepCount = isRep ? accounts.filter((a) => a.assigned_rep && a.assigned_rep !== userId).length : 0;

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

  function handlePeriodChange(newPeriod: AccountPeriod) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", newPeriod);
    router.push(`/dashboard/accounts?${params.toString()}`);
  }

  const columns: TableColumn<IAccountWithMetrics>[] = [
    {
      key: "account",
      label: "Account / Provider",
      render: (a) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--navy)] truncate">{a.name}</p>
          <p className="text-xs text-[var(--text3)] truncate mt-0.5">{a.city}, {a.state}</p>
        </div>
      ),
    },
    {
      key: "tier",
      label: "Tier",
      headerClassName: "text-center",
      cellClassName: "text-center",
      render: (a) => (
        <div className="inline-flex">
          <AccountTierBadge tier={a.tier} />
        </div>
      ),
    },
    {
      key: "signed",
      label: "Signed",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (a) => {
        const n = a.signed_count ?? 0;
        return n > 0
          ? <span className="text-sm text-[var(--navy)]">{n}</span>
          : <span className="text-sm text-[var(--text3)]">—</span>;
      },
    },
    // Avg/Day, Avg/Week, 1 Year Est. columns removed — they were statistician
    // noise (mostly zeros with no actionable insight for a sales rep).
    {
      key: "delivered",
      label: "Delivered",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (a) => {
        const n = a.delivered_count ?? 0;
        return n > 0
          ? <span className="text-sm font-medium text-[var(--green)]">{n}</span>
          : <span className="text-sm text-[var(--text3)]">—</span>;
      },
    },
    {
      key: "invited_by",
      label: "Invited By",
      headerClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
      render: (a) => (
        <span className="text-sm text-[var(--text2)]">{a.invited_by_name ?? "—"}</span>
      ),
    },
    {
      key: "onboarded",
      label: "Onboarded",
      headerClassName: "hidden xl:table-cell",
      cellClassName: "hidden xl:table-cell",
      render: (a) => (
        <span className="text-sm text-[var(--text2)]">{formatDate(a.onboarded_at)}</span>
      ),
    },
  ];

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
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(a) => a.id}
              emptyMessage="No accounts found"
              emptyIcon={<Building2 className="w-10 h-10 stroke-1" />}
              onRowClick={(a) => router.push(`/dashboard/accounts/${a.id}`)}
              rowClassName="group"
            />
          </div>
          <p className="text-xs text-[var(--text3)] text-right">
            {filtered.length} of {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
