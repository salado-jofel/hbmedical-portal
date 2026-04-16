# My Team — Lucas Redesign Spec

**Date:** 2026-04-16
**Scope:** Replace the current `/dashboard/my-team` hierarchy tree with a flat Lucas-style layout: 5 KPI cards at top, a filter bar (status chips, rep-only view chips, period dropdown, search), and a flat card-style rep list with stat blocks and a status pill. Rows remain clickable into the existing sub-rep detail page. The detail page's accounts table becomes display-only (no row links).

---

## 1. Overview

Today the page renders a hierarchy tree component (`RepTree`) for admin and `TeamView` (card grid) for sales reps. Both are replaced with a single new layout that mirrors the Lucas Sales Representatives screen. All changes are on `/dashboard/my-team` and one touch to the sub-rep detail's accounts table.

The existing `getRepTree` action is replaced with `getRepList(period, statusFilter)` returning a flat list already filtered/sorted. A new `getMyTeamKpis(period)` action computes the 5 KPI aggregates in a single call. `getMySubReps` is extended with period-filtered order/delivery/revenue/commission numbers so the rep view reuses the same row component.

---

## 2. KPI row (5 cards)

Row of 5 equal-width cards at the top, horizontal grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`). Each card has a large number and a small subtitle.

| Card | Value | Subtitle |
|---|---|---|
| Total Reps | count of reps in the current list | `N direct · M indirect` (admin: roots vs. nested; rep: always `0 direct · N indirect`) |
| Total Accounts | sum across reps in view | `N direct · M via team` (rep: my own accounts vs. sub-reps'; admin: direct reports' accounts vs. the rest) |
| Total Orders | sum within selected period | `N delivered` |
| Delivered Revenue | sum within selected period | `N orders confirmed` — green accent |
| Active Reps | count with `profiles.status = 'active'` | `of N total` |

**Period-scoped:** Total Orders (value), Delivered (subtitle count), Delivered Revenue, Commission (used internally for row data), Commission subtitle number if applicable.
**Not period-scoped:** Total Reps, Total Accounts, Active Reps.

---

## 3. Filter bar

Horizontal row above the list. Left to right:

### 3.1 Status chips (both roles)
Segmented button group: **All** / **Active** / **Inactive**. Filters rows by `profiles.status`. Default: `All`.

### 3.2 View chips (rep only; hidden for admin)
Segmented group: **All Sub-Reps** / **Direct Only**.
- **All Sub-Reps**: every rep in the viewer's recursive downline
- **Direct Only**: depth-1 children only (where `parent_rep_id = user.id`)

Default: `All Sub-Reps`.

### 3.3 Period dropdown (both roles)
`This Month` / `Last 3 Months` / `All Time`. Default: `This Month`. Drives the period-scoped KPIs and per-row `orders / delivered / commission` numbers.

### 3.4 Search input
Name or email substring match, client-side. Filters the already-fetched list.

---

## 4. Rep list rows

Flat vertical list; no indentation, no expand/collapse. Each row is a clickable link to `/dashboard/my-team/[repId]`.

### 4.1 Row layout (desktop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Name (bold, 14px)                                                          │
│  email@domain.com (11px gray)             [N Accounts] [N Orders]           │
│                                           [N Delivered] [$X.XX Commission]   │
│                                                                   [Active]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Grid: `grid-cols-[1fr_auto_auto]` — name+email left, stat blocks in the middle, status pill right.

- Name/email block: name 14px semibold navy; email 11px gray.
- Stat blocks: 4 horizontal blocks, each with a big number (16px semibold) and a tiny all-caps label below (10px gray). Labels: `ACCOUNTS`, `ORDERS`, `DELIVERED`, `COMMISSION`.
- Status pill: right-aligned. `Active` → green bg/text; `Not Active` → red bg/text; anything else → gray.

### 4.2 Row backing data
Each row needs:
- `id`, `first_name`, `last_name`, `email`, `status`
- `accountCount` (structural, not period-scoped)
- `ordersInPeriod` (period-scoped)
- `deliveredInPeriod` (period-scoped)
- `commissionInPeriod` (period-scoped)

---

## 5. Detail page changes

### 5.1 Accounts table becomes display-only

**File:** `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepAccounts.tsx`

Change the `Account / Provider` column's render:
- **Before:** wraps name + city/state in a `<Link href={/dashboard/accounts/[id]}>` with hover underline.
- **After:** plain `<div>` with no link, no hover state. Name + city/state as static text.

Rationale: per client direction, viewing account detail happens only from the accounts page. Detail page is an audit/review view of the rep's book.

### 5.2 Quota management section (new)

**File:** `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepQuotaSection.tsx`

Rendered immediately after `<SubRepHero />`, before `<SubRepKpiRow />`. Groups quota context with the Hero's attainment progress bar.

Contents:
- Header: "Quota — <Month Year>"
- Current state text:
  - If quota is set: `$X target · Y% attained` (reuses `detail.quota` and `detail.attainmentPct` from `ISubRepDetail`)
  - If not set: `No quota set for this period`
- "Set Quota" button → opens a dialog with:
  - Period field (pre-filled with current period, editable to allow setting future periods)
  - Target amount (numeric input)
  - Submit button (uses the existing `setQuota` server action)
- On success → `router.refresh()` to re-fetch detail

### 5.3 `setQuota` authorization relaxed

**File:** `app/(dashboard)/dashboard/rep-performance/(services)/actions.ts`

Today `setQuota` starts with `await requireAdminOrThrow(supabase)`. Replace with:
- **Admin** → always allowed
- **Sales rep** → allowed only if the target `rep_id` exists in `rep_hierarchy` with `parent_rep_id = user.id AND child_rep_id = rep_id`
- **Otherwise** → return `{ success: false, error: "Unauthorized." }`

The validation schema and upsert logic stay unchanged.

---

## 6. Data layer

### 6.1 New action `getRepList(period, statusFilter)`

**File:** `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

