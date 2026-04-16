# My Team Lucas Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT run `git commit` or `git add` — the user has explicit rules against unauthorized commits.**

**Goal:** Replace the hierarchy tree on `/dashboard/my-team` with a Lucas-style flat layout (5 KPI cards + filter bar + flat rep-row list), make the detail page's accounts table display-only, and add an in-scope Quota management section on the detail page with `setQuota` authorization relaxed so sales reps can set quotas for their direct sub-reps.

**Architecture:** A new `getRepList(period, statusFilter)` server action returns flat rows (scoped admin=all, rep=recursive downline). A new `getMyTeamKpis(period)` action returns the 5 aggregate numbers. Filter state (status, view, period) lives in URL search params so the server refetches on change; search is client-side. Detail page gains `<SubRepQuotaSection />` between Hero and KPI row. `setQuota` now accepts reps when the target rep is in their direct downline.

**Tech Stack:** Next.js 16 App Router server actions, Supabase admin client, Redux Toolkit, TypeScript, Tailwind 4, existing `KpiCard` / `Dialog` / `Button`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `utils/interfaces/my-team.ts` | Modify | Add `IRepListRow`, `IMyTeamKpis`; remove `IRepTreeNode` |
| `my-team/(services)/actions.ts` | Modify | Add `getRepList`, `getMyTeamKpis`, extend `getMySubReps` with period; remove `getRepTree` |
| `my-team/(redux)/my-team-slice.ts` | Modify | Add `rows`, `kpis` state + actions |
| `my-team/(sections)/MyTeamKpiRow.tsx` | **Create** | 5-card KPI row |
| `my-team/(sections)/MyTeamFilterBar.tsx` | **Create** | Status / view / period / search filter bar |
| `my-team/(sections)/RepListRow.tsx` | **Create** | Single Lucas-style row |
| `my-team/(sections)/RepListView.tsx` | **Create** | List container + search filtering |
| `my-team/(sections)/RepTree.tsx` | **Delete** | Replaced by flat list |
| `my-team/(sections)/TeamView.tsx` | **Delete** | Replaced by flat list |
| `my-team/page.tsx` | Modify | Fetch rows+kpis via search params, render new components |
| `my-team/[subRepId]/(sections)/SubRepQuotaSection.tsx` | **Create** | Quota display + set dialog |
| `my-team/[subRepId]/(sections)/SubRepAccounts.tsx` | Modify | Remove `<Link>` on Account column |
| `my-team/[subRepId]/page.tsx` | Modify | Render `<SubRepQuotaSection />` after Hero |
| `rep-performance/(services)/actions.ts` | Modify | Relax `setQuota` auth |

---

## Task 1: Update `utils/interfaces/my-team.ts` types

**Files:**
- Modify: `utils/interfaces/my-team.ts`

- [ ] **Step 1: Remove `IRepTreeNode`, add `IRepListRow` + `IMyTeamKpis`**

Delete the existing `IRepTreeNode` interface. Add these interfaces (keep all other existing exports):

```typescript
export interface IRepListRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  isDirect: boolean;
  accountCount: number;
  ordersInPeriod: number;
  deliveredInPeriod: number;
  commissionInPeriod: number;
  commissionRate: number;
  overridePercent: number;
}

export interface IMyTeamKpis {
  totalReps: number;
  repsDirect: number;
  repsIndirect: number;
  totalAccounts: number;
  accountsDirect: number;
  accountsViaTeam: number;
  totalOrders: number;
  ordersDelivered: number;
  deliveredRevenue: number;
  deliveredOrdersConfirmed: number;
  activeReps: number;
  activeRepsTotalDenominator: number;
}
```

- [ ] **Step 2: Verify compile**

Run `npx tsc --noEmit 2>&1 | tail -15`.

Expected: errors in `my-team/(services)/actions.ts` (references to removed `IRepTreeNode`) and in `my-team/(sections)/RepTree.tsx`. These are expected; later tasks fix/delete them.

