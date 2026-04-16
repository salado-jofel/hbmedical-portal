# Sales Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Accounts and Rep Performance pages with per-account order metrics, revenue KPIs, a period filter, and two new pipeline/projection cards — visible to both admins and sales reps.

**Architecture:** A new `getAccountsWithMetrics(period)` server action replaces `getAccounts()` on the accounts page for all roles, fetching facilities + aggregating order/revenue stats in 3 queries. Period lives in the URL (`?period=...`); changing it triggers a Next.js navigation re-fetch. The rep-performance summary action gains two new fields consumed by two new KPI cards.

**Tech Stack:** Next.js App Router server actions, Supabase (admin client), Redux Toolkit, TypeScript, Tailwind CSS 4, `@/app/(components)/KpiCard`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `utils/interfaces/accounts.ts` | Modify | Add `AccountPeriod` type + `IAccountWithMetrics` interface |
| `utils/constants/accounts.ts` | Modify | Add `ACCOUNT_PERIOD_OPTIONS` constant |
| `accounts/(redux)/accounts-state.ts` | Modify | Widen `items` type to `IAccountWithMetrics[]` |
| `accounts/(redux)/accounts-slice.ts` | Modify | Widen `setAccounts` payload type |
| `accounts/(services)/actions.ts` | Modify | Add `getAccountsWithMetrics()` |
| `accounts/page.tsx` | Modify | Call `getAccountsWithMetrics`, read `?period` search param |
| `accounts/(sections)/Providers.tsx` | Modify | Accept `IAccountWithMetrics[]` |
| `accounts/(sections)/AccountsKpiRow.tsx` | **Create** | Two KPI rows (counts + revenue) for all roles |
| `accounts/(components)/AccountsFilters.tsx` | Modify | Add period dropdown |
| `accounts/(sections)/AccountsList.tsx` | Modify | Replace CRM columns with metrics columns, render `AccountsKpiRow` |
| `utils/interfaces/quotas.ts` | Modify | Add `pipelineRevenue` + `oneYearProjectedRevenue` to `IRepPerformanceSummary` |
| `rep-performance/(services)/actions.ts` | Modify | Compute two new revenue fields in `getRepPerformanceSummary` |
| `rep-performance/(sections)/RepKpiRow.tsx` | Modify | Add 2 new KPI cards |

---

## Task 1: Add `AccountPeriod` type and `IAccountWithMetrics` interface

**Files:**
- Modify: `utils/interfaces/accounts.ts`
- Modify: `utils/constants/accounts.ts`

- [ ] **Step 1: Add `AccountPeriod` type and `IAccountWithMetrics` to `utils/interfaces/accounts.ts`**

Append after the existing `IAccountFilters` interface:

```typescript
/* -------------------------------------------------------------------------- */
/* Period type for sales metrics filter                                       */
/* -------------------------------------------------------------------------- */

export type AccountPeriod = "this_month" | "last_3_months" | "all_time";

/* -------------------------------------------------------------------------- */
/* Account with per-account sales metrics (rep/admin enriched view)           */
/* -------------------------------------------------------------------------- */

export interface IAccountWithMetrics extends IAccount {
  signed_count: number;
  delivered_count: number;
  avg_day: number;
  avg_week: number;
  one_year_est: number;           // projected order count (avg_week × 52)
  onboarded_at: string;           // same as created_at, explicit alias
  invited_by_name: string | null; // assigned rep's full name
  delivered_revenue: number;
  pipeline_revenue: number;
  one_year_projected_revenue: number; // delivered_revenue / periodWeeks × 52
}
```

- [ ] **Step 2: Add `ACCOUNT_PERIOD_OPTIONS` to `utils/constants/accounts.ts`**

The file already has `import type { AccountStatus } from "@/utils/interfaces/accounts"` at the top. Add `AccountPeriod` to that same import line:

```typescript
import type { AccountStatus, AccountPeriod } from "@/utils/interfaces/accounts";
```

Then append the constant at the end of the file:

```typescript
export const ACCOUNT_PERIOD_OPTIONS: { value: AccountPeriod; label: string }[] = [
  { value: "this_month",    label: "This Month"    },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "all_time",      label: "All Time"      },
];
```

---

## Task 2: Widen accounts Redux slice

**Files:**
- Modify: `accounts/(redux)/accounts-state.ts`
- Modify: `accounts/(redux)/accounts-slice.ts`

- [ ] **Step 1: Update `accounts-state.ts`**

Replace the entire file content:

```typescript
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

export interface AccountsState {
  items: IAccountWithMetrics[];
}

export const initialState: AccountsState = {
  items: [],
};
```

- [ ] **Step 2: Update `accounts-slice.ts`**

Replace the entire file content:

```typescript
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./accounts-state";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    setAccounts(state, action: PayloadAction<IAccountWithMetrics[]>) {
      state.items = action.payload;
    },
    addAccountToStore(state, action: PayloadAction<IAccountWithMetrics>) {
      state.items.unshift(action.payload);
    },
    updateAccountInStore(state, action: PayloadAction<IAccountWithMetrics>) {
      const index = state.items.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeAccountFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((a) => a.id !== action.payload);
    },
  },
});

export const {
  setAccounts,
  addAccountToStore,
  updateAccountInStore,
  removeAccountFromStore,
} = accountsSlice.actions;

export default accountsSlice.reducer;
```

---

## Task 3: Add `getAccountsWithMetrics` server action

**Files:**
- Modify: `accounts/(services)/actions.ts`

- [ ] **Step 1: Add imports at the top of `accounts/(services)/actions.ts`**

Add `createAdminClient` to the existing imports and add the new types:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountPeriod, IAccountWithMetrics } from "@/utils/interfaces/accounts";
```

- [ ] **Step 2: Add the helper and the action to the bottom of `accounts/(services)/actions.ts`**

```typescript
/* -------------------------------------------------------------------------- */
/* periodBoundsAndWeeks — helper for getAccountsWithMetrics                  */
/* -------------------------------------------------------------------------- */

function periodBoundsAndWeeks(period: AccountPeriod): {
  start: string | null;
  periodWeeks: number;
} {
  const now = new Date();
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSinceStart =
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return { start: start.toISOString(), periodWeeks: Math.max(daysSinceStart / 7, 1) };
  }
  if (period === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { start: start.toISOString(), periodWeeks: 13 };
  }
  // all_time — no date cap; projection uses each account's own history (handled per-account below)
  return { start: null, periodWeeks: 0 };
}

/* -------------------------------------------------------------------------- */
/* getAccountsWithMetrics                                                     */
/* -------------------------------------------------------------------------- */

