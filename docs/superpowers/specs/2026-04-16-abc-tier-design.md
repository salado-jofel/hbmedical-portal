# ABC Tier Feature — Design Spec

**Date:** 2026-04-16
**Scope:** Add automatic A/B/C tier classification to clinic accounts based on delivered revenue. Tiers display as badges on the accounts list, account detail, and a new rep-performance breakdown section.

---

## 1. Overview

Every clinic account is classified A, B, or C on read — computed live, never stored. Tier is determined by the account's `delivered_revenue` within the currently selected period, ranked against a scope-appropriate peer set.

| Viewer | Peer set |
|---|---|
| Sales rep on accounts page | Rep's own + sub-rep accounts |
| Admin on accounts page | All clinic accounts (global) |
| Any role on rep-performance page | Rep's own + sub-rep accounts (admin: all), using trailing 3 months |

Tiers follow the accounts page period filter (`this_month`, `last_3_months`, `all_time`). Rep-performance has no period toggle and uses trailing 3 months as the implicit window.

---

## 2. Tiering algorithm

Implemented once in `utils/helpers/tiers.ts` as `assignTiers(accounts)`. Called by both server actions after per-account metrics are computed.

**Steps:**
1. Partition input into `zeroRevenue` (`delivered_revenue === 0`) and `hasRevenue`.
2. Sort `hasRevenue` by `delivered_revenue` descending.
3. Compute tier boundaries:
   - `aCount = Math.ceil(hasRevenue.length * 0.20)`
   - `bCount = Math.ceil(hasRevenue.length * 0.30)`
4. First `aCount` → tier A. Next `bCount` → tier B. Remaining `hasRevenue` → tier C.
5. All `zeroRevenue` accounts → tier C.
6. Return input accounts in original order, each with a `tier` field attached.

**Edge cases:**
- Empty scope: function returns `[]`, no tiers to assign.
- Scope has revenue-bearing accounts but count < 5: `Math.ceil` guarantees at least 1 A-tier.
- All accounts have zero revenue: every account becomes C.

---

## 3. Data model

### 3.1 `IAccountWithMetrics` (extend)

**File:** `utils/interfaces/accounts.ts`

```typescript
export type AccountTier = "A" | "B" | "C";

export interface IAccountWithMetrics extends IAccount {
  // ... existing fields
  tier: AccountTier;
}
```

### 3.2 `IRepPerformanceSummary` (extend)

**File:** `utils/interfaces/quotas.ts`

```typescript
export interface IRepPerformanceSummary {
  // ... existing fields
  tierCounts: { A: number; B: number; C: number };
}
```

### 3.3 Constants

**File:** `utils/constants/accounts.ts`

```typescript
export const ACCOUNT_TIER_FILTER_OPTIONS: { value: AccountTier | "all"; label: string }[] = [
  { value: "all", label: "All tiers" },
  { value: "A",   label: "A-Tier only" },
  { value: "B",   label: "B-Tier only" },
  { value: "C",   label: "C-Tier only" },
];
```

### 3.4 `withZeroMetrics` helper

**File:** `utils/helpers/accounts.ts`

Add `tier: existing?.tier ?? "C"` to the returned object. Default zero-metric accounts to C.

---

## 4. Server-side changes

### 4.1 `getAccountsWithMetrics`

**File:** `app/(dashboard)/dashboard/accounts/(services)/actions.ts`

After the existing `.map((fac) => ...)` builds per-facility metrics, wrap the result:

```typescript
const accountsWithMetrics = facilityList.map((fac: any): IAccountWithMetrics => { ... });
return assignTiers(accountsWithMetrics);
```

No change to rep scoping, queries, or period filtering — tiering is a pure function over the result set.

### 4.2 `getRepPerformanceSummary`

**File:** `app/(dashboard)/dashboard/rep-performance/(services)/actions.ts`

Add a helper `buildTierCounts(repId, adminClient)` that:
1. Resolves scope (rep: own + sub-rep ids; admin: all clinic facilities).
2. Computes trailing-3-month delivered revenue per facility (reuse pattern from `buildRevenueExtras`).
3. Builds minimal `{ id, delivered_revenue }` records and calls `assignTiers()`.
4. Returns `{ A: count, B: count, C: count }`.

Call from `getRepPerformanceSummary` alongside `buildRevenueExtras`. Add `tierCounts` to the returned summary.

---

## 5. UI changes

### 5.1 `AccountTierBadge` component

