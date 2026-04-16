# Sub-Rep Detail, My-Team Rearrangement & Commissions Restructure — Design Spec

**Date:** 2026-04-16
**Scope:** Rearrange commissions/my-team responsibilities so that admins manage rep commissions and performance from My Team, reps manage their sub-reps from My Team, and the Commissions page becomes a display-only ledger (reps only; hidden from admin).

---

## 1. Overview

The existing Commissions page mixes display (ledger, payouts) with management (rate-setting, calculator). The client wants a cleaner split:

| Role | Commissions page | My Team page |
|---|---|---|
| Sales rep | Display-only ledger of **their own** commissions + a **Team Earnings** section showing override totals from their sub-reps | List of direct sub-reps; click any sub-rep → detail page (rate-setting, per-sub-rep calculator, KPIs, accounts, commission history) |
| Admin | **Hidden** — removed from sidebar; `/dashboard/commissions` redirects admins to `/dashboard/my-team` | Hierarchy tree of **all sales reps in the portal**; click any rep → same detail page (full rate/calculator access) |

The existing `RateManagement` + `CommissionCalculator` components are moved into the sub-rep detail page (scoped per rep). The Commissions page retains `CommissionLedger` + `PayoutTable` as display-only.

---

## 2. My Team page

### 2.1 Access & list scoping

Page is visible to sales reps and admins (unchanged). The list contents change by role:

- **Sales rep** — flat list of their direct sub-reps (as today, via `rep_hierarchy` filtered by `parent_rep_id = user.id`)
- **Admin** — hierarchy tree of all `sales_representative` profiles. Top-level reps (no parent) render as root rows; each expands to show their sub-reps indented below. Sub-sub-reps continue the nesting.

### 2.2 Rep view — SubRepCard enhancements

Existing `SubRepCard` card layout gains:
- New inline row above the stats grid: `Your override: N%`
- Stats grid widens from 3 cells to 4: **Accounts**, **Orders**, **Rate**, **Commission Earned**
- Entire card becomes a `<Link>` to `/dashboard/my-team/[subRepId]`

### 2.3 Admin view — RepTree component

New component rendering the rep hierarchy tree. Each node is a `<Link>` row showing:
- Name (bold) + status pill
- Rate %, override %, accounts count, commission earned this period
- Expand/collapse chevron for nodes with children (defaults to expanded)

Clicking the row navigates to `/dashboard/my-team/[repId]` (same detail page as reps use).

A top toolbar above the tree provides search (by name/email) and a filter `"Show top-level only"` toggle.

### 2.4 Data additions to `getMySubReps` (rep view)