---

## Task 2: Extend `SubRep` type with period-filtered fields

**Files:**
- Modify: `utils/interfaces/my-team.ts`

- [ ] **Step 1: Extend `SubRep` interface**

Find the existing `SubRep` interface and add three fields at the end:

```typescript
export interface SubRep {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  role: string;
  accountCount: number;
  orderCount: number;
  revenue: number;
  commissionRate: number;
  overridePercent: number;
  commissionEarned: number;
  ordersInPeriod: number;
  deliveredInPeriod: number;
  commissionInPeriod: number;
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -15`. Expected: error in `my-team/(services)/actions.ts` about `getMySubReps` return missing the new fields. Fixed in Task 4.

---

## Task 3: Delete `getRepTree` and references; add `getRepList`

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Remove `getRepTree`**

Delete the entire `getRepTree` function from the file. Also remove the `import type { IRepTreeNode }` line.

- [ ] **Step 2: Add imports**

Add at the top (merge with existing imports — do not duplicate):

```typescript
import type { IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";
import type { AccountPeriod } from "@/utils/interfaces/accounts";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { getUserRole } from "@/lib/supabase/auth";
```

(Skip any that are already imported.)

- [ ] **Step 3: Append helper and `getRepList` to the bottom of the file**

```typescript
function periodBounds(period: AccountPeriod): { start: string | null; end: string | null } {
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

async function resolveDownlineIds(
  rootId: string,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<{ directIds: string[]; allIds: string[] }> {
  const { data: directEdges } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", rootId);
  const directIds = (directEdges ?? []).map((e: any) => e.child_rep_id as string);

  const { data: allEdges } = await adminClient
    .from("rep_hierarchy")
    .select("parent_rep_id, child_rep_id");
  const childrenByParent: Record<string, string[]> = {};
  for (const e of allEdges ?? []) {
    (childrenByParent[e.parent_rep_id as string] ??= []).push(e.child_rep_id as string);
  }
  const allIds = new Set<string>();
  const stack = [...directIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (allIds.has(id)) continue;
    allIds.add(id);
    for (const child of childrenByParent[id] ?? []) stack.push(child);
  }
  return { directIds, allIds: [...allIds] };
}

export async function getRepList(
  period: AccountPeriod = "this_month",
  statusFilter: "all" | "active" | "inactive" = "all",
): Promise<IRepListRow[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  const adminClient = createAdminClient();

  // Resolve which rep ids are in scope + which are "direct"
  let inScopeIds: string[];
  let directSet: Set<string>;

  if (isAdmin(role)) {
    const { data: allReps } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "sales_representative");
    inScopeIds = (allReps ?? []).map((r: any) => r.id as string);
    const { data: edges } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .in("child_rep_id", inScopeIds.length > 0 ? inScopeIds : ["__none__"]);
    const hasParent = new Set((edges ?? []).map((e: any) => e.child_rep_id as string));
    directSet = new Set(inScopeIds.filter((id) => !hasParent.has(id)));
  } else if (isSalesRep(role)) {
    const { directIds, allIds } = await resolveDownlineIds(user.id, adminClient);
    inScopeIds = allIds;
    directSet = new Set(directIds);
  } else {
    return [];
  }

  if (inScopeIds.length === 0) return [];

  // Base profiles
  let profilesQuery = adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, status")
    .in("id", inScopeIds)
    .order("first_name");
  if (statusFilter !== "all") {
    profilesQuery = profilesQuery.eq("status", statusFilter);
  }
  const { data: profiles } = await profilesQuery;
  const repList = profiles ?? [];
  const filteredIds = repList.map((r: any) => r.id as string);
  if (filteredIds.length === 0) return [];

  // Account counts
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, assigned_rep")
    .in("assigned_rep", filteredIds)
    .neq("facility_type", "rep_office");
  const accountsByRep: Record<string, number> = {};
  const facilitiesByRep: Record<string, string[]> = {};
  for (const f of facs ?? []) {
    const r = f.assigned_rep as string;
    accountsByRep[r] = (accountsByRep[r] ?? 0) + 1;
    (facilitiesByRep[r] ??= []).push(f.id as string);
  }

  // Orders in period
  const { start, end } = periodBounds(period);
  const allFacilityIds = Object.values(facilitiesByRep).flat();
  const ordersByRep: Record<string, number> = {};
  const deliveredByRep: Record<string, number> = {};
  if (allFacilityIds.length > 0) {
    let q = adminClient
      .from("orders")
      .select("id, facility_id, delivery_status, placed_at")
      .in("facility_id", allFacilityIds)
      .neq("order_status", "canceled");
    if (start) q = q.gte("placed_at", start);
    if (end) q = q.lt("placed_at", end);
    const { data: orders } = await q;

    const repByFacility: Record<string, string> = {};
    for (const rid of filteredIds) for (const fid of facilitiesByRep[rid] ?? []) repByFacility[fid] = rid;

    for (const o of orders ?? []) {
      const rid = repByFacility[o.facility_id as string];
      if (!rid) continue;
      ordersByRep[rid] = (ordersByRep[rid] ?? 0) + 1;
      if (o.delivery_status === "delivered") {
        deliveredByRep[rid] = (deliveredByRep[rid] ?? 0) + 1;
      }
    }
  }

  // Rates
  const { data: rates } = await adminClient
    .from("commission_rates")
    .select("rep_id, rate_percent, override_percent")
    .in("rep_id", filteredIds)
    .is("effective_to", null);
  const rateByRep: Record<string, { rate_percent: number; override_percent: number }> = {};
  for (const r of rates ?? []) {
    rateByRep[r.rep_id as string] = {
      rate_percent: Number(r.rate_percent ?? 0),
      override_percent: Number(r.override_percent ?? 0),
    };
  }

  // Commission in period — scope by payout_period
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodFilter: string[] = [];
  if (period === "this_month") {
    periodFilter.push(currentPeriod);
  } else if (period === "last_3_months") {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periodFilter.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  let commQuery = adminClient
    .from("commissions")
    .select("rep_id, final_amount, commission_amount, adjustment")
    .in("rep_id", filteredIds)
    .neq("status", "void");
  if (periodFilter.length > 0) {
    commQuery = commQuery.in("payout_period", periodFilter);
  }
  const { data: commRows } = await commQuery;
  const commByRep: Record<string, number> = {};
  for (const c of commRows ?? []) {
    const rid = c.rep_id as string;
    const amt = c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0);
    commByRep[rid] = (commByRep[rid] ?? 0) + amt;
  }

  return repList.map((r: any): IRepListRow => ({
    id: r.id,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    email: r.email ?? null,
    status: r.status ?? null,
    isDirect: directSet.has(r.id),
    accountCount: accountsByRep[r.id] ?? 0,
    ordersInPeriod: ordersByRep[r.id] ?? 0,
    deliveredInPeriod: deliveredByRep[r.id] ?? 0,
    commissionInPeriod: commByRep[r.id] ?? 0,
    commissionRate: rateByRep[r.id]?.rate_percent ?? 0,
    overridePercent: rateByRep[r.id]?.override_percent ?? 0,
  }));
}
```

