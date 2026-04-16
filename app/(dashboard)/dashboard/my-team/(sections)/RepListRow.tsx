"use client";

import Link from "next/link";
import { cn } from "@/utils/utils";
import { formatAmount } from "@/utils/helpers/formatter";
import type { IRepListRow } from "@/utils/interfaces/my-team";

export function RepListRow({ row }: { row: IRepListRow }) {
  const isActive = row.status === "active";
  const pillClass = isActive
    ? "bg-[var(--green-lt)] text-[var(--green)]"
    : "bg-[#fee2e2] text-[#b91c1c]";

  return (
    <Link
      href={`/dashboard/my-team/${row.id}`}
      className="flex flex-col md:flex-row md:items-center gap-4 border-b border-[var(--border)] bg-white px-5 py-4 last:border-b-0 hover:bg-[#f8fafc] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--navy)] truncate">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-[11px] text-[var(--text3)] truncate">{row.email ?? ""}</p>
      </div>

      <div className="grid grid-cols-4 shrink-0 md:w-[480px]">
        <Stat value={String(row.accountCount)} label="Accounts" />
        <Stat value={String(row.ordersInPeriod)} label="Orders" />
        <Stat value={String(row.deliveredInPeriod)} label="Delivered" />
        <Stat value={formatAmount(row.commissionInPeriod)} label="Commission" />
      </div>

      <div className="md:ml-4 shrink-0 md:w-[90px] md:text-center">
        <span className={cn("inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium", pillClass)}>
          {isActive ? "Active" : "Not Active"}
        </span>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[16px] font-semibold text-[var(--navy)] leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text3)]">{label}</p>
    </div>
  );
}
