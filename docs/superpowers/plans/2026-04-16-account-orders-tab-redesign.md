# Account Detail — Orders Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT run `git commit` or `git add` — user has explicit rules against unauthorized commits.**

**Goal:** Turn the Orders tab on `/dashboard/accounts/[id]` into a dashboard — 3 Recharts charts (orders/month, revenue/month, status donut) showing rolling 12 months, plus a filter bar (status, period, search, view toggle) feeding either a table view (default) or the existing kanban view.

**Architecture:** Current `OrdersTab.tsx` becomes a controller with filter state. Chart data is derived client-side from the existing `orders: DashboardOrder[]` prop — no new server fetches. Kanban JSX is extracted unchanged into `OrdersKanbanView`. A new `OrdersTableView` renders the account-scoped table. `recharts` is already installed at `^3.8.1`.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript, Tailwind 4, `recharts` (already installed), existing `DataTable` / `KANBAN_STATUS_CONFIG` / `OrderDetailModal`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `accounts/[id]/(components)/OrdersChartsRow.tsx` | **Create** | 3-chart row (orders/mo line, revenue/mo line, status donut) |
| `accounts/[id]/(components)/OrdersFilterBar.tsx` | **Create** | Status dropdown + period chips + search + view toggle |
| `accounts/[id]/(components)/OrdersTableView.tsx` | **Create** | Account-scoped orders table |
| `accounts/[id]/(components)/OrdersKanbanView.tsx` | **Create** | Extracted kanban rendering |
| `accounts/[id]/(components)/OrdersTab.tsx` | Modify | Controller — filter state, compose views |

---

## Task 1: Create `OrdersKanbanView.tsx` (extract existing kanban)

**Files:**
- Create: `app/(dashboard)/dashboard/accounts/[id]/(components)/OrdersKanbanView.tsx`

- [ ] **Step 1: Create the file by extracting existing kanban JSX**

```typescript
"use client";

import { OrderCard } from "@/app/(dashboard)/dashboard/orders/(components)/OrderCard";
import {
  groupOrdersByStatus,
  KANBAN_STATUS_CONFIG,
  PAID_COLUMN_CONFIG,
} from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

const ADMIN_VISIBLE_STATUSES: OrderStatus[] = [
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
];

type KanbanCol =
  | { type: "status"; status: OrderStatus }
  | { type: "processed" };

const COLUMNS: KanbanCol[] = ADMIN_VISIBLE_STATUSES.flatMap(
  (status): KanbanCol[] =>
    status === "approved"
      ? [
          { type: "status" as const, status },
          { type: "processed" as const },
        ]
      : [{ type: "status" as const, status }],
);

export function OrdersKanbanView({
  orders,
  onOrderClick,
}: {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  const grouped = groupOrdersByStatus(orders);
  const approvedPending = (grouped["approved"] ?? []).filter(
    (o) => !o.payment_method,
  );
  const approvedProcessed = (grouped["approved"] ?? []).filter(
    (o) => !!o.payment_method,
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const isProcessed = col.type === "processed";
        const key = isProcessed ? "processed" : col.status;
        const config = isProcessed
          ? PAID_COLUMN_CONFIG
          : KANBAN_STATUS_CONFIG[col.status];
        const colOrders = isProcessed
          ? approvedProcessed
          : col.status === "approved"
            ? approvedPending
            : (grouped[col.status] ?? []);

        return (
          <div key={key} className="flex-shrink-0 w-72 flex flex-col">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={cn("w-2 h-2 rounded-full shrink-0", config.dot)} />
              <span className="text-xs font-semibold text-[var(--navy)]">
                {config.label}
              </span>
              <span
                className={cn(
                  "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  config.badge,
                )}
              >
                {colOrders.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 min-h-[120px] bg-[var(--bg)] border border-[var(--border)] rounded-xl p-2">
              {colOrders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-gray-400">No orders</p>
                </div>
              ) : (
                colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusOverride={isProcessed ? "processed" : undefined}
                    onClick={() => onOrderClick(order.id)}
                    unreadCount={0}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 2: Create `OrdersTableView.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/accounts/[id]/(components)/OrdersTableView.tsx`

- [ ] **Step 1: First, check DashboardOrder shape + existing status-pill helper**

Before writing the table, run:

```bash
grep -n "DashboardOrder\|payment_status\|order_items\|total_amount\|patient\|date_of_service" utils/interfaces/orders.ts | head -40
```

Confirm field names (`order_number`, `order_status`, `payment_status`, `date_of_service`, `patients`/`patient`, `order_items[]` with `total_amount`). Adjust column accessors in Step 2 if field names differ.

- [ ] **Step 2: Create the file**

```typescript
"use client";