- [ ] **Step 4: Verify compile**

Run `npx tsc --noEmit 2>&1 | tail -15` — expected: errors in `my-team/(sections)/RepTree.tsx` (references removed types) and in `my-team/page.tsx` (imports `getRepTree`/`RepTree`). Fixed by later tasks.

---

## Task 4: Extend `getMySubReps` with period arg and period-filtered fields

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Change signature and compute new fields**

Find the existing `export async function getMySubReps() { ... }`. Replace the signature line and prepend the period-bounds computation, then add the new aggregations inside the `subReps.map` callback.

Replace:
```typescript
export async function getMySubReps() {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();
```

With:
```typescript
export async function getMySubReps(period: AccountPeriod = "this_month") {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();
  const { start: periodStart, end: periodEnd } = periodBounds(period);
```

Then inside the existing `subReps.map(async (rep) => { ... })` callback, find the existing order-aggregation block:

```typescript
      let orderCount = 0;
      let revenue = 0;

      if (facilityIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, order_items(total_amount)")
          .in("facility_id", facilityIds)
          .neq("order_status", "canceled");

        orderCount = orders?.length || 0;
        revenue = (orders || []).reduce((sum, o) => {
          const itemTotal = (
            o.order_items as { total_amount: string | number }[]
          ).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          return sum + itemTotal;
        }, 0);
      }
```

