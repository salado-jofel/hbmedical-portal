# Sales Rep Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT run `git commit` or `git add` — user has explicit rules against unauthorized commits.**

**Goal:** Turn the sales-rep dashboard into a real dashboard: add revenue trend chart with quota reference line, pipeline funnel bars, top-5 accounts card, unified Today's Focus action panel, and a sensing KPI row (MoM growth + active doctors). Remove the Quick Actions panel.

**Architecture:** 5 new presentational components under `dashboard/(sections)/`. One new server action `getTopAccountsByRep`. Existing `getMonthlyRevenue` is reused for the trend line. `page.tsx` extended to fetch monthly revenue + current quota + top accounts for rep users. All other derivations (MoM growth, active doctors, pipeline buckets, tasks splitting) happen client-side in the component that renders the data.

**Tech Stack:** Next.js 16 App Router server actions, Recharts (installed), Redux (not needed — data flows via props), TypeScript, Tailwind 4, existing `KpiCard` / `DataTable` / `OrderDetailModal` / `KANBAN_STATUS_CONFIG`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `dashboard/(services)/dashboard-actions.ts` | **Create** | `getTopAccountsByRep(repId, limit)` |
| `dashboard/(sections)/RevenueTrendChart.tsx` | **Create** | Line chart + quota reference |
| `dashboard/(sections)/PipelineFunnel.tsx` | **Create** | Horizontal bar funnel |
| `dashboard/(sections)/TopAccountsCard.tsx` | **Create** | Top 5 account rows |
| `dashboard/(sections)/TodaysFocus.tsx` | **Create** | Overdue + due-week tasks + attention orders |
| `dashboard/(sections)/SensingKpiRow.tsx` | **Create** | MoM growth + Active Doctors cards |
| `dashboard/(sections)/RepDashboard.tsx` | Modify | Wire new props, new layout; drop Quick Actions |
| `dashboard/page.tsx` | Modify | Fetch monthlyRevenue, currentQuota, topAccounts for rep role |

---

## Task 1: Add `getTopAccountsByRep` server action

**Files:**
- Create: `app/(dashboard)/dashboard/(services)/dashboard-actions.ts`

- [ ] **Step 1: Create the file**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";

export interface ITopAccount {
  id: string;
  name: string;
  city: string;
  state: string;
  deliveredRevenue: number;
}

export async function getTopAccountsByRep(
  repId: string,
  limit = 5,
): Promise<ITopAccount[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  // 1. Rep's clinic facilities
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, name, city, state")
    .eq("assigned_rep", repId)
    .eq("facility_type", "clinic");
  const facilities = facs ?? [];
  if (facilities.length === 0) return [];
  const facilityIds = facilities.map((f: any) => f.id as string);

  // 2. Delivered orders in last 90 days
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await adminClient
    .from("orders")
    .select("id, facility_id")
    .in("facility_id", facilityIds)
    .eq("delivery_status", "delivered")
    .gte("delivered_at", cutoff);

  const orderRows = orders ?? [];
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((o: any) => o.id as string);

  // 3. Order items → sum by facility
  const { data: items } = await adminClient
    .from("order_items")
    .select("order_id, total_amount")
    .in("order_id", orderIds);
  const itemTotalByOrder: Record<string, number> = {};
  for (const i of items ?? []) {
    itemTotalByOrder[i.order_id] =
      (itemTotalByOrder[i.order_id] ?? 0) + Number(i.total_amount ?? 0);
  }

  const revenueByFacility: Record<string, number> = {};
  for (const o of orderRows) {
    const fid = o.facility_id as string;
    revenueByFacility[fid] =
      (revenueByFacility[fid] ?? 0) + (itemTotalByOrder[o.id as string] ?? 0);
  }

  const result: ITopAccount[] = facilities
    .map((f: any) => ({
      id: f.id as string,
      name: f.name as string,
      city: (f.city ?? "") as string,
      state: (f.state ?? "") as string,
      deliveredRevenue: revenueByFacility[f.id] ?? 0,
    }))
    .filter((a) => a.deliveredRevenue > 0)
    .sort((a, b) => b.deliveredRevenue - a.deliveredRevenue)
    .slice(0, limit);

  return result;
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 2: Create `RevenueTrendChart.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/(sections)/RevenueTrendChart.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatAmount } from "@/utils/helpers/formatter";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function labelFor(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_SHORT[(month ?? 1) - 1]} ${String(year).slice(2)}`;
}

