# Sales Dashboard — Design Spec
**Date:** 2026-04-15  
**Scope:** Enhance existing Accounts and Rep Performance pages for both `sales_representative` and `admin` roles to match the client's reference dashboard (Lucas AI Sales Dashboard).

---

## Overview

Two existing pages get enhanced. Both admins and reps see the new enriched accounts view.

| Page | Change |
|---|---|
| `/dashboard/accounts` | All roles see KPI rows + enriched table with per-account order metrics + period filter. Admins see all accounts; reps see accounts scoped to them and their sub-reps. |
| `/dashboard/rep-performance` | Two new KPI cards added (Pipeline Revenue, 1-Year Est. Projected) |

ABC tiers are out of scope for this iteration.

---

## 1. Accounts Page (`/dashboard/accounts`)

### 1.1 KPI Row 1 — Counts
Four cards rendered above the table for all roles:

| Card | Value |
|---|---|
| Accounts | Total facility count visible to the rep |
| Total Signed Orders | COUNT orders with `order_status NOT IN ('draft','canceled')`, period-filtered |
| Delivered | COUNT orders with `delivery_status = 'delivered'`, period-filtered |
| (4th card reserved / blank for now) | — |

### 1.2 KPI Row 2 — Revenue
Three cards rendered below the counts row:

| Card | Value | Secondary |
|---|---|---|
| Delivered Revenue | SUM `order_items.unit_price × quantity` for delivered orders, period-filtered | `N orders · $X commission` |
| Est. Pipeline Revenue | SUM order items for orders in `approved` or `shipped` status | `N orders in flight · $X commission` |
| 1 Year Est. Projected Revenue | `(delivered_revenue / weeks_in_period) × 52` | `trailing period avg · $X commission` |

Commission amounts = revenue × rep's current `commission_rate` (from existing commissions system).

### 1.3 Period Filter
Added to the filter bar for all roles, alongside the existing view toggle (rep) / rep filter dropdown (admin) and search. Options:

- This Month *(default)*
- Last 3 Months
- All Time

Period selection is stored in Redux accounts slice. Changing the period triggers a page-level re-fetch via `router.refresh()` or a Redux-driven re-query (implementation detail to decide in plan).

### 1.4 Enhanced Table Columns (all roles)
Replaces the current CRM columns (Status, Assigned Rep, Location, Contacts, Orders) with:

| Column | Value | Notes |
|---|---|---|
| Account / Provider | `facility.name` + city/state | Same as current |
| Signed | `signed_count` | Period-filtered |
| Avg/Day | `signed_count / days_since_onboarded` | 2 decimal places |
| Avg/Week | `signed_count / weeks_since_onboarded` | 2 decimal places |
| 1 Year Est. | `avg_week × 52` — projected **order count** for the year | Whole number; show `—` if avg_week is 0 |
| Delivered | `delivered_count` | Green text if > 0 |
| Invited By | Assigned rep's first + last name (abbreviated) | `—` if unassigned |
| Onboarded | `facility.created_at` formatted as MM/DD/YYYY | — |

Rows still navigate to `/dashboard/accounts/[id]` on click.

### 1.5 New Component: `AccountsKpiRow`
File: `app/(dashboard)/dashboard/accounts/(sections)/AccountsKpiRow.tsx`  
Renders the two KPI rows. Receives totals computed from the accounts Redux slice via selectors. Shown for all roles.

### 1.6 Role scoping
- **Admin:** `getAccountsWithMetrics()` returns all facilities. Rep filter dropdown still present to narrow results. KPI rows reflect currently filtered set.
- **Sales rep:** `getAccountsWithMetrics()` returns only facilities assigned to the rep or their sub-reps. View toggle (All / My Accounts / Sub-Rep) still present.

---

## 2. Rep Performance Page — KPI Row Extension (`/dashboard/rep-performance`)

Two new KPI cards appended to `RepKpiRow.tsx` (extending from 4 → 6 cards):

