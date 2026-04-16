# Sales Rep Dashboard Redesign

**Date:** 2026-04-16
**Scope:** Expand the sales-rep view of `/dashboard` (`RepDashboard`) from a sparse counts-only layout into a working dashboard: revenue trend chart with quota reference, pipeline funnel, top accounts, unified "Today's Focus" action panel, and two new sensing KPIs (MoM Growth, Active Doctors). Admin/Support/Clinic dashboards are out of scope.

---

## 1. Overview

Currently the rep dashboard answers only "how many orders / accounts / tasks do I have" and "what's on my task list". This redesign adds charts and actionable groupings so a rep can read the state of their business in ~5 seconds and know what to do today. Reuses existing data (`getOrdersByRep`, `getTasksByAssignee`, `getAccounts`, `getRepCommissionSummary`, commission rates) plus small new derivations — no schema changes.

---

## 2. Layout

Rendered inside the existing `RepDashboard` component. Top-to-bottom:

### 2.1 Row 1 — KPI count row (unchanged)
4 cards: My Accounts / Open Tasks / My Orders / Active Orders.

### 2.2 Row 2 — KPI commission row (unchanged)
2 cards: Commission Earned / Pending Payout. Only rendered when `commissionSummary != null`.

### 2.3 Row 3 — Sensing KPI row (NEW)
2 small cards side-by-side:

| Card | Value | Subtitle |
|---|---|---|
| MoM Revenue Growth | `+N.N%` (green if positive) or `-N.N%` (red) | `vs. last month` |
| Active Doctors | count of distinct `assigned_provider_id` on rep's orders in last 90 days | `in last 90 days` |

### 2.4 Row 4 — Charts row (NEW)
Grid: `grid-cols-1 lg:grid-cols-[2fr_1fr]` gap-5.

**Left (2/3): Revenue Trend**
- Recharts `LineChart`, height ~220px
- X-axis: last 6 months (labels `MMM YY`)
- Y-axis: delivered revenue dollars, `Nk` tick formatter when ≥1000
- Data line: rep's monthly delivered revenue
- Reference: dashed horizontal `<ReferenceLine>` at the current-month quota value (if set); hidden if no quota
- Title: "Revenue Trend"
- Subtitle: "Last 6 months · quota: $X" (or "no quota set")

