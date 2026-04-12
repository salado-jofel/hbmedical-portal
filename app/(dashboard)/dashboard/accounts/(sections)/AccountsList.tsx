"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, ChevronRight, Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { AccountStatusBadge } from "../(components)/AccountStatusBadge";
import { AccountsFilters } from "../(components)/AccountsFilters";
import { DataTable } from "@/app/(components)/DataTable";
import { CountBadge } from "@/app/(components)/CountBadge";
import { EmptyState } from "@/app/(components)/EmptyState";
import { cn } from "@/utils/utils";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { IRepProfile, AccountStatus } from "@/utils/interfaces/accounts";

export function AccountsList({ salesReps, isAdmin }: {
  salesReps: IRepProfile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const accounts = useAppSelector((state) => state.accounts.items);
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const userId = useAppSelector((s) => s.dashboard.userId);
  const isRep = isSalesRep(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "sub_reps">("all");

  const myCount = isRep ? accounts.filter((a) => a.assigned_rep === userId).length : 0;
  const subRepCount = isRep ? accounts.filter((a) => a.assigned_rep && a.assigned_rep !== userId).length : 0;

  const filtered = useMemo(() => {
    // 1. Rep ownership filter (sales_rep only)
    let result = accounts;
    if (isRep && ownerFilter === "mine") result = result.filter((a) => a.assigned_rep === userId);
    else if (isRep && ownerFilter === "sub_reps") result = result.filter((a) => a.assigned_rep && a.assigned_rep !== userId);

    // 2. Search + status filters on top
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
    return result;
  }, [accounts, search, statusFilter, repFilter, isAdmin, isRep, ownerFilter, userId]);

  const columns: TableColumn<(typeof accounts)[number]>[] = [
    {
      key: "account",
      label: "Account",
      render: (account) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--navy)] truncate group-hover:text-[var(--navy)] transition-colors">
            {account.name}
          </p>
          <p className="text-xs text-[var(--text3)] truncate mt-0.5">
            {account.city}, {account.state} · {account.country}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
      render: (account) => <AccountStatusBadge status={account.status} />,
    },
    {
      key: "rep",
      label: "Assigned Rep",
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
      render: (account) => (
        <div className="flex items-center gap-1.5 min-w-0">
          {account.assigned_rep_profile ? (
            <>
              <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-[var(--navy)]" />
              </div>
              <span className="text-xs text-[var(--text2)] truncate">
                {account.assigned_rep_profile.first_name}{" "}
                {account.assigned_rep_profile.last_name}
              </span>
            </>
          ) : (
            <span className="text-xs text-[var(--text3)]">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      key: "location",
      label: "Location",
      headerClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
      render: (account) => (
        <span className="text-xs text-[var(--text2)]">
          {account.city}, {account.state}
        </span>
      ),
    },
    {
      key: "contacts",
      label: "Contacts",
      headerClassName: "hidden sm:table-cell text-right",
      cellClassName: "hidden sm:table-cell text-right",
      render: (account) => (
        <CountBadge count={account.contacts_count} variant="muted" />
      ),
    },
    {
      key: "orders",
      label: "Orders",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (account) => (
        <div className="inline-flex items-center gap-3 justify-end">
          <CountBadge count={account.orders_count} variant="accent" />
          <ChevronRight className="w-4 h-4 text-[var(--text3)] group-hover:text-[var(--navy)] transition-colors shrink-0" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Rep ownership filter tabs (sales_rep only) ── */}
      {isRep && (
        <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5 w-fit">
          {(
            [
              { key: "all",      label: "All Accounts",      count: accounts.length },
              { key: "mine",     label: "My Accounts",       count: myCount         },
              { key: "sub_reps", label: "Sub-Rep Accounts",  count: subRepCount     },
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
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  ownerFilter === key
                    ? "bg-[var(--navy)] text-white"
                    : "bg-[#e2e8f0] text-[#64748b]",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <AccountsFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        repFilter={repFilter}
        onRepFilterChange={setRepFilter}
        salesReps={salesReps}
        isAdmin={isAdmin}
      />

      {/* ── Per-filter empty states ── */}
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
          {/* ── Table ── */}
          <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(a) => a.id}
              emptyMessage="No accounts found"
              emptyIcon={<Building2 className="w-10 h-10 stroke-1" />}
              onRowClick={(account) => router.push(`/dashboard/accounts/${account.id}`)}
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
