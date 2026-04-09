"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { AccountStatusBadge } from "../(components)/AccountStatusBadge";
import { AccountsFilters } from "../(components)/AccountsFilters";
import { DataTable } from "@/app/(components)/DataTable";
import { CountBadge } from "@/app/(components)/CountBadge";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { IRepProfile, AccountStatus } from "@/utils/interfaces/accounts";

export function AccountsList({ salesReps, isAdmin }: {
  salesReps: IRepProfile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const accounts = useAppSelector((state) => state.accounts.items);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = accounts;
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
  }, [accounts, search, statusFilter, repFilter, isAdmin]);

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
    </div>
  );
}