**Right (1/3): Pipeline Funnel**
- Horizontal bar chart using Recharts `BarChart layout="vertical"`, height ~220px
- One bar per order status in this order: Pending Signature / Mfr Review / Info Needed / Approved / Shipped / Delivered (draft and canceled excluded)
- Bar length = count. Label inside bar: `N · $X` (count + total dollar value summed from `order_items`)
- Colors reuse `KANBAN_STATUS_CONFIG[status].dot` hex (or a mapped palette if dot classes don't yield hex cleanly)

### 2.5 Row 5 — Action row (NEW)
Grid: `grid-cols-1 lg:grid-cols-2` gap-5.

**Left (1/2): Top 5 Accounts**
- Card with title "Top Accounts" + subtitle "Last 3 months delivered revenue"
- 5 rows, each:
  - Rank pill (`1` / `2` / ...)
  - Account name + `city, state`
  - Right-aligned dollar amount (bold navy)
- Row click → `router.push('/dashboard/accounts/[id]')`
- Empty state: "No delivered revenue yet in the last 3 months"

**Right (1/2): Today's Focus**
- Card with title "Today's Focus"
- Three grouped lists, each with a colored dot + heading + item count:
  1. **Overdue Tasks** (red dot) — tasks where `status='open' AND due_date < now`. Each row: title + `Overdue by N days` + facility name.
  2. **Due This Week** (gold dot) — tasks where `status='open' AND due_date BETWEEN now AND now+7d`. Each row: title + due date (relative) + facility name.
  3. **Orders Needing Attention** (blue dot) — rep's orders where `order_status IN ('pending_signature', 'additional_info_needed')`. Each row: `Order # · Patient · Status pill`.
- Row clicks:
  - Task → `router.push('/dashboard/accounts/[facility_id]')` (tab defaults to Activities or stays on Overview; route as today's tasks page navigates)
  - Order → opens existing `OrderDetailModal` via an ID callback
- Each group: hide if it has 0 items; if all three empty, show friendly "All clear" state

### 2.6 Quick Actions panel (REMOVED)
Deleted — sidebar already provides these links.

---

## 3. Data layer

### 3.1 `dashboard/page.tsx` additions

Alongside the existing `getOrdersByRep(userId)` / tasks / accounts / `getRepCommissionSummary()` fetches for reps, add:

1. **`getMonthlyRevenue(repId, 6)`** — already exists at `rep-performance/(services)/actions.ts`; reuse. Returns `Array<{ period: string; revenue: number }>` for last 6 months.
2. **Current-month quota** — query `sales_quotas` for this rep's current period, or reuse whatever action already fetches quotas for this rep (e.g., `getQuotas()`).
3. **Top accounts trailing 3 months** — new server action `getTopAccountsByRep(repId, limit=5)`:
   - For rep's assigned facilities, sum `order_items.total_amount` of orders where `delivery_status='delivered'` and `delivered_at >= now-90d`
   - Sort desc, take top 5
   - Return `Array<{ id, name, city, state, deliveredRevenue }>`
4. **Active doctors 90d** — derived from the already-loaded `orders` client-side: distinct `assigned_provider_id` over orders with `placed_at >= now-90d`. No new fetch needed.
5. **MoM revenue growth** — derived from `monthlyRevenue[last]` vs `monthlyRevenue[last-1]`. No new fetch.

### 3.2 New server action `getTopAccountsByRep`

**File:** `app/(dashboard)/dashboard/(services)/dashboard-actions.ts` (new file) OR append to existing dashboard actions

```ts
export async function getTopAccountsByRep(
  repId: string,
  limit = 5,
): Promise<Array<{ id: string; name: string; city: string; state: string; deliveredRevenue: number }>>
```

Implementation:
- `createAdminClient` (for cross-table join performance)
- Query `facilities` where `assigned_rep = repId AND facility_type='clinic'`
- Query `orders` where `facility_id IN (ids) AND delivery_status='delivered' AND delivered_at >= cutoff`
- Query `order_items` where `order_id IN (orderIds)` → sum `total_amount` per facility
- Merge, sort desc by revenue, limit N

### 3.3 Props wired into `RepDashboard`

Extend the existing signature:

```ts
export function RepDashboard({
  orders,
  tasks,
  accounts,
  commissionSummary,
  monthlyRevenue,          // new
  currentQuota,            // new — number | null
  topAccounts,             // new
}: { ... })
```

---

## 4. Components

### 4.1 `RevenueTrendChart.tsx` (new)
**File:** `app/(dashboard)/dashboard/(sections)/RevenueTrendChart.tsx`
Props: `data: Array<{ period: string; revenue: number }>`, `quota: number | null`.
Renders card + Recharts LineChart + optional ReferenceLine for quota.

### 4.2 `PipelineFunnel.tsx` (new)
**File:** `app/(dashboard)/dashboard/(sections)/PipelineFunnel.tsx`
Props: `orders: DashboardOrder[]`.
Groups client-side, renders Recharts `BarChart layout="vertical"` with status categories.

### 4.3 `TopAccountsCard.tsx` (new)
**File:** `app/(dashboard)/dashboard/(sections)/TopAccountsCard.tsx`
Props: `items: Array<{ id, name, city, state, deliveredRevenue }>`.
5 clickable rows + empty state.

### 4.4 `TodaysFocus.tsx` (new)
**File:** `app/(dashboard)/dashboard/(sections)/TodaysFocus.tsx`
Props: `tasks: ITask[]`, `orders: DashboardOrder[]`, `onOrderClick: (orderId) => void`.
Splits tasks into overdue + due-this-week buckets internally, filters orders to attention-needing statuses.

### 4.5 `SensingKpiRow.tsx` (new)
**File:** `app/(dashboard)/dashboard/(sections)/SensingKpiRow.tsx`
Props: `monthlyRevenue: Array<{ period; revenue }>`, `orders: DashboardOrder[]`.
Computes `momGrowthPct` and `activeDoctors90d` client-side; renders 2 cards.

### 4.6 `RepDashboard.tsx` (modify)
Accepts the new props, composes the new components into the layout. Removes Quick Actions panel.

---

## 5. Files Changed

### New files
| File | Purpose |
|---|---|
| `(sections)/RevenueTrendChart.tsx` | Line chart + quota reference line |
| `(sections)/PipelineFunnel.tsx` | Horizontal bar funnel |
| `(sections)/TopAccountsCard.tsx` | Top 5 accounts list |
| `(sections)/TodaysFocus.tsx` | Overdue + due-week tasks + attention-orders |
| `(sections)/SensingKpiRow.tsx` | MoM growth + active doctors cards |
| `(services)/dashboard-actions.ts` | `getTopAccountsByRep` |

### Modified files
| File | Change |
|---|---|
| `(sections)/RepDashboard.tsx` | Add new props, compose new components, drop Quick Actions panel |
| `dashboard/page.tsx` | For rep role, fetch `monthlyRevenue`, `currentQuota`, `topAccounts` and pass to `RepDashboard` |

---

## 6. Out of Scope
- Admin / Support / Clinic dashboards
- Revenue cascade calculator (separate phase 2 feature deferred)
- Quota editing from dashboard (use rep-performance / sub-rep detail pages)
- Per-sub-rep widgets on the rep dashboard (My Team is the place for that)
- Filters / period selector on the dashboard (snapshot view — use rep-performance for drill-down)
- Exporting dashboard as PDF/CSV
- Customizable widget layout (drag-reorder, hide/show)