**File:** `app/(dashboard)/dashboard/accounts/(components)/AccountTierBadge.tsx`

Small pill badge accepting `tier: AccountTier` and optional `className`.

| Tier | Background | Text |
|---|---|---|
| A | `var(--green-lt)` | `var(--green)` |
| B | `var(--gold-lt)` | `var(--gold)` |
| C | `#f1f5f9` (neutral) | `var(--text3)` |

Renders `A`, `B`, or `C` in bold inside a rounded pill. Used by list, detail, and breakdown cards.

### 5.2 Accounts page — KPI row

**File:** `app/(dashboard)/dashboard/accounts/(sections)/AccountsKpiRow.tsx`

Replace the empty 4th card placeholder with an **A-Tier Accounts** count card:
- Value: count of accounts with `tier === "A"`
- Subtitle: `out of N total accounts`
- Accent: `green` (matches tier-A badge color)

### 5.3 Accounts page — table

**File:** `app/(dashboard)/dashboard/accounts/(sections)/AccountsList.tsx`

Add a new column between "Account / Provider" and "Signed":

| Column | Value | Behavior |
|---|---|---|
| Tier | `<AccountTierBadge tier={a.tier} />` | Always visible; narrow column |

Add tier filter state: `tierFilter: AccountTier \| "all"`. Filter logic: `if (tierFilter !== "all") result = result.filter((a) => a.tier === tierFilter)`.

### 5.4 `AccountsFilters` — tier dropdown

**File:** `app/(dashboard)/dashboard/accounts/(components)/AccountsFilters.tsx`

Add `tierFilter` + `onTierFilterChange` props. Append a 4th `FilterSelect` entry using `ACCOUNT_TIER_FILTER_OPTIONS` after the period dropdown.

### 5.5 Account detail page — header badge

**File:** `app/(dashboard)/dashboard/accounts/[id]/(sections)/AccountHeader.tsx`

Render `<AccountTierBadge tier={account.tier} />` immediately after the existing `<AccountStatusBadge />`. Same visual weight, same row.

### 5.6 Rep-performance — tier breakdown section

**File:** `app/(dashboard)/dashboard/rep-performance/(sections)/TierBreakdown.tsx`

New section component rendering 3 stat cards side-by-side showing A/B/C counts. Each card displays:
- Tier letter (large, colored)
- Count (large, bold)
- Label "accounts" underneath

Pulls `tierCounts` from `s.repPerformance.summary`.

### 5.7 Rep-performance page — layout

**File:** `app/(dashboard)/dashboard/rep-performance/page.tsx`

Insert `<TierBreakdown />` between `<RepKpiRow />` and `<RepTables />` in the rep view, and between `<RepHero />` and `<AdminQuotaBoard />` in the admin view.

---

## 6. Files Changed

### New files
| File | Purpose |
|---|---|
| `utils/helpers/tiers.ts` | `assignTiers()` algorithm |
| `accounts/(components)/AccountTierBadge.tsx` | A/B/C pill badge |
| `rep-performance/(sections)/TierBreakdown.tsx` | 3-card tier breakdown |

### Modified files
| File | Change |
|---|---|
| `utils/interfaces/accounts.ts` | Add `AccountTier` + `tier` field on `IAccountWithMetrics` |
| `utils/interfaces/quotas.ts` | Add `tierCounts` on `IRepPerformanceSummary` |
| `utils/constants/accounts.ts` | Add `ACCOUNT_TIER_FILTER_OPTIONS` |
| `utils/helpers/accounts.ts` | Default `tier: "C"` in `withZeroMetrics` |
| `accounts/(services)/actions.ts` | Wrap return with `assignTiers()` |
| `accounts/(sections)/AccountsKpiRow.tsx` | Fill 4th card with A-tier count |
| `accounts/(sections)/AccountsList.tsx` | Add Tier column + filter state |
| `accounts/(components)/AccountsFilters.tsx` | Add tier dropdown |
| `accounts/[id]/(sections)/AccountHeader.tsx` | Render tier badge |
| `rep-performance/(services)/actions.ts` | Add `buildTierCounts`, include in summary |
| `rep-performance/page.tsx` | Render `<TierBreakdown />` |

---

## 7. Out of Scope
- Tier-based alerts or notifications
- Tier history tracking over time
- Manual tier overrides (admin picking a tier)
- Tier-based commission rules or quota adjustments
- Tier trends / "moved from B to A last month"