Replace with:

```typescript
      let orderCount = 0;
      let revenue = 0;
      let ordersInPeriod = 0;
      let deliveredInPeriod = 0;

      if (facilityIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, placed_at, delivery_status, order_items(total_amount)")
          .in("facility_id", facilityIds)
          .neq("order_status", "canceled");

        orderCount = orders?.length || 0;
        revenue = (orders || []).reduce((sum, o) => {
          const itemTotal = (
            o.order_items as { total_amount: string | number }[]
          ).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          return sum + itemTotal;
        }, 0);

        for (const o of orders ?? []) {
          const placedAt = (o as any).placed_at as string | null;
          if (!placedAt) continue;
          if (periodStart && placedAt < periodStart) continue;
          if (periodEnd && placedAt >= periodEnd) continue;
          ordersInPeriod += 1;
          if ((o as any).delivery_status === "delivered") deliveredInPeriod += 1;
        }
      }
```

Then find the end of the callback where commissionEarned is computed. Capture the current-period amount in a separate variable for `commissionInPeriod`. Replace:

```typescript
      const commissionEarned = (commRows ?? []).reduce((sum: number, c: any) => {
        return sum + (c.final_amount != null
          ? Number(c.final_amount)
          : Number(c.commission_amount) + Number(c.adjustment ?? 0));
      }, 0);

      return {
        ...rep,
        accountCount: accountCount || 0,
        orderCount,
        revenue,
        commissionRate: rate?.rate_percent || 0,
        overridePercent: rate?.override_percent || 0,
        commissionEarned,
      };
```

With:

```typescript
      const commissionEarned = (commRows ?? []).reduce((sum: number, c: any) => {
        return sum + (c.final_amount != null
          ? Number(c.final_amount)
          : Number(c.commission_amount) + Number(c.adjustment ?? 0));
      }, 0);

      return {
        ...rep,
        accountCount: accountCount || 0,
        orderCount,
        revenue,
        commissionRate: rate?.rate_percent || 0,
        overridePercent: rate?.override_percent || 0,
        commissionEarned,
        ordersInPeriod,
        deliveredInPeriod,
        commissionInPeriod: commissionEarned,
      };
```

