"use client";

import { Search } from "lucide-react";
import { cn } from "@/utils/utils";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import type { OrderStatus } from "@/utils/interfaces/orders";

export type OrdersStatusFilter = OrderStatus | "all";
export type OrdersPeriodFilter = "this_month" | "last_3_months" | "all_time";
export type OrdersView = "table" | "kanban";

const STATUS_OPTIONS: OrderStatus[] = [
  "draft",
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
  "canceled",
];

export function OrdersFilterBar({
  statusFilter,
  onStatusFilterChange,
  periodFilter,
  onPeriodFilterChange,
  search,
  onSearchChange,
  view,
  onViewChange,
}: {
  statusFilter: OrdersStatusFilter;
  onStatusFilterChange: (v: OrdersStatusFilter) => void;
  periodFilter: OrdersPeriodFilter;
  onPeriodFilterChange: (v: OrdersPeriodFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  view: OrdersView;
  onViewChange: (v: OrdersView) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Status</span>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as OrdersStatusFilter)}
          className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--navy)]"
        >
          <option value="all">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {KANBAN_STATUS_CONFIG[s]?.label ?? s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Period</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
          {([
            { v: "this_month" as const, label: "This Month" },
            { v: "last_3_months" as const, label: "Last 3 Mo" },
            { v: "all_time" as const, label: "All Time" },
          ]).map((o) => (
            <button
              key={o.v}
              onClick={() => onPeriodFilterChange(o.v)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                periodFilter === o.v
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Search</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Order # or patient name..."
            className="h-9 w-full rounded-md border border-[var(--border)] bg-white pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">View</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
          {(["table", "kanban"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                view === v
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