export async function getAccountsWithMetrics(
  period: AccountPeriod = "this_month",
): Promise<IAccountWithMetrics[]> {
  const supabase  = await createClient();
  const user      = await getCurrentUserOrThrow(supabase);
  const role      = await getUserRole(supabase);

  if (!checkIsAdmin(role) && !isSalesRep(role)) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();

  /* 1. Fetch all clinic facilities */
  const { data: facilities, error: facError } = await adminClient
    .from("facilities")
    .select(`
      id, user_id, name, status, contact, phone,
      address_line_1, address_line_2, city, state, postal_code, country,
      stripe_customer_id, assigned_rep, created_at, updated_at,
      assigned_rep_profile:profiles!facilities_assigned_rep_fkey(id, first_name, last_name, email, phone),
      contacts(count)
    `)
    .eq("facility_type", "clinic")
    .order("name", { ascending: true });

  if (facError) {
    console.error("[getAccountsWithMetrics] facilities error:", JSON.stringify(facError));
    throw new Error(facError.message);
  }

  const facilityList = facilities ?? [];
  if (facilityList.length === 0) return [];

  const facilityIds = facilityList.map((f: any) => f.id as string);
  const { start, periodWeeks } = periodBoundsAndWeeks(period);
  const now = new Date();

  /* 2. Signed orders (period-filtered) */
  // "Signed" = any order that has been submitted (not draft or canceled)
  const SIGNED_STATUSES = [
    "pending_signature", "manufacturer_review", "additional_info_needed",
    "approved", "shipped", "delivered",
  ];

  let signedQ = adminClient
    .from("orders")
    .select("id, facility_id, delivery_status, placed_at")
    .in("facility_id", facilityIds)
    .in("order_status", SIGNED_STATUSES);
  if (start) signedQ = signedQ.gte("placed_at", start);
  const { data: signedOrders } = await signedQ;

  /* 3. Pipeline orders (NOT period-filtered — current in-flight) */
  const { data: pipelineOrders } = await adminClient
    .from("orders")
    .select("id, facility_id")
    .in("facility_id", facilityIds)
    .in("order_status", ["approved", "shipped"]);

  /* 4. Order items for all relevant orders */
  const signedIds   = (signedOrders   ?? []).map((o: any) => o.id as string);
  const pipelineIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
  const allOrderIds = [...new Set([...signedIds, ...pipelineIds])];

  const itemTotalByOrderId: Record<string, number> = {};
  if (allOrderIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("order_id, total_amount")
      .in("order_id", allOrderIds);
    for (const item of items ?? []) {
      itemTotalByOrderId[item.order_id] =
        (itemTotalByOrderId[item.order_id] ?? 0) + Number(item.total_amount ?? 0);
    }
  }

  /* 5. Build per-facility metrics */
  return facilityList.map((fac: any): IAccountWithMetrics => {
    const facSigned    = (signedOrders   ?? []).filter((o: any) => o.facility_id === fac.id);
    const facDelivered = facSigned.filter((o: any) => o.delivery_status === "delivered");
    const facPipeline  = (pipelineOrders ?? []).filter((o: any) => o.facility_id === fac.id);

    const signed_count    = facSigned.length;
    const delivered_count = facDelivered.length;

    const onboardedMs = new Date(fac.created_at).getTime();
    const daysSince   = Math.max((now.getTime() - onboardedMs) / (1000 * 60 * 60 * 24), 1);
    const weeksSince  = daysSince / 7;

    const avg_day  = signed_count / daysSince;
    const avg_week = signed_count / weeksSince;

    const delivered_revenue = facDelivered.reduce(
      (sum: number, o: any) => sum + (itemTotalByOrderId[o.id] ?? 0), 0,
    );
    const pipeline_revenue = facPipeline.reduce(
      (sum: number, o: any) => sum + (itemTotalByOrderId[o.id] ?? 0), 0,
    );

    // For all_time, use the account's own history (weeksSince); for bounded periods use periodWeeks
    const weeksForProjection = period === "all_time" ? weeksSince : periodWeeks;
    const one_year_projected_revenue =
      weeksForProjection > 0 ? (delivered_revenue / weeksForProjection) * 52 : 0;

    const repProfile = fac.assigned_rep_profile
      ? (Array.isArray(fac.assigned_rep_profile)
          ? fac.assigned_rep_profile[0]
          : fac.assigned_rep_profile)
      : null;

    return {
      id:                  fac.id,
      user_id:             fac.user_id,
      name:                fac.name,
      status:              accountStatusSchema.catch("inactive").parse(fac.status),
      contact:             fac.contact,
      phone:               fac.phone,
      address_line_1:      fac.address_line_1,
      address_line_2:      fac.address_line_2,
      city:                fac.city,
      state:               fac.state,
      postal_code:         fac.postal_code,
      country:             fac.country,
      stripe_customer_id:  fac.stripe_customer_id,
      assigned_rep:        fac.assigned_rep,
      assigned_rep_profile: repProfile,
      orders_count:        signed_count,
      contacts_count:      fac.contacts?.[0]?.count ?? 0,
      created_at:          fac.created_at,
      updated_at:          fac.updated_at,
      signed_count,
      delivered_count,
      avg_day,
      avg_week,
      one_year_est:        Math.round(avg_week * 52),
      onboarded_at:        fac.created_at,
      invited_by_name:     repProfile
                             ? `${repProfile.first_name} ${repProfile.last_name}`.trim()
                             : null,
      delivered_revenue,
      pipeline_revenue,
      one_year_projected_revenue,
    };
  });
}
```

- [ ] **Step 3: Verify the file compiles — run**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `accounts/(services)/actions.ts`.

---

## Task 4: Update `accounts/page.tsx`

**Files:**
- Modify: `accounts/page.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { AccountsList } from "./(sections)/AccountsList";
import { getAccountsWithMetrics, getSalesReps } from "./(services)/actions";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const supabase = await createClient();
  const role     = await getUserRole(supabase);
  const admin    = isAdmin(role);

  if (!admin && !isSalesRep(role)) redirect("/dashboard");

  const period = (searchParams?.period ?? "this_month") as AccountPeriod;

  const [accounts, salesReps] = await Promise.all([
    getAccountsWithMetrics(period),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Accounts" subtitle="Manage clinic accounts and facilities" />
      <Providers accounts={accounts}>
        <AccountsList salesReps={salesReps} isAdmin={admin} period={period} />
      </Providers>
    </>
  );
}
```

---

## Task 5: Update `accounts/(sections)/Providers.tsx`

**Files:**
- Modify: `accounts/(sections)/Providers.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setAccounts } from "@/app/(dashboard)/dashboard/accounts/(redux)/accounts-slice";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