import { ShoppingCart } from "lucide-react";
import { DataTable } from "@/app/(components)/DataTable";
import { EmptyState } from "@/app/(components)/EmptyState";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { cn } from "@/utils/utils";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { TableColumn } from "@/utils/interfaces/table-column";

function orderTotal(o: DashboardOrder): number {
  const items = (o.order_items ?? []) as { total_amount: string | number }[];
  return items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
}

function patientName(o: DashboardOrder): string {
  const p = (o as any).patients ?? (o as any).patient ?? null;
  if (!p) return "—";
  const row = Array.isArray(p) ? p[0] : p;
  return `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim() || "—";
}

export function OrdersTableView({
  orders,
  onOrderClick,
}: {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        message="No orders match the current filters"
      />
    );
  }

  const columns: TableColumn<DashboardOrder>[] = [
    {
      key: "order_number",
      label: "Order #",
      render: (o) => (
        <span className="text-sm font-medium text-[var(--navy)]">
          {o.order_number ?? o.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "patient",
      label: "Patient",
      render: (o) => <span className="text-sm text-[var(--text2)]">{patientName(o)}</span>,
    },
    {
      key: "date_of_service",
      label: "DOS",
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
      render: (o) => (
        <span className="text-sm text-[var(--text2)]">
          {o.date_of_service ? formatDate(o.date_of_service) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (o) => {
        const cfg = KANBAN_STATUS_CONFIG[o.order_status];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border",
              cfg?.badge ?? "",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg?.dot ?? "bg-gray-400")} />
            {cfg?.label ?? o.order_status}
          </span>
        );
      },
    },
    {
      key: "payment",
      label: "Payment",
      headerClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
      render: (o) => (
        <span className="text-sm text-[var(--text2)] capitalize">
          {o.payment_status ?? "—"}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (o) => (
        <span className="text-sm font-medium text-[var(--navy)]">{formatAmount(orderTotal(o))}</span>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(o) => o.id}
        emptyMessage="No orders found"
        emptyIcon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        onRowClick={(o) => onOrderClick(o.id)}
        rowClassName="group"
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10`. If `DashboardOrder` doesn't have `order_items` or the patient relation shape differs, fix the `orderTotal` / `patientName` helpers to match. Zero errors expected.

---

## Task 3: Create `OrdersChartsRow.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/accounts/[id]/(components)/OrdersChartsRow.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { formatAmount } from "@/utils/helpers/formatter";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function orderTotal(o: DashboardOrder): number {
  const items = (o.order_items ?? []) as { total_amount: string | number }[];
  return items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
}

const STATUS_HEX: Partial<Record<OrderStatus, string>> = {
  draft:                  "#94a3b8",
  pending_signature:      "#f59e0b",
  manufacturer_review:    "#a855f7",
  additional_info_needed: "#ef4444",
  approved:               "#3b82f6",
  shipped:                "#06b6d4",
  delivered:              "#16a34a",
  canceled:               "#64748b",
};