export function RevenueTrendChart({
  data,
  quota,
}: {
  data: Array<{ period: string; revenue: number }>;
  quota: number | null;
}) {
  const series = data.map((d) => ({ month: labelFor(d.period), revenue: Math.round(d.revenue) }));

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--navy)]">Revenue Trend</p>
          <p className="text-[11px] text-[var(--text3)]">
            Last 6 months · {quota != null ? `quota: ${formatAmount(quota)}` : "no quota set"}
          </p>
        </div>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text3)" }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} />
            {quota != null && quota > 0 && (
              <ReferenceLine
                y={quota}
                stroke="#2563eb"
                strokeDasharray="4 4"
                label={{ value: "Quota", position: "right", fill: "#2563eb", fontSize: 10 }}
              />
            )}
            <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 3: Create `PipelineFunnel.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/(sections)/PipelineFunnel.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { formatAmount } from "@/utils/helpers/formatter";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const STATUSES: OrderStatus[] = [
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
];

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending_signature:      "#f59e0b",
  manufacturer_review:    "#a855f7",
  additional_info_needed: "#ef4444",
  approved:               "#3b82f6",
  shipped:                "#06b6d4",
  delivered:              "#16a34a",
};

function orderTotal(o: DashboardOrder): number {
  const items = ((o as any).order_items ?? []) as { total_amount: string | number }[];
  return items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
}

export function PipelineFunnel({ orders }: { orders: DashboardOrder[] }) {
  const data = useMemo(() => {
    const acc: Partial<Record<OrderStatus, { count: number; revenue: number }>> = {};
    for (const o of orders) {
      const s = o.order_status as OrderStatus;
      if (!STATUSES.includes(s)) continue;
      const prev = acc[s] ?? { count: 0, revenue: 0 };
      acc[s] = { count: prev.count + 1, revenue: prev.revenue + orderTotal(o) };
    }
    return STATUSES.map((s) => ({
      status: s,
      label: KANBAN_STATUS_CONFIG[s]?.label ?? s,
      count: acc[s]?.count ?? 0,
      revenue: acc[s]?.revenue ?? 0,
    }));
  }, [orders]);

  const hasAny = data.some((d) => d.count > 0);

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[13px] font-semibold text-[var(--navy)] mb-1">Pipeline Funnel</p>
      <p className="text-[11px] text-[var(--text3)] mb-3">Orders by status</p>
      {!hasAny ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-[var(--text3)]">
          No orders yet
        </div>
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text3)" }}
                width={110}
              />
              <Tooltip
                formatter={(v, _name, entry) => {
                  const d = entry?.payload as { count: number; revenue: number } | undefined;
                  return d ? [`${d.count} · ${formatAmount(d.revenue)}`, "Count · Value"] : [String(v), ""];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((d) => (
                  <Cell key={d.status} fill={STATUS_COLOR[d.status] ?? "#94a3b8"} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  formatter={(v: unknown, _name: unknown, _idx: unknown, entry: any) => {
                    const rev = entry?.payload?.revenue ?? 0;
                    return `${v} · ${formatAmount(Number(rev))}`;
                  }}
                  style={{ fontSize: 10, fill: "var(--navy)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors. If Recharts' `LabelList` formatter signature rejects the multi-arg form, fall back to computing the label on the data (e.g., add a `labelText` string field during `useMemo` and use `formatter={(v) => v}` against that field).

---

## Task 4: Create `TopAccountsCard.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/(sections)/TopAccountsCard.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import type { ITopAccount } from "../(services)/dashboard-actions";