export default function Providers({
  children,
  accounts,
}: {
  children: ReactNode;
  accounts: IAccountWithMetrics[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setAccounts(accounts));
  }, [dispatch, accounts]);

  return <>{children}</>;
}
```

---

## Task 6: Create `AccountsKpiRow` component

**Files:**
- Create: `accounts/(sections)/AccountsKpiRow.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import { KpiCard } from "@/app/(components)/KpiCard";

export function AccountsKpiRow() {
  const items = useAppSelector((s) => s.accounts.items);

  const totals = useMemo(() => {
    let signed_count            = 0;
    let delivered_count         = 0;
    let delivered_revenue       = 0;
    let pipeline_revenue        = 0;
    let one_year_projected      = 0;

    for (const a of items) {
      signed_count            += a.signed_count            ?? 0;
      delivered_count         += a.delivered_count         ?? 0;
      delivered_revenue       += a.delivered_revenue       ?? 0;
      pipeline_revenue        += a.pipeline_revenue        ?? 0;
      one_year_projected      += a.one_year_projected_revenue ?? 0;
    }

    return { signed_count, delivered_count, delivered_revenue, pipeline_revenue, one_year_projected };
  }, [items]);

  return (
    <div className="mb-5 space-y-[10px]">
      {/* Row 1 — counts */}
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard
          label="Accounts"
          value={String(items.length)}
          accentColor="teal"
        />
        <KpiCard
          label="Total Signed Orders"
          value={String(totals.signed_count)}
          accentColor="blue"
        />
        <KpiCard
          label="Delivered"
          value={String(totals.delivered_count)}
          accentColor="green"
        />
        <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]" />
      </div>

      {/* Row 2 — revenue */}
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
        {/* Delivered Revenue */}
        <div className="rounded-[var(--r)] border border-[#bbf7d0] bg-[#f0fdf4] px-[1.1rem] py-4">
          <p className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
            Delivered Revenue
          </p>
          <p className="text-[22px] font-semibold leading-none text-[#16a34a]">
            {formatAmount(totals.delivered_revenue)}
          </p>
          <p className="mt-[5px] text-[11px] text-[var(--text3)]">
            {totals.delivered_count} delivered order{totals.delivered_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Pipeline Revenue */}
        <div className="rounded-[var(--r)] border border-[#bfdbfe] bg-[#eff6ff] px-[1.1rem] py-4">
          <p className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
            Est. Pipeline Revenue
          </p>
          <p className="text-[22px] font-semibold leading-none text-[#2563eb]">
            {formatAmount(totals.pipeline_revenue)}
          </p>
          <p className="mt-[5px] text-[11px] text-[var(--text3)]">
            orders in approved / shipped
          </p>
        </div>

        {/* 1-Year Projected */}
        <div className="rounded-[var(--r)] border border-[#ddd6fe] bg-[#f5f3ff] px-[1.1rem] py-4">
          <p className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
            1 Year Est. Projected Revenue
          </p>
          <p className="text-[22px] font-semibold leading-none text-[#7c3aed]">
            {formatAmount(totals.one_year_projected)}
          </p>
          <p className="mt-[5px] text-[11px] text-[var(--text3)]">
            based on period avg
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 7: Update `AccountsFilters` to include period dropdown

**Files:**
- Modify: `accounts/(components)/AccountsFilters.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { TableToolbar } from "@/app/(components)/TableToolbar";
import {
  ACCOUNT_STATUS_FILTER_OPTIONS,
  ACCOUNT_PERIOD_OPTIONS,
} from "@/utils/constants/accounts";
import type { FilterSelect } from "@/utils/interfaces/table-toolbar";
import type { IRepProfile, AccountStatus, AccountPeriod } from "@/utils/interfaces/accounts";

export function AccountsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  repFilter,
  onRepFilterChange,
  periodFilter,
  onPeriodFilterChange,
  salesReps,
  isAdmin,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: AccountStatus | "all";
  onStatusFilterChange: (v: AccountStatus | "all") => void;
  repFilter: string;
  onRepFilterChange: (v: string) => void;
  periodFilter: AccountPeriod;
  onPeriodFilterChange: (v: AccountPeriod) => void;
  salesReps: IRepProfile[];
  isAdmin: boolean;
}) {
  const repOptions = [
    { value: "all", label: "All reps" },
    ...salesReps.map((rep) => ({
      value: rep.id,
      label: `${rep.first_name} ${rep.last_name}`,
    })),
  ];

  const filters: FilterSelect[] = [
    {
      value: statusFilter,
      onChange: (v) => onStatusFilterChange(v as AccountStatus | "all"),
      options: ACCOUNT_STATUS_FILTER_OPTIONS,
      placeholder: "All statuses",
      className: "w-full sm:w-44",
    },
    ...(isAdmin
      ? [
          {
            value: repFilter,
            onChange: onRepFilterChange,
            options: repOptions,
            placeholder: "All reps",
            className: "w-full sm:w-52",
          } satisfies FilterSelect,
        ]
      : []),
    {
      value: periodFilter,
      onChange: (v) => onPeriodFilterChange(v as AccountPeriod),
      options: ACCOUNT_PERIOD_OPTIONS,
      placeholder: "This Month",
      className: "w-full sm:w-40",
    },
  ];

  return (
    <TableToolbar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search accounts..."
      className="flex-col sm:flex-row"
      filters={filters}
    />
  );
}
```

---

## Task 8: Replace `AccountsList` with metrics columns

**Files:**
- Modify: `accounts/(sections)/AccountsList.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { useMemo, useState } from "react";
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
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { IRepProfile, AccountStatus, AccountPeriod, IAccountWithMetrics } from "@/utils/interfaces/accounts";

export function AccountsList({ salesReps, isAdmin, period }: {
  salesReps: IRepProfile[];
  isAdmin: boolean;
  period: AccountPeriod;
}) {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const accounts    = useAppSelector((state) => state.accounts.items);
  const role        = useAppSelector((s) => s.dashboard.role) as UserRole;
  const userId      = useAppSelector((s) => s.dashboard.userId);
  const isRep       = isSalesRep(role);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [repFilter,    setRepFilter]    = useState<string>("all");
  const [ownerFilter,  setOwnerFilter]  = useState<"all" | "mine" | "sub_reps">("all");

  const myCount      = isRep ? accounts.filter((a) => a.assigned_rep === userId).length : 0;
  const subRepCount  = isRep ? accounts.filter((a) => a.assigned_rep && a.assigned_rep !== userId).length : 0;

  const filtered = useMemo(() => {
    let result = accounts;
    if (isRep && ownerFilter === "mine")      result = result.filter((a) => a.assigned_rep === userId);
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
    return result;
  }, [accounts, search, statusFilter, repFilter, isAdmin, isRep, ownerFilter, userId]);

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
      key: "signed",
      label: "Signed",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (a) => <span className="text-sm text-[var(--navy)]">{a.signed_count}</span>,
    },
    {
      key: "avg_day",
      label: "Avg/Day",
      headerClassName: "hidden md:table-cell text-right",
      cellClassName: "hidden md:table-cell text-right",
      render: (a) => <span className="text-sm text-[var(--text2)]">{(a.avg_day ?? 0).toFixed(1)}</span>,
    },
    {
      key: "avg_week",
      label: "Avg/Week",
      headerClassName: "hidden md:table-cell text-right",
      cellClassName: "hidden md:table-cell text-right",
      render: (a) => <span className="text-sm text-[var(--text2)]">{(a.avg_week ?? 0).toFixed(1)}</span>,
    },
    {
      key: "one_year_est",
      label: "1 Year Est.",
      headerClassName: "hidden lg:table-cell text-right",
      cellClassName: "hidden lg:table-cell text-right",
      render: (a) => (
        <span className="text-sm font-medium text-[var(--navy)]">
          {(a.one_year_est ?? 0) > 0 ? a.one_year_est : "—"}
        </span>
      ),
    },
    {
      key: "delivered",
      label: "Delivered",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (a) => (
        <span className={cn("text-sm font-medium", (a.delivered_count ?? 0) > 0 ? "text-[var(--green)]" : "text-[var(--text3)]")}>
          {a.delivered_count ?? 0}
        </span>
      ),
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

      {/* Rep ownership filter tabs (sales_rep only) */}
      {isRep && (
        <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5 w-fit">
          {(
            [
              { key: "all",      label: "All Accounts",     count: accounts.length },
              { key: "mine",     label: "My Accounts",      count: myCount         },
              { key: "sub_reps", label: "Sub-Rep Accounts", count: subRepCount     },
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
```

---

## Task 9: Extend `IRepPerformanceSummary`

**Files:**
- Modify: `utils/interfaces/quotas.ts`

- [ ] **Step 1: Add two fields to `IRepPerformanceSummary`**

Replace the existing `IRepPerformanceSummary` interface:

```typescript
export interface IRepPerformanceSummary {
  currentPeriod: string;
  myPerformance: IRepPerformance | null;
  subRepPerformance: IRepPerformance[];
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  pipelineRevenue: number;
  oneYearProjectedRevenue: number;
}
```

---

## Task 10: Compute new fields in `getRepPerformanceSummary`

**Files:**
- Modify: `rep-performance/(services)/actions.ts`

- [ ] **Step 1: Add `buildRevenueExtras` helper after the existing `getMonthlyRevenue` helper**

Add this function (before the `getQuotas` export):

```typescript
async function buildRevenueExtras(
  repId: string | null,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<{ pipelineRevenue: number; oneYearProjectedRevenue: number }> {
  // Facilities for this rep (null = all facilities for admin)
  let facilityIds: string[] | null = null;
  if (repId) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id")
      .eq("assigned_rep", repId);
    facilityIds = (facs ?? []).map((f: any) => f.id as string);
    if (facilityIds.length === 0) return { pipelineRevenue: 0, oneYearProjectedRevenue: 0 };
  }

  // Pipeline: approved or shipped orders
  let pipelineQ = adminClient
    .from("orders")
    .select("id")
    .in("order_status", ["approved", "shipped"]);
  if (facilityIds) pipelineQ = pipelineQ.in("facility_id", facilityIds);
  const { data: pipelineOrders } = await pipelineQ;

  const pipelineOrderIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
  let pipelineRevenue = 0;
  if (pipelineOrderIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("total_amount")
      .in("order_id", pipelineOrderIds);
    pipelineRevenue = (items ?? []).reduce(
      (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
    );
  }

  // Trailing 3-month delivered revenue for 1-year projection
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();

  let deliveredQ = adminClient
    .from("orders")
    .select("id")
    .eq("delivery_status", "delivered")
    .gte("delivered_at", start);
  if (facilityIds) deliveredQ = deliveredQ.in("facility_id", facilityIds);
  const { data: deliveredOrders } = await deliveredQ;

  const deliveredIds = (deliveredOrders ?? []).map((o: any) => o.id as string);
  let trailing3moRevenue = 0;
  if (deliveredIds.length > 0) {
    const { data: items } = await adminClient
      .from("order_items")
      .select("total_amount")
      .in("order_id", deliveredIds);
    trailing3moRevenue = (items ?? []).reduce(
      (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
    );
  }

  const oneYearProjectedRevenue = (trailing3moRevenue / 13) * 52;

  return { pipelineRevenue, oneYearProjectedRevenue };
}
```

- [ ] **Step 2: Call `buildRevenueExtras` inside `getRepPerformanceSummary` and return the new fields**

In `getRepPerformanceSummary`, find the `return` statement at the bottom:

```typescript
  return { currentPeriod: period, myPerformance, subRepPerformance, monthlyRevenue };
```

Replace it with:

```typescript
  const { pipelineRevenue, oneYearProjectedRevenue } = await buildRevenueExtras(
    isSalesRep(role) ? user.id : null,
    adminClient,
  );

  return {
    currentPeriod: period,
    myPerformance,
    subRepPerformance,
    monthlyRevenue,
    pipelineRevenue,
    oneYearProjectedRevenue,
  };
```

---

## Task 11: Add 2 new KPI cards to `RepKpiRow`

**Files:**
- Modify: `rep-performance/(sections)/RepKpiRow.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { KpiCard } from "@/app/(components)/KpiCard";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export default function RepKpiRow() {
  const perf     = useAppSelector((s) => s.repPerformance.summary?.myPerformance ?? null);
  const pipeline = useAppSelector((s) => s.repPerformance.summary?.pipelineRevenue ?? 0);
  const projected = useAppSelector((s) => s.repPerformance.summary?.oneYearProjectedRevenue ?? 0);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-3">
      <KpiCard
        label="Revenue This Month"
        value={formatAmount(perf?.actualRevenue ?? 0)}
        accentColor="teal"
      />
      <KpiCard
        label="Orders This Month"
        value={String(perf?.paidOrders ?? 0)}
        accentColor="blue"
      />
      <KpiCard
        label="Commission Earned"
        value={formatAmount(perf?.commissionEarned ?? 0)}
        accentColor="green"
      />
      <KpiCard
        label="Avg Order Value"
        value={formatAmount(perf?.avgOrderValue ?? 0)}
        accentColor="purple"
      />
      <KpiCard
        label="Est. Pipeline Revenue"
        value={formatAmount(pipeline)}
        accentColor="blue"
      />
      <KpiCard
        label="1 Year Est. Projected"
        value={formatAmount(projected)}
        accentColor="purple"
      />
    </div>
  );
}
```

---

## Task 12: Build check

- [ ] **Step 1: Run the build**

```bash
npm run build 2>&1 | tail -40
```

Expected: `Route (app)` table with no type errors. Fix any TypeScript or import errors before proceeding.

- [ ] **Step 2: Spot check the accounts page in the browser**

Start the dev server (`npm run dev`) and visit `/dashboard/accounts` as:
1. A sales rep — verify KPI rows appear, table shows Signed/Avg/Delivered/Invited By/Onboarded columns, period dropdown works (changes URL to `?period=last_3_months` etc.)
2. An admin — verify same columns and KPI rows appear, rep filter dropdown still present

- [ ] **Step 3: Spot check the rep-performance page**

Visit `/dashboard/rep-performance` as a sales rep — verify the KPI row now shows 6 cards including "Est. Pipeline Revenue" and "1 Year Est. Projected".