export function OrdersChartsRow({ orders }: { orders: DashboardOrder[] }) {
  const { ordersPerMonth, revenuePerMonth, statusBreakdown } = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: monthLabel(d) });
    }
    const ordersCounts: Record<string, number> = Object.fromEntries(
      months.map((m) => [m.key, 0]),
    );
    const revenueByMonth: Record<string, number> = Object.fromEntries(
      months.map((m) => [m.key, 0]),
    );

    for (const o of orders) {
      if (o.placed_at) {
        const k = monthKey(new Date(o.placed_at));
        if (k in ordersCounts) ordersCounts[k] += 1;
      }
      if (o.delivery_status === "delivered" && o.delivered_at) {
        const k = monthKey(new Date(o.delivered_at));
        if (k in revenueByMonth) revenueByMonth[k] += orderTotal(o);
      }
    }

    const ordersPerMonth = months.map((m) => ({
      month: m.label,
      count: ordersCounts[m.key],
    }));
    const revenuePerMonth = months.map((m) => ({
      month: m.label,
      revenue: Math.round(revenueByMonth[m.key]),
    }));

    const statusCounts: Partial<Record<OrderStatus, number>> = {};
    for (const o of orders) {
      statusCounts[o.order_status] = (statusCounts[o.order_status] ?? 0) + 1;
    }
    const statusBreakdown = Object.entries(statusCounts)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([status, count]) => ({
        status: status as OrderStatus,
        count: count as number,
        label: KANBAN_STATUS_CONFIG[status as OrderStatus]?.label ?? status,
        color: STATUS_HEX[status as OrderStatus] ?? "#94a3b8",
      }));

    return { ordersPerMonth, revenuePerMonth, statusBreakdown };
  }, [orders]);

  return (
    <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Orders / month */}
      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Orders / Month
        </p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={ordersPerMonth} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue / month */}
      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Delivered Revenue / Month
        </p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={revenuePerMonth} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text3)" }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip formatter={(v: number) => formatAmount(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status donut */}
      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Status Breakdown
        </p>
        {statusBreakdown.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-xs text-[var(--text3)]">
            No orders yet
          </div>
        ) : (
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {statusBreakdown.map((s) => (
                    <Cell key={s.status} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v}`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 4: Create `OrdersFilterBar.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/accounts/[id]/(components)/OrdersFilterBar.tsx`

- [ ] **Step 1: Create the file**

```typescript
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
      {/* Status */}
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

      {/* Period chips */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Period</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
          {(
            [
              { v: "this_month" as const,    label: "This Month" },
              { v: "last_3_months" as const, label: "Last 3 Mo" },
              { v: "all_time" as const,      label: "All Time" },
            ]
          ).map((o) => (
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

      {/* Search */}
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

      {/* View toggle */}
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
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 5: Rewrite `OrdersTab.tsx` as the controller

**Files:**
- Modify: `app/(dashboard)/dashboard/accounts/[id]/(components)/OrdersTab.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/app/(components)/EmptyState";
import { OrdersChartsRow } from "./OrdersChartsRow";
import {
  OrdersFilterBar,
  type OrdersStatusFilter,
  type OrdersPeriodFilter,
  type OrdersView,
} from "./OrdersFilterBar";
import { OrdersTableView } from "./OrdersTableView";
import { OrdersKanbanView } from "./OrdersKanbanView";
import type { DashboardOrder } from "@/utils/interfaces/orders";

function periodBounds(period: OrdersPeriodFilter): { start: string | null; end: string | null } {
  const now = new Date();
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return { start, end };
  }
  if (period === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
    return { start, end: null };
  }
  return { start: null, end: null };
}

interface OrdersTabProps {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}

export function OrdersTab({ orders, onOrderClick }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<OrdersStatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<OrdersPeriodFilter>("all_time");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrdersView>("table");

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.order_status === statusFilter);
    }
    if (periodFilter !== "all_time") {
      const { start, end } = periodBounds(periodFilter);
      result = result.filter((o) => {
        const placed = o.placed_at;
        if (!placed) return false;
        if (start && placed < start) return false;
        if (end && placed >= end) return false;
        return true;
      });
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((o) => {
        const orderNum = (o.order_number ?? "").toLowerCase();
        const p: any = (o as any).patients ?? (o as any).patient ?? null;
        const row = Array.isArray(p) ? p[0] : p;
        const patientStr = `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.toLowerCase();
        return orderNum.includes(term) || patientStr.includes(term);
      });
    }
    return result;
  }, [orders, statusFilter, periodFilter, search]);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        message="No orders for this account"
      />
    );
  }

  return (
    <div>
      <OrdersChartsRow orders={orders} />

      <OrdersFilterBar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        periodFilter={periodFilter}
        onPeriodFilterChange={setPeriodFilter}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
      />

      <p className="mb-3 text-xs text-[var(--text3)]">
        {filtered.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
      </p>

      {view === "table" ? (
        <OrdersTableView orders={filtered} onOrderClick={onOrderClick} />
      ) : (
        <OrdersKanbanView orders={filtered} onOrderClick={onOrderClick} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify full build**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.
Run `npm run build 2>&1 | tail -20` → success.

---

## Task 6: Browser spot-check

- [ ] **Step 1: Start dev server and navigate**

```bash
npm run dev
```

Log in, go to `/dashboard/accounts/<any-account-with-orders>`, click Orders tab.

### Verify:
1. Three charts render side-by-side at top:
   - Line chart of orders per month over last 12 months
   - Line chart of revenue per month (only delivered orders contribute) over last 12 months
   - Donut chart of current status breakdown
2. Filter bar shows Status dropdown, Period chips, Search, View toggle (Table/Kanban)
3. View toggle defaults to Table. Table renders with Order # / Patient / DOS / Status / Payment / Total columns. Row click opens `OrderDetailModal`.
4. Toggle to Kanban → existing kanban board renders filtered to match current filters
5. Change Status filter → both table and kanban update; charts do NOT change (always rolling 12mo)
6. Change Period chip → table/kanban filter by placed_at; charts do NOT change
7. Search `part of an order number` → filtered list narrows; charts don't change
8. Scroll to bottom of page — no layout breakage

- [ ] **Step 2: Empty-state check**

Navigate to an account with zero orders → see the standard "No orders for this account" empty state (charts and filter bar should NOT render).

- [ ] **Step 3: Responsive check**

Resize window to tablet width (~768px): charts stack, filter bar wraps cleanly.