export function TopAccountsCard({ items }: { items: ITopAccount[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Top Accounts</p>
        <p className="text-[11px] text-[var(--text3)]">Last 3 months delivered revenue</p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <Building2 className="w-8 h-8 text-[#cbd5e1] mb-2 stroke-1" />
          <p className="text-[12px] text-[var(--text3)]">No delivered revenue yet in the last 3 months</p>
        </div>
      ) : (
        <ul>
          {items.map((a, i) => (
            <li
              key={a.id}
              onClick={() => router.push(`/dashboard/accounts/${a.id}`)}
              className="flex items-center gap-3 border-b border-[var(--border)] last:border-b-0 px-4 py-3 cursor-pointer hover:bg-[#f8fafc]"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-white text-[11px] font-bold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--navy)] truncate">{a.name}</p>
                <p className="text-[11px] text-[var(--text3)] truncate">
                  {a.city}{a.city && a.state ? ", " : ""}{a.state}
                </p>
              </div>
              <span className="text-sm font-semibold text-[var(--navy)] shrink-0">
                {formatAmount(a.deliveredRevenue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 5: Create `TodaysFocus.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/(sections)/TodaysFocus.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { formatDate } from "@/utils/helpers/formatter";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { cn } from "@/utils/utils";
import type { ITask } from "@/utils/interfaces/tasks";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const ATTENTION_STATUSES: OrderStatus[] = ["pending_signature", "additional_info_needed"];
const MS_DAY = 24 * 60 * 60 * 1000;

function daysFrom(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_DAY);
}

function patientName(o: DashboardOrder): string {
  const p: any = (o as any).patients ?? (o as any).patient ?? null;
  if (!p) return "—";
  const row = Array.isArray(p) ? p[0] : p;
  return `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim() || "—";
}

export function TodaysFocus({
  tasks,
  orders,
  onOrderClick,
}: {
  tasks: ITask[];
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  const router = useRouter();

  const { overdue, dueThisWeek, attentionOrders } = useMemo(() => {
    const now = Date.now();
    const weekAhead = now + 7 * MS_DAY;
    const openTasks = tasks.filter((t) => t.status === "open");
    const overdue = openTasks
      .filter((t) => new Date(t.due_date).getTime() < now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const dueThisWeek = openTasks
      .filter((t) => {
        const d = new Date(t.due_date).getTime();
        return d >= now && d < weekAhead;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const attentionOrders = orders.filter((o) =>
      ATTENTION_STATUSES.includes(o.order_status as OrderStatus),
    );
    return { overdue, dueThisWeek, attentionOrders };
  }, [tasks, orders]);

  const isEmpty =
    overdue.length === 0 && dueThisWeek.length === 0 && attentionOrders.length === 0;

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Today's Focus</p>
        <p className="text-[11px] text-[var(--text3)]">Your action items right now</p>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--green)] mb-2 stroke-1" />
          <p className="text-sm font-medium text-[var(--navy)]">All clear</p>
          <p className="text-[11px] text-[var(--text3)]">Nothing urgent on your plate</p>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <FocusGroup
              dotClass="bg-red-500"
              title="Overdue Tasks"
              count={overdue.length}
            >
              {overdue.map((t) => (
                <li
                  key={t.id}
                  onClick={() => router.push(`/dashboard/accounts/${t.facility_id ?? ""}`)}
                  className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)]"
                >
                  <p className="text-sm text-[var(--navy)] truncate">{t.title}</p>
                  <p className="text-[11px] text-red-600">
                    Overdue by {daysFrom(t.due_date)} day{daysFrom(t.due_date) !== 1 ? "s" : ""} · {t.facility?.name ?? "—"}
                  </p>
                </li>
              ))}
            </FocusGroup>
          )}

          {dueThisWeek.length > 0 && (
            <FocusGroup
              dotClass="bg-[var(--gold)]"
              title="Due This Week"
              count={dueThisWeek.length}
            >
              {dueThisWeek.map((t) => (
                <li
                  key={t.id}
                  onClick={() => router.push(`/dashboard/accounts/${t.facility_id ?? ""}`)}
                  className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)]"
                >
                  <p className="text-sm text-[var(--navy)] truncate">{t.title}</p>
                  <p className="text-[11px] text-[var(--text3)]">
                    {formatDate(t.due_date)} · {t.facility?.name ?? "—"}
                  </p>
                </li>
              ))}
            </FocusGroup>
          )}

          {attentionOrders.length > 0 && (
            <FocusGroup
              dotClass="bg-[var(--navy)]"
              title="Orders Needing Attention"
              count={attentionOrders.length}
            >
              {attentionOrders.map((o) => {
                const cfg = KANBAN_STATUS_CONFIG[o.order_status as OrderStatus];
                return (
                  <li
                    key={o.id}
                    onClick={() => onOrderClick(o.id)}
                    className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)] flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--navy)] truncate">
                        {o.order_number ?? o.id.slice(0, 8)} · {patientName(o)}
                      </p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0", cfg?.badge ?? "")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", cfg?.dot ?? "bg-gray-400")} />
                      {cfg?.label ?? o.order_status}
                    </span>
                  </li>
                );
              })}
            </FocusGroup>
          )}
        </>
      )}
    </div>
  );
}