`SubRep` type gains `commissionEarned: number` (sub-rep's commission in the current period, computed like `buildRepPerformance.commissionEarned`).

### 2.5 New server action `getRepTree()` (admin view)

Returns a nested structure:

```ts
interface RepTreeNode {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  accountCount: number;
  orderCount: number;
  commissionEarned: number;
  commissionRate: number;
  overridePercent: number;
  children: RepTreeNode[];
}
```

Implementation: one query to `profiles` for all active sales reps, one query to `rep_hierarchy` for all parent→child edges, then assemble in-memory. Enrichment (accountCount / orderCount / commissionEarned / rates) reuses the existing per-rep aggregation logic from `getMySubReps`.

---

## 3. Sub-rep detail page `/dashboard/my-team/[subRepId]`

### 3.1 Access control

- **Admin** — allowed for any rep id
- **Sales rep** — allowed only if a row exists in `rep_hierarchy` with `parent_rep_id = user.id AND child_rep_id = subRepId`
- **Otherwise** — `notFound()` (hard 404; no redirect)

### 3.2 Layout (top-to-bottom)

**A. Back link** → `/dashboard/my-team`.

**B. Hero section** — visually similar to `RepHero`:
- Navy header with avatar/initials, name, role label (`Sub-Representative · X% commission rate`)
- Right side shows quota attainment % + `of <Month Year> goal` label
- Body: quota progress bar, `$actual of $quota` label, pace status (Behind / On track / Almost there / Quota met) OR `No quota set for this period.` when none

**C. KPI row** — six cards matching `RepKpiRow`:

| Card | Value |
|---|---|
| Revenue This Month | `actualRevenue` |
| Orders This Month | `paidOrders` |
| Commission Earned | `commissionEarned` |
| Avg Order Value | `avgOrderValue` |
| Pipeline Revenue | `pipelineRevenue` |
| Your Override Earned | Parent rep's override on sub-rep's commission this period (hidden for admin view) |

**D. Rate management section** — reuses `RateManagement`'s existing form, scoped to this one rep:
- Shows current rate + override percent, effective from date, who set it
- Button `Set New Rate` opens the existing rate-dialog pre-populated with this rep's name (non-editable)
- Visible to admin always; visible to sales rep only if they are the parent of this sub-rep (which access-control already enforces)

**E. Commission calculator (scoped)** — reuses `CommissionCalculator` logic, pre-filtered to this rep only. Period dropdown remains so user can calculate a past period. No rep dropdown (single rep context).

**F. Accounts table** — reuses `DataTable` + columns from `AccountsList`, scoped to the rep's assigned facilities via new `{ repIdOverride }` param on `getAccountsWithMetrics`. Period fixed to `this_month` (no dropdown). No owner filter tabs. Tier badges present.

**G. Commission history** — scrollable table of the rep's recent commissions with columns:
- Period (`2026-04`)
- Gross (`commission_amount`)
- Adjustment
- Final (`final_amount` if set, else gross + adjustment)
- Your override ($) — `final × (overridePercent / 100)`; hidden for admin view
- Status pill

Ordered by `payout_period DESC`, limit 12.

### 3.3 Data flow

New server action `getSubRepDetail(subRepId)`:
1. Run access-control check
2. Load rep profile
3. `buildRepPerformance` for current period (reuse existing)
4. `buildRevenueExtras` scoped to rep's facilities → `pipelineRevenue`
5. Query `commission_rates` for current `rate_percent` + `override_percent`
6. Compute parent override earned this period (only when viewer is a sales rep)
7. Load commission history (limit 12)
8. Load accounts via `getAccountsWithMetrics("this_month", { repIdOverride: subRepId })`

### 3.4 `getAccountsWithMetrics` change

Add optional second parameter `{ repIdOverride?: string }`:
- When set, bypasses caller's own rep-hierarchy lookup and scopes `facilities` query to `assigned_rep = repIdOverride`
- The route calling it is responsible for auth (the sub-rep detail page already gates access)

---

## 4. Commissions page restructure

### 4.1 Admin access

Remove Commissions from the admin sidebar. `/dashboard/commissions` server component checks role and `redirect('/dashboard/my-team')` when admin. This removes clutter without orphaning existing links.

### 4.2 Sales rep view

Commissions page becomes display-only. Retains:
- `CommissionLedger` — list of the rep's own commissions (existing)
- `PayoutTable` — payout history (existing)

Removed from the rep's view:
- `RateManagement` — moved to My Team sub-rep detail page
- `CommissionCalculator` — moved to My Team sub-rep detail page (scoped per rep)

Added:
- **Team Earnings section** at the top of the page: summary card showing `Your override earnings this period: $X from N sub-reps`, plus an expandable breakdown table listing each sub-rep with `period`, `sub-rep commission`, `your override %`, `your override $`. Reuses existing commissions data.

### 4.3 File disposition

- `commissions/(sections)/RateManagement.tsx` — kept as-is; re-used by sub-rep detail page. Not rendered by `/dashboard/commissions` anymore.
- `commissions/(sections)/CommissionCalculator.tsx` — kept as-is; takes an optional `lockedRepId` prop; when set, the rep selector is hidden/pre-populated. Re-used by sub-rep detail page.
- `commissions/(sections)/TeamEarnings.tsx` — **new**, rendered only on the rep's commissions page

---

## 5. Files Changed

### New files
| File | Purpose |
|---|---|
| `my-team/[subRepId]/page.tsx` | Sub-rep detail server page + access guard |
| `my-team/[subRepId]/(sections)/SubRepHero.tsx` | Hero with quota progress |
| `my-team/[subRepId]/(sections)/SubRepKpiRow.tsx` | 6-card KPI row |
| `my-team/[subRepId]/(sections)/SubRepRateSection.tsx` | Rate display + edit button (wraps `RateManagement`) |
| `my-team/[subRepId]/(sections)/SubRepCalculator.tsx` | Wrapper around `CommissionCalculator` with `lockedRepId` |
| `my-team/[subRepId]/(sections)/SubRepAccounts.tsx` | Accounts table scoped to this rep |
| `my-team/[subRepId]/(sections)/SubRepCommissionHistory.tsx` | 12-row history table |
| `my-team/[subRepId]/(sections)/Providers.tsx` | Hydrates detail slice |
| `my-team/(redux)/sub-rep-detail-slice.ts` | Detail page state |
| `my-team/(sections)/RepTree.tsx` | Admin tree view of all reps |
| `commissions/(sections)/TeamEarnings.tsx` | New override-earnings summary for reps |

### Modified files
| File | Change |
|---|---|
| `my-team/(services)/actions.ts` | Add `commissionEarned` to `getMySubReps`; add `getRepTree()` + `getSubRepDetail()` |
| `my-team/(redux)/my-team-slice.ts` | Add `commissionEarned` on `SubRep`; add tree types |
| `my-team/page.tsx` | Branch on role: rep → `TeamView`, admin → `RepTree` |
| `my-team/(sections)/TeamView.tsx` | Card becomes `<Link>`; 4-cell stats grid; override % line |
| `commissions/page.tsx` | Admin → redirect to `/dashboard/my-team`; remove `RateManagement` + `CommissionCalculator` usages |
| `commissions/(sections)/CommissionCalculator.tsx` | Accept optional `lockedRepId` prop |
| `accounts/(services)/actions.ts` | Add `{ repIdOverride }` second arg to `getAccountsWithMetrics` |
| `(sections)/Sidebar.tsx` | Hide Commissions entry for admins |
| `store/store.ts` | Register `subRepDetail` slice |

---

## 6. Out of Scope
- Editing sub-rep profile (name, email, phone)
- Reassigning accounts between reps (admin function handled on Users/Onboarding pages)
- Setting quota on a sub-rep (existing quota management on Rep Performance page)
- Messaging / activity log per sub-rep
- Tier breakdown section on sub-rep detail page
- Period dropdown on sub-rep detail page (always `this_month`)
- Restructuring `PayoutTable` layout