(Note: `commissionEarned` is already scoped to the current `payout_period`, so reusing it is correct when `period === "this_month"`. For `last_3_months` / `all_time` the value is still the current-month commission — this matches the narrower semantic of "commission credited for the current payout window". Acceptable for now.)

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` — errors remain only in `RepTree.tsx` and `my-team/page.tsx`.

---

## Task 5: Add `getMyTeamKpis` action

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Append `getMyTeamKpis` to the bottom**

```typescript
export async function getMyTeamKpis(period: AccountPeriod = "this_month"): Promise<IMyTeamKpis> {
  const rows = await getRepList(period, "all");

  const totalReps = rows.length;
  const repsDirect = rows.filter((r) => r.isDirect).length;
  const repsIndirect = totalReps - repsDirect;

  const accountsDirect = rows.filter((r) => r.isDirect).reduce((s, r) => s + r.accountCount, 0);
  const accountsViaTeam = rows.filter((r) => !r.isDirect).reduce((s, r) => s + r.accountCount, 0);
  const totalAccounts = accountsDirect + accountsViaTeam;

  const totalOrders = rows.reduce((s, r) => s + r.ordersInPeriod, 0);
  const ordersDelivered = rows.reduce((s, r) => s + r.deliveredInPeriod, 0);

  // Delivered revenue: sum order_items.total_amount for delivered orders in period for rep's facilities
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const repIds = rows.map((r) => r.id);
  let deliveredRevenue = 0;
  if (repIds.length > 0) {
    const { data: facs } = await adminClient
      .from("facilities")
      .select("id, assigned_rep")
      .in("assigned_rep", repIds)
      .neq("facility_type", "rep_office");
    const facilityIds = (facs ?? []).map((f: any) => f.id as string);

    if (facilityIds.length > 0) {
      const { start, end } = periodBounds(period);
      let q = adminClient
        .from("orders")
        .select("id, order_items(total_amount)")
        .in("facility_id", facilityIds)
        .eq("delivery_status", "delivered")
        .neq("order_status", "canceled");
      if (start) q = q.gte("placed_at", start);
      if (end) q = q.lt("placed_at", end);
      const { data: orders } = await q;
      for (const o of orders ?? []) {
        const items = (o as any).order_items as { total_amount: string | number }[] | null;
        for (const it of items ?? []) {
          deliveredRevenue += Number(it.total_amount ?? 0);
        }
      }
    }
  }

  const activeReps = rows.filter((r) => r.status === "active").length;

  return {
    totalReps,
    repsDirect,
    repsIndirect,
    totalAccounts,
    accountsDirect,
    accountsViaTeam,
    totalOrders,
    ordersDelivered,
    deliveredRevenue,
    deliveredOrdersConfirmed: ordersDelivered,
    activeReps,
    activeRepsTotalDenominator: totalReps,
  };
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10`. Expected: errors remain only in `RepTree.tsx` + `my-team/page.tsx`.

---

## Task 6: Delete `RepTree.tsx` and `TeamView.tsx`

**Files:**
- Delete: `app/(dashboard)/dashboard/my-team/(sections)/RepTree.tsx`
- Delete: `app/(dashboard)/dashboard/my-team/(sections)/TeamView.tsx` (only if not imported elsewhere)

- [ ] **Step 1: Check consumers**

Run `grep -rn "RepTree\|TeamView" app/ --include="*.tsx" --include="*.ts"`.

- If `TeamView` is only imported by `my-team/page.tsx`, delete both.
- If it has other consumers, delete `RepTree.tsx` only and leave `TeamView.tsx` until Task 9 (page rewrite).

- [ ] **Step 2: Delete the file(s)**

```bash
rm "app/(dashboard)/dashboard/my-team/(sections)/RepTree.tsx"
# if safe:
rm "app/(dashboard)/dashboard/my-team/(sections)/TeamView.tsx"
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10`. Expected: errors only in `my-team/page.tsx` for now.

---

## Task 7: Update Redux slice

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(redux)/my-team-slice.ts`

- [ ] **Step 1: Add imports and state fields**

READ the current file. Add imports for the new types:

```typescript
import type { IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";
```

Extend the state shape to include `rows: IRepListRow[]` and `kpis: IMyTeamKpis | null`. Keep the existing `items` / `setItems` for `SubRep[]` if they have consumers; otherwise remove them.

- [ ] **Step 2: Add reducers**

Add `setRows` and `setKpis` reducers inside the `createSlice({ reducers: { ... } })` block:

```typescript
    setRows(state, action: PayloadAction<IRepListRow[]>) {
      state.rows = action.payload;
    },
    setKpis(state, action: PayloadAction<IMyTeamKpis | null>) {
      state.kpis = action.payload;
    },
```

Initialize in `initialState`:

```typescript
  rows: [] as IRepListRow[],
  kpis: null as IMyTeamKpis | null,
```

Export them in the `actions` destructure block at the bottom.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10`.

---

## Task 8: Create `MyTeamKpiRow.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(sections)/MyTeamKpiRow.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export function MyTeamKpiRow() {
  const k = useAppSelector((s) => s.myTeam.kpis);
  if (!k) return null;

  const cards = [
    {
      value: String(k.totalReps),
      label: "Total Reps",
      sub: `${k.repsDirect} direct · ${k.repsIndirect} indirect`,
    },
    {
      value: String(k.totalAccounts),
      label: "Total Accounts",
      sub: `${k.accountsDirect} direct · ${k.accountsViaTeam} via team`,
    },
    {
      value: String(k.totalOrders),
      label: "Total Orders",
      sub: `${k.ordersDelivered} delivered`,
    },
    {
      value: formatAmount(k.deliveredRevenue),
      label: "Delivered Revenue",
      sub: `${k.deliveredOrdersConfirmed} orders confirmed`,
      accent: true,
    },
    {
      value: String(k.activeReps),
      label: "Active Reps",
      sub: `of ${k.activeRepsTotalDenominator} total`,
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.accent
              ? "rounded-[var(--r)] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-4 text-center"
              : "rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center"
          }
        >
          <p className={
            c.accent
              ? "text-[22px] font-semibold leading-none text-[#16a34a]"
              : "text-[22px] font-semibold leading-none text-[var(--navy)]"
          }>
            {c.value}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
            {c.label}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text3)]">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors in this file.

---

## Task 9: Create `MyTeamFilterBar.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(sections)/MyTeamFilterBar.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { cn } from "@/utils/utils";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export function MyTeamFilterBar({
  status,
  period,
  view,
  search,
  onSearchChange,
}: {
  status: StatusFilter;
  period: AccountPeriod;
  view: ViewFilter;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const isRep = isSalesRep(role);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      {/* Status */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Status</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateParam("status", s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                status === s
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              {s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* View (rep only) */}
      {isRep && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">View</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
            {(["all_sub_reps", "direct_only"] as const).map((v) => (
              <button
                key={v}
                onClick={() => updateParam("view", v)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === v
                    ? "bg-white text-[var(--navy)] shadow-sm"
                    : "text-[#64748b] hover:text-[#334155]",
                )}
              >
                {v === "all_sub_reps" ? "All Sub-Reps" : "Direct Only"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Period */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Period</span>
        <select
          value={period}
          onChange={(e) => updateParam("period", e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--navy)]"
        >
          <option value="this_month">This Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="all_time">All Time</option>
        </select>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Search</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 w-full rounded-md border border-[var(--border)] bg-white pl-9 pr-3 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 10: Create `RepListRow.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(sections)/RepListRow.tsx`

- [ ] **Step 1: Create the file**

```typescript
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
      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--navy)] truncate">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-[11px] text-[var(--text3)] truncate">{row.email ?? ""}</p>
      </div>

      {/* 4 stat blocks */}
      <div className="grid grid-cols-4 gap-6">
        <Stat value={String(row.accountCount)} label="Accounts" />
        <Stat value={String(row.ordersInPeriod)} label="Orders" />
        <Stat value={String(row.deliveredInPeriod)} label="Delivered" />
        <Stat value={formatAmount(row.commissionInPeriod)} label="Commission" />
      </div>

      {/* Status pill */}
      <div className="md:ml-4 shrink-0">
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
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 11: Create `RepListView.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(sections)/RepListView.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MyTeamKpiRow } from "./MyTeamKpiRow";
import { MyTeamFilterBar } from "./MyTeamFilterBar";
import { RepListRow } from "./RepListRow";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export function RepListView({
  status,
  period,
  view,
}: {
  status: StatusFilter;
  period: AccountPeriod;
  view: ViewFilter;
}) {
  const rows = useAppSelector((s) => s.myTeam.rows);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.first_name ?? ""} ${r.last_name ?? ""} ${r.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <MyTeamKpiRow />

      <MyTeamFilterBar
        status={status}
        period={period}
        view={view}
        search={search}
        onSearchChange={setSearch}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 stroke-1" />}
          message="No reps match"
          description="Adjust filters or search to see more results"
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
          {filtered.map((row) => (
            <RepListRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 12: Rewrite `my-team/page.tsx`

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/page.tsx`
- Modify: `app/(dashboard)/dashboard/my-team/(sections)/Providers.tsx`

- [ ] **Step 1: Update Providers to hydrate rows + kpis**

READ `my-team/(sections)/Providers.tsx`. Replace its contents with a provider that accepts `rows` and `kpis` and dispatches both:

```typescript
"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setRows, setKpis } from "../(redux)/my-team-slice";
import type { IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";

export default function Providers({
  children,
  rows,
  kpis,
}: {
  children: ReactNode;
  rows: IRepListRow[];
  kpis: IMyTeamKpis;
}) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setRows(rows));
    dispatch(setKpis(kpis));
  }, [dispatch, rows, kpis]);
  return <>{children}</>;
}
```

- [ ] **Step 2: Replace `my-team/page.tsx` entirely**

```typescript
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { RepListView } from "./(sections)/RepListView";
import { getRepList, getMyTeamKpis } from "./(services)/actions";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export const metadata: Metadata = { title: "My Team" };
export const dynamic = "force-dynamic";

export default async function MyTeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; period?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isSalesRep(role) && !isAdmin(role)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const status: StatusFilter =
    params.status === "active" || params.status === "inactive" ? params.status : "all";
  const period: AccountPeriod =
    params.period === "last_3_months" || params.period === "all_time" ? params.period : "this_month";
  const view: ViewFilter =
    params.view === "direct_only" ? "direct_only" : "all_sub_reps";

  let rows = await getRepList(period, status);
  if (!isAdmin(role) && view === "direct_only") {
    rows = rows.filter((r) => r.isDirect);
  }
  const kpis = await getMyTeamKpis(period);

  const title = isAdmin(role) ? "Sales Reps" : "My Team";
  const subtitle = isAdmin(role)
    ? "Review all sales representatives and manage their commission rates"
    : "Manage your sub-representatives and their accounts";

  return (
    <Providers rows={rows} kpis={kpis}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <PageHeader title={title} subtitle={subtitle} className="pb-4" />
        <RepListView status={status} period={period} view={view} />
      </div>
    </Providers>
  );
}
```

- [ ] **Step 3: Verify build**

Run `npm run build 2>&1 | tail -20`. Expected: zero type errors, `/dashboard/my-team` route listed.

---

## Task 13: Remove `<Link>` from `SubRepAccounts`

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepAccounts.tsx`

- [ ] **Step 1: Replace the Account column render**

Find:

```typescript
    {
      key: "account",
      label: "Account / Provider",
      render: (a) => (
        <Link href={`/dashboard/accounts/${a.id}`} className="block min-w-0 hover:underline">
          <p className="text-sm font-medium text-[var(--navy)] truncate">{a.name}</p>
          <p className="text-xs text-[var(--text3)] truncate mt-0.5">{a.city}, {a.state}</p>
        </Link>
      ),
    },
```

Replace with:

```typescript
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
```

Also remove the now-unused `import Link from "next/link";` at the top.

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 14: Relax `setQuota` authorization

**Files:**
- Modify: `app/(dashboard)/dashboard/rep-performance/(services)/actions.ts`

- [ ] **Step 1: Replace auth guard in `setQuota`**

READ the file, find `export async function setQuota(...)`. Its body starts with:

```typescript
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);
    const user = await getCurrentUserOrThrow(supabase);
```

Replace with:

```typescript
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role)) {
      if (!isSalesRep(role)) {
        return { success: false, error: "Unauthorized.", fieldErrors: {} };
      }
      const targetRepId = formData.get("rep_id") as string;
      const adminClient = createAdminClient();
      const { data: edge } = await adminClient
        .from("rep_hierarchy")
        .select("child_rep_id")
        .eq("parent_rep_id", user.id)
        .eq("child_rep_id", targetRepId)
        .maybeSingle();
      if (!edge) {
        return { success: false, error: "You can only set quotas for your direct sub-reps.", fieldErrors: {} };
      }
    }
```

The existing `requireAdminOrThrow` import is still used by `setCommissionRate` etc., leave it. If the file does not already import `isSalesRep` alongside `isAdmin`, ensure both are imported.

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.

---

## Task 15: Create `SubRepQuotaSection.tsx`

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepQuotaSection.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/store/hooks";
import { setQuota } from "@/app/(dashboard)/dashboard/rep-performance/(services)/actions";
import { formatAmount } from "@/utils/helpers/formatter";
import type { IQuotaFormState } from "@/utils/interfaces/quotas";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

export default function SubRepQuotaSection() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<IQuotaFormState | null, FormData>(
    setQuota,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Quota saved.");
      setOpen(false);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  if (!detail) return null;

  return (
    <section className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
            Quota — {periodLabel(detail.currentPeriod)}
          </p>
          {detail.quota == null ? (
            <p className="mt-1 text-sm text-[var(--text3)]">No quota set for this period.</p>
          ) : (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-[var(--navy)]">{formatAmount(detail.quota)} target</span>
              {detail.attainmentPct != null && (
                <span className="text-[var(--text3)]"> · {detail.attainmentPct.toFixed(1)}% attained</span>
              )}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Set Quota
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Set Quota</DialogTitle>
          <form action={formAction} className="space-y-3 mt-2">
            <input type="hidden" name="rep_id" value={detail.id} />

            <div>
              <Label htmlFor="period">Period</Label>
              <Input
                id="period"
                name="period"
                type="text"
                defaultValue={detail.currentPeriod}
                pattern="\d{4}-\d{2}"
                placeholder="YYYY-MM"
                required
              />
              <p className="mt-1 text-[11px] text-[var(--text3)]">Format: YYYY-MM (e.g. 2026-04)</p>
            </div>

            <div>
              <Label htmlFor="target_amount">Target Amount ($)</Label>
              <Input
                id="target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={detail.quota ?? ""}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 16: Wire `SubRepQuotaSection` into detail page

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/[subRepId]/page.tsx`

- [ ] **Step 1: Add import**

Near the other section imports:

```typescript
import SubRepQuotaSection from "./(sections)/SubRepQuotaSection";
```

- [ ] **Step 2: Render after `<SubRepHero />`**

Find the JSX:

```typescript
        <SubRepHero />
        <SubRepKpiRow />
```

Replace with:

```typescript
        <SubRepHero />
        <SubRepQuotaSection />
        <SubRepKpiRow />
```

- [ ] **Step 3: Verify**

Run `npm run build 2>&1 | tail -20` → success.

---

## Task 17: Full build + browser spot-check

- [ ] **Step 1: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: zero errors; `/dashboard/my-team` + `/dashboard/my-team/[subRepId]` both listed.

- [ ] **Step 2: Spot-check as admin**

Start `npm run dev`. Log in as admin.

1. `/dashboard/my-team` — see 5 KPI cards, Status chips (All/Active/Inactive), **no** View chips, Period dropdown, Search. Flat rep list with name/email + 4 stats + status pill.
2. Toggle Period → Orders/Delivered/Commission and Delivered Revenue card change; Total Reps/Accounts/Active stay the same.
3. Click any rep → detail page loads. See **Quota** section between Hero and KPI row. Click "Set Quota" → dialog opens, submit → toast and refresh.
4. Accounts section — account names render as plain text, not links.

- [ ] **Step 3: Spot-check as sales rep with sub-reps**

1. `/dashboard/my-team` — see KPI cards, Status chips, **View chips** (All Sub-Reps / Direct Only), Period, Search.
2. Toggle View → row count changes (direct-only filters to immediate children).
3. Click a sub-rep → detail page. Quota section visible, "Set Quota" works for direct sub-reps.
4. Try setting quota on a non-direct rep via URL hack → action returns "Unauthorized" toast.