function FocusGroup({
  dotClass,
  title,
  count,
  children,
}: {
  dotClass: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc]">
        <span className={cn("w-2 h-2 rounded-full", dotClass)} />
        <p className="text-[12px] font-semibold text-[var(--navy)]">{title}</p>
        <span className="ml-auto text-[10px] font-bold text-[var(--text3)]">{count}</span>
      </div>
      <ul>{children}</ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors. If `ITask` does not have a `facility_id` or `facility` field, adjust the row's render and navigation target accordingly; grep `utils/interfaces/tasks.ts` to confirm field names.

---

## Task 6: Create `SensingKpiRow.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/(sections)/SensingKpiRow.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import { KpiCard } from "@/app/(components)/KpiCard";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const MS_DAY = 24 * 60 * 60 * 1000;

export function SensingKpiRow({
  monthlyRevenue,
  orders,
}: {
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  orders: DashboardOrder[];
}) {
  const { momPct, momDir, activeDoctors } = useMemo(() => {
    const len = monthlyRevenue.length;
    const current = len > 0 ? monthlyRevenue[len - 1].revenue : 0;
    const previous = len > 1 ? monthlyRevenue[len - 2].revenue : 0;
    let momPct = 0;
    if (previous > 0) {
      momPct = ((current - previous) / previous) * 100;
    } else if (current > 0) {
      momPct = 100;
    }
    const momDir: "up" | "flat" | "down" =
      momPct > 0.5 ? "up" : momPct < -0.5 ? "down" : "flat";

    const cutoff = Date.now() - 90 * MS_DAY;
    const docs = new Set<string>();
    for (const o of orders) {
      const placed = o.placed_at;
      if (!placed) continue;
      if (new Date(placed).getTime() < cutoff) continue;
      const pid = (o as any).assigned_provider_id as string | null | undefined;
      if (pid) docs.add(pid);
    }

    return { momPct, momDir, activeDoctors: docs.size };
  }, [monthlyRevenue, orders]);

  const momLabel =
    momDir === "up"   ? `+${momPct.toFixed(1)}%` :
    momDir === "down" ? `${momPct.toFixed(1)}%`  :
                        "0%";
  const momAccent = momDir === "up" ? "green" : momDir === "down" ? "red" : "teal";

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px]">
      <KpiCard label="MoM Revenue Growth" value={momLabel} accentColor={momAccent} />
      <KpiCard label="Active Doctors" value={String(activeDoctors)} accentColor="purple" />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 7: Rewrite `RepDashboard.tsx`

**Files:**
- Modify: `app/(dashboard)/dashboard/(sections)/RepDashboard.tsx`

- [ ] **Step 1: Replace the file**

```typescript
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PageHeader } from "@/app/(components)/PageHeader";
import { formatAmount } from "@/utils/helpers/formatter";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { PipelineFunnel } from "./PipelineFunnel";
import { TopAccountsCard } from "./TopAccountsCard";
import { TodaysFocus } from "./TodaysFocus";
import { SensingKpiRow } from "./SensingKpiRow";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { ITask } from "@/utils/interfaces/tasks";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { ICommissionSummary } from "@/utils/interfaces/commissions";
import type { ITopAccount } from "../(services)/dashboard-actions";

export function RepDashboard({
  orders,
  tasks,
  accounts,
  commissionSummary,
  monthlyRevenue,
  currentQuota,
  topAccounts,
}: {
  orders: DashboardOrder[];
  tasks: ITask[];
  accounts: IAccount[];
  commissionSummary: ICommissionSummary | null;
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  currentQuota: number | null;
  topAccounts: ITopAccount[];
}) {
  const router = useRouter();

  const openTasks = useMemo(() => tasks.filter((t) => t.status === "open"), [tasks]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );

  function handleOrderClick(orderId: string) {
    router.push(`/dashboard/orders?order=${orderId}`);
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your sales overview" />

      {/* Row 1 — count KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="My Accounts"   value={String(accounts.length)}   accentColor="teal"   />
        <KpiCard label="Open Tasks"    value={String(openTasks.length)}  accentColor="gold"   />
        <KpiCard label="My Orders"     value={String(orders.length)}     accentColor="blue"   />
        <KpiCard label="Active Orders" value={String(activeOrders)}      accentColor="purple" />
      </div>

      {/* Row 2 — commission KPIs */}
      {commissionSummary && (
        <div className="mb-5 grid grid-cols-2 gap-[10px]">
          <KpiCard label="Commission Earned" value={formatAmount(commissionSummary.totalEarned)}   accentColor="teal" />
          <KpiCard label="Pending Payout"    value={formatAmount(commissionSummary.totalPending)}  accentColor="gold" />
        </div>
      )}

      {/* Row 3 — sensing KPIs */}
      <SensingKpiRow monthlyRevenue={monthlyRevenue} orders={orders} />

      {/* Row 4 — charts */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <RevenueTrendChart data={monthlyRevenue} quota={currentQuota} />
        <PipelineFunnel orders={orders} />
      </div>

      {/* Row 5 — action row */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopAccountsCard items={topAccounts} />
        <TodaysFocus tasks={tasks} orders={orders} onOrderClick={handleOrderClick} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` — expected: errors in `dashboard/page.tsx` (missing new props on `<RepDashboard>`). Fixed in Task 8.

---

## Task 8: Update `dashboard/page.tsx` to fetch new data

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

Near the existing imports:

```typescript
import { getMonthlyRevenue } from "./rep-performance/(services)/actions";
import { getTopAccountsByRep, type ITopAccount } from "./(services)/dashboard-actions";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
```

Check first — `getMonthlyRevenue` may not be exported from `rep-performance/(services)/actions.ts`. If it's a private helper (lowercase-h), add `export` to it in that file, or duplicate the logic inline.

- [ ] **Step 2: Fetch new props for rep users in `DashboardPage`**

Replace the current `Promise.all` block:

```typescript
  const [allOrders, users, accounts, tasks, commissionSummary] = await Promise.all([
    getAllOrders(),
    adminUser ? getUsers() : Promise.resolve([] as IUser[]),
    repUser ? getAccounts() : Promise.resolve([] as IAccount[]),
    repUser ? getTasks() : Promise.resolve([] as ITask[]),
    repUser ? getRepCommissionSummary().catch(() => null) : Promise.resolve(null as ICommissionSummary | null),
  ]);
```

With:

```typescript
  const user = repUser ? await getCurrentUserOrThrow(supabase) : null;

  const [
    allOrders,
    users,
    accounts,
    tasks,
    commissionSummary,
    monthlyRevenue,
    topAccounts,
    currentQuota,
  ] = await Promise.all([
    getAllOrders(),
    adminUser ? getUsers() : Promise.resolve([] as IUser[]),
    repUser ? getAccounts() : Promise.resolve([] as IAccount[]),
    repUser ? getTasks() : Promise.resolve([] as ITask[]),
    repUser ? getRepCommissionSummary().catch(() => null) : Promise.resolve(null as ICommissionSummary | null),
    repUser && user ? getMonthlyRevenue(user.id, createAdminClient()).catch(() => [] as Array<{ period: string; revenue: number }>) : Promise.resolve([] as Array<{ period: string; revenue: number }>),
    repUser && user ? getTopAccountsByRep(user.id, 5).catch(() => [] as ITopAccount[]) : Promise.resolve([] as ITopAccount[]),
    repUser && user ? fetchCurrentQuota(user.id).catch(() => null as number | null) : Promise.resolve(null as number | null),
  ]);
```

And add a tiny helper above `DashboardPage`:

```typescript
async function fetchCurrentQuota(repId: string): Promise<number | null> {
  const admin = createAdminClient();
  const d = new Date();
  const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const { data } = await admin
    .from("sales_quotas")
    .select("target_amount")
    .eq("rep_id", repId)
    .eq("period", period)
    .maybeSingle();
  return data ? Number(data.target_amount) : null;
}
```

- [ ] **Step 3: Pass new props to `<RepDashboard>`**

Replace:

```typescript
      {repUser && (
        <RepDashboard orders={allOrders} tasks={tasks} accounts={accounts} commissionSummary={commissionSummary} />
      )}
```

With:

```typescript
      {repUser && (
        <RepDashboard
          orders={allOrders}
          tasks={tasks}
          accounts={accounts}
          commissionSummary={commissionSummary}
          monthlyRevenue={monthlyRevenue}
          currentQuota={currentQuota}
          topAccounts={topAccounts}
        />
      )}
```

- [ ] **Step 4: Verify build**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.
Run `npm run build 2>&1 | tail -20` → success.

**If `getMonthlyRevenue` isn't exported:** open `app/(dashboard)/dashboard/rep-performance/(services)/actions.ts` and add the `export` keyword to `async function getMonthlyRevenue`. Zero behavior change — just makes it callable.

---

## Task 9: Full build + browser spot-check

- [ ] **Step 1: Production build**

```bash
npm run build 2>&1 | tail -20
```

Expected: success, no type errors.

- [ ] **Step 2: Browser spot-check as sales rep**

Start `npm run dev`, log in as a sales rep with some orders/tasks/accounts. Visit `/dashboard`.

Verify:
1. Existing 4-KPI count row renders
2. Commission 2-KPI row renders (if rep has commission data)
3. **Sensing KPI row** renders with MoM Growth % + Active Doctors
4. **Row 4** renders side-by-side:
   - Revenue Trend line chart with last 6 months; dashed blue "Quota" reference line appears if quota is set (else no line)
   - Pipeline Funnel horizontal bars with count + $ labels
5. **Row 5** renders side-by-side:
   - Top Accounts showing up to 5 items (clickable → navigate to account detail)
   - Today's Focus with any/all of: Overdue Tasks (red), Due This Week (gold), Orders Needing Attention (navy). Empty state "All clear" if nothing applies.
6. Quick Actions panel no longer present

- [ ] **Step 3: Empty-state rep check**

Log in as a brand-new rep with zero orders → charts show "No orders yet" style; Top Accounts empty state; Today's Focus shows "All clear"; rest of dashboard stays usable.
