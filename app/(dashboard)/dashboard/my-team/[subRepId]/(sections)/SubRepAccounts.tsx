"use client";

import { Building2 } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { DataTable } from "@/app/(components)/DataTable";
import { EmptyState } from "@/app/(components)/EmptyState";
import { cn } from "@/utils/utils";
import { formatDate } from "@/utils/helpers/formatter";
import { AccountTierBadge } from "@/app/(dashboard)/dashboard/accounts/(components)/AccountTierBadge";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";
import type { TableColumn } from "@/utils/interfaces/table-column";

export default function SubRepAccounts() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;
  const accounts = detail.accounts as IAccountWithMetrics[];

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
      key: "tier", label: "Tier",
      headerClassName: "text-center", cellClassName: "text-center",
      render: (a) => <div className="inline-flex"><AccountTierBadge tier={a.tier} /></div>,
    },
    {
      key: "signed", label: "Signed",
      headerClassName: "text-right", cellClassName: "text-right",
      render: (a) => <span className="text-sm text-[var(--navy)]">{a.signed_count}</span>,
    },
    {
      key: "delivered", label: "Delivered",
      headerClassName: "text-right", cellClassName: "text-right",
      render: (a) => (
        <span className={cn("text-sm font-medium", (a.delivered_count ?? 0) > 0 ? "text-[var(--green)]" : "text-[var(--text3)]")}>
          {a.delivered_count ?? 0}
        </span>
      ),
    },
    {
      key: "onboarded", label: "Onboarded",
      headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell",
      render: (a) => <span className="text-sm text-[var(--text2)]">{formatDate(a.onboarded_at)}</span>,
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--navy)]">Accounts</h2>
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 stroke-1" />}
          message="No accounts assigned"
          description="This sub-rep has no facilities assigned yet"
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <DataTable
            columns={columns}
            data={accounts}
            keyExtractor={(a) => a.id}
            emptyMessage="No accounts found"
            emptyIcon={<Building2 className="w-10 h-10 stroke-1" />}
          />
        </div>
      )}
    </section>
  );
}