| Card | Value | Secondary |
|---|---|---|
| Est. Pipeline Revenue | SUM order items for the rep's accounts in `approved` or `shipped` status | N orders in flight |
| 1 Year Est. Projected Revenue | `(actual_revenue_trailing_3mo / 13_weeks) × 52` | trailing 3 months avg |

Everything else on the page is unchanged (RepHero, QuickLogBanner, RepTables, AdminQuotaBoard).

---

## 3. Data Layer

### 3.1 New Server Action: `getAccountsWithMetrics`
**File:** `app/(dashboard)/dashboard/accounts/(services)/actions.ts`

```
getAccountsWithMetrics(period: "this_month" | "last_3_months" | "all_time"): Promise<IAccountWithMetrics[]>
```

- Auth: `sales_representative` or `admin` (redirects otherwise)
- Fetches facilities scoped by role: reps see their own + sub-rep accounts; admins see all
- Joins `orders` + `order_items` per facility
- Returns per-facility aggregates: `signed_count`, `delivered_count`, `avg_day`, `avg_week`, `one_year_est`, `onboarded_at`, `invited_by_name`, `delivered_revenue`, `pipeline_revenue`, `commission_amount`
- Period filtering applied via `placed_at` date range on orders

### 3.2 Extended Server Action: `getRepPerformanceSummary`
**File:** `app/(dashboard)/dashboard/rep-performance/(services)/actions.ts`

Add two new fields to the returned summary:
- `pipelineRevenue: number` — SUM of order items for the rep's approved/shipped orders
- `oneYearProjectedRevenue: number` — trailing 3-month revenue extrapolated to 12 months

### 3.3 New Interface: `IAccountWithMetrics`
**File:** `utils/interfaces/accounts.ts`

Extends `IAccount` with optional metric fields:

```ts
interface IAccountWithMetrics extends IAccount {
  signed_count?: number;
  delivered_count?: number;
  avg_day?: number;
  avg_week?: number;
  one_year_est?: number;
  onboarded_at?: string;
  invited_by_name?: string | null;
  delivered_revenue?: number;
  pipeline_revenue?: number;
  commission_amount?: number;
}
```

### 3.4 Redux Changes
**Accounts slice:**
- `items` typed as `IAccountWithMetrics[]` (metric fields optional — admin path unaffected)
- Add `period: "this_month" | "last_3_months" | "all_time"` field (default: `"this_month"`)
- Add `setPeriod` action

**Rep performance slice:**
- Extend `IRepPerformanceSummary` with `pipelineRevenue` and `oneYearProjectedRevenue`

---

## 4. Files Changed

### New files
| File | Purpose |
|---|---|
| `accounts/(sections)/AccountsKpiRow.tsx` | Two KPI rows (counts + revenue) for all roles |

### Modified files
| File | Change |
|---|---|
| `accounts/(services)/actions.ts` | Add `getAccountsWithMetrics()` |
| `accounts/page.tsx` | Both roles call `getAccountsWithMetrics()`; `getAccounts()` retired from this page |
| `accounts/(sections)/AccountsList.tsx` | Replace CRM columns with metric columns + period dropdown for all roles |
| `accounts/(sections)/Providers.tsx` | Pass `IAccountWithMetrics[]` to Redux |
| `utils/interfaces/accounts.ts` | Add `IAccountWithMetrics` |
| `store/accounts-slice.ts` | Add `period` field + `setPeriod` action |
| `rep-performance/(sections)/RepKpiRow.tsx` | Add 2 new KPI cards |
| `rep-performance/(services)/actions.ts` | Add `pipelineRevenue` + `oneYearProjectedRevenue` to summary |
| `utils/interfaces/quotas.ts` | Extend `IRepPerformanceSummary` with new revenue fields |

---

## 5. Out of Scope (this iteration)
- ABC Tier system (A/B/C badges per account)
- "Generate Report" button
- Sales Reps, Revenue, Onboarding, Media tabs from the reference image