Returns a flat `IRepListRow[]` already scoped by viewer role:
- **Admin:** every sales rep in the portal
- **Sales rep:** recursive downline via `rep_hierarchy`

Signature:
```ts
getRepList(
  period: AccountPeriod,
  statusFilter: "all" | "active" | "inactive",
): Promise<IRepListRow[]>
```

Internals reuse logic from current `getRepTree` for enrichment (accounts per rep, orders, rates, commission) but return a flat list rather than building the parent/child tree.

`getRepTree` is removed in this change.

### 6.2 New action `getMyTeamKpis(period)`

Returns the 5 KPI values + their subtitle numbers:

```ts
interface IMyTeamKpis {
  totalReps: number;
  repsDirect: number;
  repsIndirect: number;
  totalAccounts: number;
  accountsDirect: number;
  accountsViaTeam: number;
  totalOrders: number;
  orders_delivered: number;   // how many of the total are delivered
  deliveredRevenue: number;
  deliveredOrdersConfirmed: number;  // = orders_delivered, kept distinct for clarity
  activeReps: number;
  activeRepsTotalDenominator: number;
}
```

Scope mirrors `getRepList`: admin → global; rep → downline (plus viewer themselves for accounts-direct/orders).

### 6.3 `getMySubReps` extension

Enrich each `SubRep` with:
- `ordersInPeriod: number`
- `deliveredInPeriod: number`
- `commissionInPeriod: number`

Takes a period arg:
```ts
getMySubReps(period?: AccountPeriod): Promise<SubRep[]>
```

Defaults to `this_month`. Used by the rep-view row data.

### 6.4 New types in `utils/interfaces/my-team.ts`

```ts
export interface IRepListRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  isDirect: boolean;               // admin: is root (no parent); rep: is direct child
  accountCount: number;
  ordersInPeriod: number;
  deliveredInPeriod: number;
  commissionInPeriod: number;
  commissionRate: number;
  overridePercent: number;
}

export interface IMyTeamKpis { /* as above */ }
```

`IRepTreeNode` is removed.

---

## 7. UI Components

### 7.1 `MyTeamKpiRow.tsx` (new)
Client component. Reads from Redux (`myTeam` slice gains `kpis` field). Renders the 5-card grid. Green accent on "Delivered Revenue".

### 7.2 `MyTeamFilterBar.tsx` (new)
Client component. Holds:
- Status segmented group state
- View segmented group state (only visible for rep)
- Period dropdown
- Search input (controlled)

Changing period/status/view triggers a URL navigation (`router.push(...?period=&status=&view=)`) so the server action re-runs with new filters. Search is client-side only.

### 7.3 `RepListRow.tsx` (new)
Client component. Renders one row (name+email + 4 stat blocks + status pill) inside a `<Link>`.

### 7.4 `RepListView.tsx` (new)
Container: reads rows from Redux, applies client-side search filter, renders `RepListRow` for each. Shows empty state when 0 rows.

### 7.5 Components removed
- `RepTree.tsx` (deleted)
- `TeamView.tsx` — either deleted or refactored to call the new components

---

## 8. Redux

`my-team-slice.ts` gains:
- `rows: IRepListRow[]`
- `kpis: IMyTeamKpis | null`
- `setRows(rows)`, `setKpis(kpis)` actions

(Keep existing `items` and `setItems` if they're used elsewhere; otherwise remove them when migrating.)

---

## 9. Files Changed

### New files
| File | Purpose |
|---|---|
| `my-team/(sections)/MyTeamKpiRow.tsx` | 5-card KPI row |
| `my-team/(sections)/MyTeamFilterBar.tsx` | Status/view/period/search bar |
| `my-team/(sections)/RepListRow.tsx` | Single row component |
| `my-team/(sections)/RepListView.tsx` | List container w/ search filter |
| `my-team/[subRepId]/(sections)/SubRepQuotaSection.tsx` | Quota display + set dialog |

### Modified files
| File | Change |
|---|---|
| `utils/interfaces/my-team.ts` | Add `IRepListRow`, `IMyTeamKpis`; remove `IRepTreeNode` |
| `my-team/(services)/actions.ts` | Add `getRepList`, `getMyTeamKpis`; extend `getMySubReps` with period; remove `getRepTree` |
| `my-team/(redux)/my-team-slice.ts` | Add `rows`, `kpis` fields + actions |
| `my-team/page.tsx` | Fetch rows+kpis based on URL search params; render new components |
| `my-team/[subRepId]/(sections)/SubRepAccounts.tsx` | Remove `<Link>` wrapper on Account column |
| `my-team/[subRepId]/page.tsx` | Render `<SubRepQuotaSection />` between Hero and KpiRow |
| `rep-performance/(services)/actions.ts` | Relax `setQuota` auth — allow reps for their direct sub-reps |

### Deleted files
| File |
|---|
| `my-team/(sections)/RepTree.tsx` |
| `my-team/(sections)/TeamView.tsx` (if no other consumer) |

---

## 10. Out of Scope
- "Generate Report" button (separate feature: CSV/PDF export)
- Dark mode toggle
- Inline rate editing from the list rows (stays on detail page)
- Pagination (list assumed ≤few hundred; client-side search is enough)
- Sort controls on columns (future)
