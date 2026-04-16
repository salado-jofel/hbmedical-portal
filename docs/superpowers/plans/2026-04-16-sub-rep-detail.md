# Sub-Rep Detail, My-Team Rearrangement & Commissions Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT run `git commit` or `git add` — user has explicit rules against unauthorized commits.**

**Goal:** Move rate-setting and a scoped commission calculator out of the Commissions page and into a new sub-rep detail page under My Team. Admins get a hierarchy tree view at `/dashboard/my-team` and lose the Commissions page from their sidebar. Reps keep Commissions as display-only plus a new "Team Earnings" section.

**Architecture:** A new detail page at `/dashboard/my-team/[subRepId]` composes existing RateManagement + CommissionCalculator (given a `lockedRepId` prop) with new sub-rep-scoped sections (hero, KPI row, accounts, history). `getAccountsWithMetrics` gains an optional `{ repIdOverride }` arg for reuse. The Commissions page loses rate/calculator UI, gains a TeamEarnings section, and admins get redirected away from it. A new `getRepTree()` action powers the admin hierarchy view.

**Tech Stack:** Next.js 16 App Router server actions, Supabase admin client, Redux Toolkit, TypeScript, Tailwind CSS 4, existing `DataTable` / `KpiCard` / `RateManagement` / `CommissionCalculator`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `utils/interfaces/my-team.ts` | Modify | Add `commissionEarned` on `SubRep`; add `IRepTreeNode` + `ISubRepDetail` types |
| `accounts/(services)/actions.ts` | Modify | Add `{ repIdOverride }` second arg to `getAccountsWithMetrics` |
| `my-team/(services)/actions.ts` | Modify | Add `commissionEarned` to `getMySubReps`; add `getRepTree()` + `getSubRepDetail()` |
| `my-team/(redux)/my-team-slice.ts` | Modify | Add `commissionEarned` on `SubRep` type |
| `my-team/(redux)/sub-rep-detail-slice.ts` | **Create** | Detail page Redux state |
| `my-team/(sections)/TeamView.tsx` | Modify | Card → `<Link>`, 4-cell stats, override % inline row |
| `my-team/(sections)/RepTree.tsx` | **Create** | Admin hierarchy tree |
| `my-team/page.tsx` | Modify | Role branch: rep → `TeamView`, admin → `RepTree` |
| `my-team/[subRepId]/page.tsx` | **Create** | Sub-rep detail server page + guard |
| `my-team/[subRepId]/(sections)/Providers.tsx` | **Create** | Hydrate detail slice |
| `my-team/[subRepId]/(sections)/SubRepHero.tsx` | **Create** | Hero with quota progress |
| `my-team/[subRepId]/(sections)/SubRepKpiRow.tsx` | **Create** | 6-card KPI row |
| `my-team/[subRepId]/(sections)/SubRepRateSection.tsx` | **Create** | Wraps `RateManagement` |
| `my-team/[subRepId]/(sections)/SubRepCalculator.tsx` | **Create** | Wraps `CommissionCalculator` w/ `lockedRepId` |
| `my-team/[subRepId]/(sections)/SubRepAccounts.tsx` | **Create** | Accounts table scoped to sub-rep |
| `my-team/[subRepId]/(sections)/SubRepCommissionHistory.tsx` | **Create** | 12-row history table |
| `commissions/(sections)/CommissionCalculator.tsx` | Modify | Accept optional `lockedRepId` |
| `commissions/(sections)/TeamEarnings.tsx` | **Create** | Rep-only override-earnings summary |
| `commissions/page.tsx` | Modify | Admin redirect; remove `RateManagement` + `CommissionCalculator`; render `TeamEarnings` |
| `(sections)/Sidebar.tsx` | Modify | Hide Commissions for admin |
| `store/store.ts` | Modify | Register `subRepDetail` slice |

---

## Task 1: Add types to `utils/interfaces/my-team.ts`

**Files:**
- Create or modify: `utils/interfaces/my-team.ts`

- [ ] **Step 1: Check if the file exists**

Run `ls utils/interfaces/my-team.ts 2>/dev/null || echo "missing"`.

- If the file exists, open it and add the types below, keeping existing content.
- If it doesn't exist, create it with the full content below.

- [ ] **Step 2: Ensure the file contains these types**

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
}

export interface IRepTreeNode {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  accountCount: number;
  orderCount: number;
  commissionEarned: number;
  commissionRate: number;
  overridePercent: number;
  children: IRepTreeNode[];
}

export interface ICommissionHistoryRow {
  id: string;
  period: string;
  commission_amount: number;
  adjustment: number;
  final_amount: number;
  your_override_amount: number | null;
  status: string;
}

export interface ISubRepDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  currentPeriod: string;                     // "2026-04"
  actualRevenue: number;
  paidOrders: number;
  commissionEarned: number;
  avgOrderValue: number;
  pipelineRevenue: number;
  overrideEarnedThisPeriod: number | null;   // null when viewer is admin
  commissionRate: number;
  overridePercent: number;
  quota: number | null;
  attainmentPct: number | null;
  history: ICommissionHistoryRow[];
  accounts: unknown[];                       // typed later as IAccountWithMetrics[] in consumer
}
```

**Note:** If the existing `my-team-slice.ts` currently defines a `SubRep` type inline, keep that file using the same structure but re-export from `utils/interfaces/my-team.ts` to avoid drift. The slice change is Task 3.

- [ ] **Step 3: Verify compile**

Run `npx tsc --noEmit 2>&1 | tail -10` — expected: errors elsewhere (slice, actions) that later tasks fix. Do not fix here.

---

## Task 2: Add `{ repIdOverride }` arg to `getAccountsWithMetrics`

**Files:**
- Modify: `app/(dashboard)/dashboard/accounts/(services)/actions.ts`

- [ ] **Step 1: Update the signature**

Find:

```typescript
export async function getAccountsWithMetrics(
  period: AccountPeriod = "this_month",
): Promise<IAccountWithMetrics[]> {
```

Replace with:

```typescript
export async function getAccountsWithMetrics(
  period: AccountPeriod = "this_month",
  opts?: { repIdOverride?: string },
): Promise<IAccountWithMetrics[]> {
```

- [ ] **Step 2: Bypass rep-hierarchy lookup when override is set**

Find the block that computes `repScopeIds` (starts with `let repScopeIds: string[] | null = null;` and ends before `let facQuery = adminClient`). Replace that block with:

```typescript
  let repScopeIds: string[] | null = null;
  if (opts?.repIdOverride) {
    repScopeIds = [opts.repIdOverride];
  } else if (!checkIsAdmin(role)) {
    const { data: hierarchy } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .eq("parent_rep_id", user.id);
    const subRepIds = (hierarchy ?? []).map((h: any) => h.child_rep_id as string);
    repScopeIds = [user.id, ...subRepIds];
  }
```

(When `repIdOverride` is set, we trust the caller's auth and scope strictly to that rep.)

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors in this file. `npm run build 2>&1 | tail -10` → standard Route table.

---

## Task 3: Refactor `my-team-slice` to use shared `SubRep` type

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(redux)/my-team-slice.ts`

- [ ] **Step 1: Read the current slice**

Open the file and note the existing `SubRep` type definition.

- [ ] **Step 2: Replace inline type with an import from `utils/interfaces/my-team.ts`**

Replace the inline `SubRep` interface/type definition with:

```typescript
import type { SubRep } from "@/utils/interfaces/my-team";
export type { SubRep };
```

Leave the rest of the slice (actions, reducers, exports) unchanged. All consumers that currently import `SubRep` from `"../(redux)/my-team-slice"` continue to work.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` — expected: errors in `my-team/(services)/actions.ts` (return type mismatch — missing `commissionEarned`). Fixed by Task 4.

---

## Task 4: Extend `getMySubReps` with `commissionEarned`

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Add imports**

Add at the top alongside existing imports:

```typescript
import { SALES_QUOTAS_TABLE } from "@/utils/constants/quotas";
```

Also import `SubRep` type from the shared location if helpful for return typing:

```typescript
import type { SubRep } from "@/utils/interfaces/my-team";
```

- [ ] **Step 2: Add `commissionEarned` enrichment to `getMySubReps`**

Inside the `subReps.map(async (rep) => { ... })` callback, after the existing `rate` query, add a query for commissions and compute the current period's earned value. Find:

```typescript
      const { data: rate } = await adminClient
        .from("commission_rates")
        .select("rate_percent, override_percent")
        .eq("rep_id", rep.id)
        .is("effective_to", null)
        .maybeSingle();

      return {
        ...rep,
        accountCount: accountCount || 0,
        orderCount,
        revenue,
        commissionRate: rate?.rate_percent || 0,
        overridePercent: rate?.override_percent || 0,
      };
```

Replace with:

```typescript
      const { data: rate } = await adminClient
        .from("commission_rates")
        .select("rate_percent, override_percent")
        .eq("rep_id", rep.id)
        .is("effective_to", null)
        .maybeSingle();

      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { data: commRows } = await adminClient
        .from("commissions")
        .select("final_amount, commission_amount, adjustment")
        .eq("rep_id", rep.id)
        .eq("payout_period", currentPeriod)
        .neq("status", "void");
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

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors. `npm run build 2>&1 | tail -10` → success.

---

## Task 5: Update `TeamView` sub-rep card

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(sections)/TeamView.tsx`

- [ ] **Step 1: Add imports**

Add alongside existing imports:

```typescript
import Link from "next/link";
import { formatAmount } from "@/utils/helpers/formatter";
```

- [ ] **Step 2: Wrap `SubRepCard` body in a Link and change stats grid**

Replace the existing `SubRepCard` function body in its entirety:

```typescript
function SubRepCard({ rep }: { rep: SubRep }) {
  const statusConfig =
    STATUS_CONFIG[rep.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.pending;

  return (
    <Link
      href={`/dashboard/my-team/${rep.id}`}
      className="block bg-white border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--navy)] text-white flex items-center justify-center text-sm font-medium shrink-0">
            {rep.first_name?.[0]}
            {rep.last_name?.[0]}
          </div>
          <div>
            <p className="font-semibold text-[var(--navy)]">
              {rep.first_name} {rep.last_name}
            </p>
            <p className="text-xs text-[#94a3b8]">Sub-Representative</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
            statusConfig.className,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
          {statusConfig.label}
        </span>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5 mb-3 text-xs text-[#64748b]">
        <div className="flex items-center gap-2">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{rep.email}</span>
        </div>
        {rep.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{rep.phone}</span>
          </div>
        )}
      </div>

      {/* Override % line */}
      <p className="mb-3 text-[11px] text-[#64748b]">
        Your override: <span className="font-semibold text-[var(--navy)]">{rep.overridePercent}%</span>
      </p>

      {/* Stats grid (4 cells) */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[var(--border)]">
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--navy)]">{rep.accountCount}</p>
          <p className="text-[10px] text-[#94a3b8]">Accounts</p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--navy)]">{rep.orderCount}</p>
          <p className="text-[10px] text-[#94a3b8]">Orders</p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[#0d7a6b]">{rep.commissionRate}%</p>
          <p className="text-[10px] text-[#94a3b8]">Rate</p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--navy)]">{formatAmount(rep.commissionEarned)}</p>
          <p className="text-[10px] text-[#94a3b8]">Comm $</p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 6: Add `getRepTree()` server action

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Add import for shared type**

Add alongside existing imports:

```typescript
import type { IRepTreeNode } from "@/utils/interfaces/my-team";
```

- [ ] **Step 2: Append `getRepTree` function to the file**

```typescript
export async function getRepTree(): Promise<IRepTreeNode[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  // 1. All active sales reps
  const { data: reps } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, status")
    .eq("role", "sales_representative")
    .order("first_name");
  const repList = reps ?? [];
  if (repList.length === 0) return [];

  const repIds = repList.map((r: any) => r.id as string);

  // 2. All hierarchy edges
  const { data: edges } = await adminClient
    .from("rep_hierarchy")
    .select("parent_rep_id, child_rep_id")
    .in("child_rep_id", repIds);
  const parentByChild: Record<string, string> = {};
  for (const e of edges ?? []) parentByChild[e.child_rep_id] = e.parent_rep_id;

  // 3. Facility + order enrichment per rep
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, assigned_rep")
    .in("assigned_rep", repIds)
    .neq("facility_type", "rep_office");
  const facilitiesByRep: Record<string, string[]> = {};
  const accountCountByRep: Record<string, number> = {};
  for (const f of facs ?? []) {
    const r = f.assigned_rep as string;
    (facilitiesByRep[r] ??= []).push(f.id as string);
    accountCountByRep[r] = (accountCountByRep[r] ?? 0) + 1;
  }

  const allFacilityIds = Object.values(facilitiesByRep).flat();
  const orderCountByRep: Record<string, number> = {};
  if (allFacilityIds.length > 0) {
    const { data: orders } = await adminClient
      .from("orders")
      .select("id, facility_id")
      .in("facility_id", allFacilityIds)
      .neq("order_status", "canceled");
    const repByFacility: Record<string, string> = {};
    for (const r of repIds) for (const fid of facilitiesByRep[r] ?? []) repByFacility[fid] = r;
    for (const o of orders ?? []) {
      const r = repByFacility[o.facility_id as string];
      if (r) orderCountByRep[r] = (orderCountByRep[r] ?? 0) + 1;
    }
  }

  // 4. Rates + current-period commission per rep
  const { data: rates } = await adminClient
    .from("commission_rates")
    .select("rep_id, rate_percent, override_percent")
    .in("rep_id", repIds)
    .is("effective_to", null);
  const rateByRep: Record<string, { rate_percent: number; override_percent: number }> = {};
  for (const r of rates ?? []) {
    rateByRep[r.rep_id as string] = {
      rate_percent: Number(r.rate_percent ?? 0),
      override_percent: Number(r.override_percent ?? 0),
    };
  }

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: commRows } = await adminClient
    .from("commissions")
    .select("rep_id, final_amount, commission_amount, adjustment, status")
    .in("rep_id", repIds)
    .eq("payout_period", currentPeriod)
    .neq("status", "void");
  const commissionByRep: Record<string, number> = {};
  for (const c of commRows ?? []) {
    const rid = c.rep_id as string;
    const amt = c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0);
    commissionByRep[rid] = (commissionByRep[rid] ?? 0) + amt;
  }

  // 5. Build flat node map
  const nodeById = new Map<string, IRepTreeNode>();
  for (const r of repList) {
    const id = r.id as string;
    nodeById.set(id, {
      id,
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      email: r.email ?? null,
      status: r.status ?? null,
      accountCount: accountCountByRep[id] ?? 0,
      orderCount: orderCountByRep[id] ?? 0,
      commissionEarned: commissionByRep[id] ?? 0,
      commissionRate: rateByRep[id]?.rate_percent ?? 0,
      overridePercent: rateByRep[id]?.override_percent ?? 0,
      children: [],
    });
  }

  // 6. Wire children into their parents
  const roots: IRepTreeNode[] = [];
  for (const node of nodeById.values()) {
    const parentId = parentByChild[node.id];
    if (parentId && nodeById.has(parentId)) {
      nodeById.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.

---

## Task 7: Create `RepTree` admin view component

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(sections)/RepTree.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { cn } from "@/utils/utils";
import type { IRepTreeNode } from "@/utils/interfaces/my-team";

export function RepTree({ tree }: { tree: IRepTreeNode[] }) {
  const [search, setSearch] = useState("");
  const [topLevelOnly, setTopLevelOnly] = useState(false);

  const filteredTree = useMemo(() => {
    const term = search.trim().toLowerCase();
    function matches(node: IRepTreeNode): boolean {
      const name = `${node.first_name ?? ""} ${node.last_name ?? ""} ${node.email ?? ""}`.toLowerCase();
      return !term || name.includes(term);
    }
    function filter(nodes: IRepTreeNode[]): IRepTreeNode[] {
      const out: IRepTreeNode[] = [];
      for (const n of nodes) {
        const kids = topLevelOnly ? [] : filter(n.children);
        if (matches(n) || kids.length > 0) out.push({ ...n, children: kids });
      }
      return out;
    }
    return filter(tree);
  }, [tree, search, topLevelOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reps..."
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text2)]">
          <input
            type="checkbox"
            checked={topLevelOnly}
            onChange={(e) => setTopLevelOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--navy)]"
          />
          Show top-level only
        </label>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
        <div className="grid grid-cols-[minmax(220px,2fr)_110px_90px_90px_110px_130px] px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--text3)] border-b border-[var(--border)] bg-[#f8fafc]">
          <span>Rep</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Override</span>
          <span className="text-right">Accounts</span>
          <span className="text-right">Orders</span>
          <span className="text-right">Commission $</span>
        </div>
        {filteredTree.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} />
        ))}
        {filteredTree.length === 0 && (
          <div className="px-4 py-6 text-sm text-[var(--text3)] text-center">No reps match.</div>
        )}
      </div>
    </div>
  );
}

function TreeRow({ node, depth }: { node: IRepTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[minmax(220px,2fr)_110px_90px_90px_110px_130px] items-center px-4 py-2 border-b border-[var(--border)] last:border-b-0 hover:bg-[#f8fafc]",
        )}
      >
        <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-[var(--text3)] hover:text-[var(--navy)]"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <Link
            href={`/dashboard/my-team/${node.id}`}
            className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--navy)] hover:underline"
          >
            {node.first_name} {node.last_name}
            <span className="ml-2 text-[10px] text-[var(--text3)] font-normal">{node.status}</span>
          </Link>
        </div>
        <span className="text-right text-sm text-[var(--text2)]">{node.commissionRate}%</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.overridePercent}%</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.accountCount}</span>
        <span className="text-right text-sm text-[var(--text2)]">{node.orderCount}</span>
        <span className="text-right text-sm font-semibold text-[var(--navy)]">
          {formatAmount(node.commissionEarned)}
        </span>
      </div>
      {hasChildren && expanded &&
        node.children.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} />)
      }
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 8: Role-branch the my-team page

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/page.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { TeamView } from "./(sections)/TeamView";
import { RepTree } from "./(sections)/RepTree";
import { getMySubReps, getRepTree } from "./(services)/actions";

export const metadata: Metadata = { title: "My Team" };
export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isSalesRep(role) && !isAdmin(role)) redirect("/dashboard");

  if (isAdmin(role)) {
    const tree = await getRepTree();
    return (
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <PageHeader
          title="Sales Reps"
          subtitle="Review all sales representatives and manage their commission rates"
          className="pb-4"
        />
        <RepTree tree={tree} />
      </div>
    );
  }

  const subReps = await getMySubReps();
  return (
    <Providers subReps={subReps}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <PageHeader
          title="My Team"
          subtitle="Manage your sub-representatives and their accounts"
          className="pb-4"
        />
        <TeamView />
      </div>
    </Providers>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run build 2>&1 | tail -15` → success.

---

## Task 9: Add `lockedRepId` prop to `CommissionCalculator`

**Files:**
- Modify: `app/(dashboard)/dashboard/commissions/(sections)/CommissionCalculator.tsx`

- [ ] **Step 1: Read the current file**

Open the file and locate the component signature and the rep selector element (look for the rep dropdown — likely a `<Select>` or similar).

- [ ] **Step 2: Add `lockedRepId` prop**

Update the component signature to accept an optional `lockedRepId`:

- If the component is currently `export default function CommissionCalculator({ reps }: { reps: ... }) { ... }` → add `lockedRepId?: string` to the props type.
- If there is existing `useState` for the selected rep, initialize it from `lockedRepId` when provided.
- Hide the rep selector UI (`<Select>` or equivalent) when `lockedRepId` is truthy. Leave the period selector and other filters alone.

Concretely, if the existing code has something like:

```typescript
const [selectedRepId, setSelectedRepId] = useState<string>("");
```

Change to:

```typescript
const [selectedRepId, setSelectedRepId] = useState<string>(lockedRepId ?? "");
```

And wrap the rep `<Select>` JSX with:

```typescript
{!lockedRepId && (
  /* existing rep selector JSX here */
)}
```

**If you need exact shape of the existing file, read it first and match its conventions — do not refactor anything unrelated.**

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.

---

## Task 10: Add `getSubRepDetail` server action

**Files:**
- Modify: `app/(dashboard)/dashboard/my-team/(services)/actions.ts`

- [ ] **Step 1: Add imports**

Add at the top alongside existing imports:

```typescript
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { getUserRole } from "@/lib/supabase/auth";
import type { ISubRepDetail, ICommissionHistoryRow } from "@/utils/interfaces/my-team";
import { getAccountsWithMetrics } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
```

- [ ] **Step 2: Append `getSubRepDetail` function**

```typescript
export async function getSubRepDetail(subRepId: string): Promise<ISubRepDetail | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  const adminClient = createAdminClient();

  // 1. Access control
  if (!isAdmin(role)) {
    if (!isSalesRep(role)) return null;
    const { data: edge } = await adminClient
      .from("rep_hierarchy")
      .select("child_rep_id")
      .eq("parent_rep_id", user.id)
      .eq("child_rep_id", subRepId)
      .maybeSingle();
    if (!edge) return null;
  }

  // 2. Sub-rep profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status")
    .eq("id", subRepId)
    .maybeSingle();
  if (!profile) return null;

  // 3. Current period + quota
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endISO   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: quotaRow } = await adminClient
    .from("sales_quotas")
    .select("target_amount")
    .eq("rep_id", subRepId)
    .eq("period", currentPeriod)
    .maybeSingle();
  const quota = quotaRow ? Number(quotaRow.target_amount) : null;

  // 4. Sub-rep's facilities
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id")
    .eq("assigned_rep", subRepId);
  const facilityIds = (facs ?? []).map((f: any) => f.id as string);

  // 5. Orders + revenue for current period
  let paidOrders = 0;
  let actualRevenue = 0;
  if (facilityIds.length > 0) {
    const { data: paid } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .eq("payment_status", "paid")
      .gte("paid_at", startISO)
      .lt("paid_at", endISO);
    paidOrders = (paid ?? []).length;
    const paidIds = (paid ?? []).map((o: any) => o.id as string);
    if (paidIds.length > 0) {
      const { data: items } = await adminClient
        .from("order_items")
        .select("total_amount")
        .in("order_id", paidIds);
      actualRevenue = (items ?? []).reduce(
        (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
      );
    }
  }

  // 6. Commission this period
  const { data: commRowsThisPeriod } = await adminClient
    .from("commissions")
    .select("final_amount, commission_amount, adjustment")
    .eq("rep_id", subRepId)
    .eq("payout_period", currentPeriod)
    .neq("status", "void");
  const commissionEarned = (commRowsThisPeriod ?? []).reduce((sum: number, c: any) => {
    return sum + (c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0));
  }, 0);

  // 7. Pipeline revenue (approved + shipped)
  let pipelineRevenue = 0;
  if (facilityIds.length > 0) {
    const { data: pipelineOrders } = await adminClient
      .from("orders")
      .select("id")
      .in("facility_id", facilityIds)
      .in("order_status", ["approved", "shipped"]);
    const pipelineIds = (pipelineOrders ?? []).map((o: any) => o.id as string);
    if (pipelineIds.length > 0) {
      const { data: items } = await adminClient
        .from("order_items")
        .select("total_amount")
        .in("order_id", pipelineIds);
      pipelineRevenue = (items ?? []).reduce(
        (sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0,
      );
    }
  }

  // 8. Rate + override
  const { data: rate } = await adminClient
    .from("commission_rates")
    .select("rate_percent, override_percent")
    .eq("rep_id", subRepId)
    .is("effective_to", null)
    .maybeSingle();
  const commissionRate = Number(rate?.rate_percent ?? 0);
  const overridePercent = Number(rate?.override_percent ?? 0);

  // 9. Override earned by viewer (only when viewer is the parent rep, not admin)
  const overrideEarnedThisPeriod = isAdmin(role)
    ? null
    : commissionEarned * (overridePercent / 100);

  // 10. History (last 12)
  const { data: history } = await adminClient
    .from("commissions")
    .select("id, payout_period, commission_amount, adjustment, final_amount, status")
    .eq("rep_id", subRepId)
    .order("payout_period", { ascending: false })
    .limit(12);
  const historyRows: ICommissionHistoryRow[] = (history ?? []).map((h: any) => {
    const gross = Number(h.commission_amount ?? 0);
    const adjustment = Number(h.adjustment ?? 0);
    const final = h.final_amount != null ? Number(h.final_amount) : gross + adjustment;
    const yourOverride = isAdmin(role) ? null : final * (overridePercent / 100);
    return {
      id: h.id,
      period: h.payout_period,
      commission_amount: gross,
      adjustment,
      final_amount: final,
      your_override_amount: yourOverride,
      status: h.status,
    };
  });

  // 11. Accounts
  const accounts = await getAccountsWithMetrics("this_month", { repIdOverride: subRepId });

  const avgOrderValue = paidOrders > 0 ? actualRevenue / paidOrders : 0;
  const attainmentPct = quota != null && quota > 0 ? (actualRevenue / quota) * 100 : null;

  return {
    id: profile.id,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    status: profile.status ?? null,
    currentPeriod,
    actualRevenue,
    paidOrders,
    commissionEarned,
    avgOrderValue,
    pipelineRevenue,
    overrideEarnedThisPeriod,
    commissionRate,
    overridePercent,
    quota,
    attainmentPct,
    history: historyRows,
    accounts: accounts as unknown[],
  };
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.

---

## Task 11: Create sub-rep detail Redux slice

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/(redux)/sub-rep-detail-slice.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ISubRepDetail } from "@/utils/interfaces/my-team";

interface SubRepDetailState {
  detail: ISubRepDetail | null;
}

const initialState: SubRepDetailState = { detail: null };

const subRepDetailSlice = createSlice({
  name: "subRepDetail",
  initialState,
  reducers: {
    setSubRepDetail(state, action: PayloadAction<ISubRepDetail | null>) {
      state.detail = action.payload;
    },
  },
});

export const { setSubRepDetail } = subRepDetailSlice.actions;
export default subRepDetailSlice.reducer;
```

- [ ] **Step 2: Register in `store/store.ts`**

Open `store/store.ts`. Add import at the top:

```typescript
import subRepDetailSlice from "@/app/(dashboard)/dashboard/my-team/(redux)/sub-rep-detail-slice";
```

Add `subRepDetail: subRepDetailSlice` inside the root `reducer: { ... }` object (alphabetical or near other my-team slices).

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 12: Sub-rep detail page sections (hero, KPI, rate, calculator, accounts, history)

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/Providers.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepHero.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepKpiRow.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepRateSection.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepCalculator.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepAccounts.tsx`
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/(sections)/SubRepCommissionHistory.tsx`

- [ ] **Step 1: Create `Providers.tsx`**

```typescript
"use client";

import { type ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setSubRepDetail } from "../../(redux)/sub-rep-detail-slice";
import type { ISubRepDetail } from "@/utils/interfaces/my-team";

export default function Providers({ children, detail }: { children: ReactNode; detail: ISubRepDetail }) {
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(setSubRepDetail(detail)); }, [dispatch, detail]);
  return <>{children}</>;
}
```

- [ ] **Step 2: Create `SubRepHero.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

function statusInfo(pct: number | null): { label: string; dotCls: string; textCls: string } {
  if (pct === null)  return { label: "No quota set",  dotCls: "bg-[var(--border2)]", textCls: "text-[var(--text3)]" };
  if (pct >= 100)    return { label: "Quota met!",    dotCls: "bg-emerald-500",       textCls: "text-emerald-600"    };
  if (pct >= 75)     return { label: "Almost there",  dotCls: "bg-[var(--teal)]",     textCls: "text-[var(--teal)]"  };
  if (pct >= 25)     return { label: "On track",      dotCls: "bg-[var(--gold)]",     textCls: "text-[var(--gold)]"  };
  return               { label: "Behind pace",  dotCls: "bg-red-500",           textCls: "text-red-500"        };
}

export default function SubRepHero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const pct = detail.attainmentPct;
  const capped = Math.min(pct ?? 0, 100);
  const { label, dotCls, textCls } = statusInfo(pct);
  const initials =
    (detail.first_name?.[0] ?? "") + (detail.last_name?.[0] ?? "");

  return (
    <div className="space-y-3">
      <Link
        href="/dashboard/my-team"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text2)] hover:text-[var(--navy)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Team
      </Link>

      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between px-6 py-5" style={{ background: "var(--navy)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {mounted ? (initials || "?") : "?"}
            </div>
            <div>
              <p className="text-[18px] font-semibold leading-tight text-white">
                {detail.first_name} {detail.last_name}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "#7fb3cc" }}>
                Sub-Representative · {detail.commissionRate}% Commission Rate
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[32px] font-bold leading-none text-white">
              {pct !== null ? `${pct.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "#7fb3cc" }}>
              of {periodLabel(detail.currentPeriod)} goal
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {detail.quota == null ? (
            <p className="text-[13px] text-[var(--text3)]">No quota set for this period.</p>
          ) : (
            <>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--border2)]">
                <div
                  className="h-full rounded-full bg-[var(--teal-mid)] transition-[width] duration-500"
                  style={{ width: `${capped}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[12px] text-[var(--text3)]">
                  {formatAmount(detail.actualRevenue)} of {formatAmount(detail.quota)}
                </span>
                <span className="text-[13px] font-bold text-[var(--navy)]">{pct?.toFixed(1)}%</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
                <span className={`text-[12px] font-medium ${textCls}`}>{label}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `SubRepKpiRow.tsx`**

```typescript
"use client";

import { useAppSelector } from "@/store/hooks";
import { KpiCard } from "@/app/(components)/KpiCard";
import { formatAmount } from "@/utils/helpers/formatter";

export default function SubRepKpiRow() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const cards: Array<{ label: string; value: string; accentColor?: string; show?: boolean }> = [
    { label: "Revenue This Month", value: formatAmount(detail.actualRevenue), accentColor: "teal" },
    { label: "Orders This Month",  value: String(detail.paidOrders),            accentColor: "blue" },
    { label: "Commission Earned",  value: formatAmount(detail.commissionEarned), accentColor: "green" },
    { label: "Avg Order Value",    value: formatAmount(detail.avgOrderValue),    accentColor: "purple" },
    { label: "Pipeline Revenue",   value: formatAmount(detail.pipelineRevenue),  accentColor: "blue" },
    {
      label: "Your Override Earned",
      value: formatAmount(detail.overrideEarnedThisPeriod ?? 0),
      accentColor: "purple",
      show: detail.overrideEarnedThisPeriod !== null,
    },
  ];

  const visible = cards.filter((c) => c.show !== false);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-3">
      {visible.map((c) => (
        <KpiCard key={c.label} label={c.label} value={c.value} accentColor={c.accentColor} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `SubRepRateSection.tsx`**

```typescript
"use client";

import { useAppSelector } from "@/store/hooks";
import RateManagement from "@/app/(dashboard)/dashboard/commissions/(sections)/RateManagement";

export default function SubRepRateSection() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const repName = `${detail.first_name ?? ""} ${detail.last_name ?? ""}`.trim() || "Sub-rep";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Commission Rate</h2>
      <RateManagement reps={[{ id: detail.id, name: repName }]} />
    </section>
  );
}
```

**Note:** `RateManagement` already filters displayed rates by `repId`; passing an array with just this sub-rep ensures the Set New Rate dialog pre-selects them. If `RateManagement` does not behave this way in the current codebase, leave the section rendering the component as-is — the dialog will still work since it takes `reps` as its dropdown source.

- [ ] **Step 5: Create `SubRepCalculator.tsx`**

```typescript
"use client";

import { useAppSelector } from "@/store/hooks";
import CommissionCalculator from "@/app/(dashboard)/dashboard/commissions/(sections)/CommissionCalculator";

export default function SubRepCalculator() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const repName = `${detail.first_name ?? ""} ${detail.last_name ?? ""}`.trim() || "Sub-rep";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Commission Calculator</h2>
      <CommissionCalculator reps={[{ id: detail.id, name: repName }]} lockedRepId={detail.id} />
    </section>
  );
}
```

- [ ] **Step 6: Create `SubRepAccounts.tsx`**

```typescript
"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { DataTable } from "@/app/(components)/DataTable";
import { EmptyState } from "@/app/(components)/EmptyState";
import { cn } from "@/utils/utils";
import { formatDate } from "@/utils/helpers/formatter";
import { AccountTierBadge } from "@/app/(dashboard)/dashboard/accounts/(components)/AccountTierBadge";
import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";
import type { TableColumn } from "@/utils/interfaces/table-column";

export default function SubRepAccounts() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;
  const accounts = detail.accounts as IAccountWithMetrics[];

  const columns: TableColumn<IAccountWithMetrics>[] = [
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
    {
      key: "tier", label: "Tier",
      headerClassName: "text-center", cellClassName: "text-center",
      render: (a) => <div className="inline-flex"><AccountTierBadge tier={a.tier} /></div>,
    },
    {
      key: "signed", label: "Signed",
      headerClassName: "text-right", cellClassName: "text-right",
      render: (a) => <span className="text-sm text-[var(--navy)]">{a.signed_count}</span>,
    },
    {
      key: "delivered", label: "Delivered",
      headerClassName: "text-right", cellClassName: "text-right",
      render: (a) => (
        <span className={cn("text-sm font-medium", (a.delivered_count ?? 0) > 0 ? "text-[var(--green)]" : "text-[var(--text3)]")}>
          {a.delivered_count ?? 0}
        </span>
      ),
    },
    {
      key: "onboarded", label: "Onboarded",
      headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell",
      render: (a) => <span className="text-sm text-[var(--text2)]">{formatDate(a.onboarded_at)}</span>,
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Accounts</h2>
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 stroke-1" />}
          message="No accounts assigned"
          description="This sub-rep has no facilities assigned yet"
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <DataTable
            columns={columns}
            data={accounts}
            keyExtractor={(a) => a.id}
            emptyMessage="No accounts found"
            emptyIcon={<Building2 className="w-10 h-10 stroke-1" />}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Create `SubRepCommissionHistory.tsx`**

```typescript
"use client";

import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import { cn } from "@/utils/utils";

const STATUS_STYLES: Record<string, string> = {
  paid:      "bg-[var(--green-lt)] text-[var(--green)]",
  pending:   "bg-[var(--gold-lt)]  text-[var(--gold)]",
  approved:  "bg-[var(--blue-lt,#dbeafe)] text-[var(--blue,#2563eb)]",
  void:      "bg-[#f1f5f9]         text-[var(--text3)]",
};

export default function SubRepCommissionHistory() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;
  const { history, overrideEarnedThisPeriod } = detail;
  const showOverrideCol = overrideEarnedThisPeriod !== null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Commission History</h2>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[var(--text3)]">
            <tr>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-right">Gross</th>
              <th className="px-4 py-2 text-right">Adjustment</th>
              <th className="px-4 py-2 text-right">Final</th>
              {showOverrideCol && <th className="px-4 py-2 text-right">Your Override</th>}
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={showOverrideCol ? 6 : 5} className="px-4 py-6 text-center text-[var(--text3)]">
                  No commission history yet.
                </td>
              </tr>
            ) : history.map((h) => (
              <tr key={h.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--navy)]">{h.period}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(h.commission_amount)}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(h.adjustment)}</td>
                <td className="px-4 py-2 text-right font-medium text-[var(--navy)]">{formatAmount(h.final_amount)}</td>
                {showOverrideCol && (
                  <td className="px-4 py-2 text-right text-[var(--text2)]">
                    {h.your_override_amount != null ? formatAmount(h.your_override_amount) : "—"}
                  </td>
                )}
                <td className="px-4 py-2">
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                    STATUS_STYLES[h.status] ?? STATUS_STYLES.pending)}>
                    {h.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Verify**

Run `npx tsc --noEmit 2>&1 | tail -10` → zero errors.

---

## Task 13: Create sub-rep detail server page

**Files:**
- Create: `app/(dashboard)/dashboard/my-team/[subRepId]/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getSubRepDetail } from "../(services)/actions";
import Providers from "./(sections)/Providers";
import SubRepHero from "./(sections)/SubRepHero";
import SubRepKpiRow from "./(sections)/SubRepKpiRow";
import SubRepRateSection from "./(sections)/SubRepRateSection";
import SubRepCalculator from "./(sections)/SubRepCalculator";
import SubRepAccounts from "./(sections)/SubRepAccounts";
import SubRepCommissionHistory from "./(sections)/SubRepCommissionHistory";

export const metadata: Metadata = { title: "Sub-Rep Detail" };
export const dynamic = "force-dynamic";

export default async function SubRepDetailPage({
  params,
}: {
  params: Promise<{ subRepId: string }>;
}) {
  const { subRepId } = await params;
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const detail = await getSubRepDetail(subRepId);
  if (!detail) notFound();

  return (
    <Providers detail={detail}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <SubRepHero />
        <SubRepKpiRow />
        <SubRepRateSection />
        <SubRepCalculator />
        <SubRepAccounts />
        <SubRepCommissionHistory />
      </div>
    </Providers>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run build 2>&1 | tail -20` → success.

---

## Task 14: Commissions page — admin redirect + rep restructure + `TeamEarnings`

**Files:**
- Create: `app/(dashboard)/dashboard/commissions/(sections)/TeamEarnings.tsx`
- Modify: `app/(dashboard)/dashboard/commissions/page.tsx`

- [ ] **Step 1: Create `TeamEarnings.tsx`**

```typescript
"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import type { SubRep } from "@/utils/interfaces/my-team";

export default function TeamEarnings({ subReps }: { subReps: SubRep[] }) {
  const totals = useMemo(() => {
    const total = subReps.reduce(
      (sum, r) => sum + (r.commissionEarned * (r.overridePercent / 100)),
      0,
    );
    return { total, count: subReps.length };
  }, [subReps]);

  if (subReps.length === 0) return null;

  return (
    <section className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
        Team Earnings — This Period
      </p>
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[28px] font-bold text-[var(--navy)] leading-none">
            {formatAmount(totals.total)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text3)]">
            Your override from {totals.count} sub-rep{totals.count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[var(--text3)]">
            <tr>
              <th className="px-4 py-2 text-left">Sub-Rep</th>
              <th className="px-4 py-2 text-right">Their Commission</th>
              <th className="px-4 py-2 text-right">Override %</th>
              <th className="px-4 py-2 text-right">Your Override $</th>
            </tr>
          </thead>
          <tbody>
            {subReps.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--navy)]">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(r.commissionEarned)}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{r.overridePercent}%</td>
                <td className="px-4 py-2 text-right font-medium text-[var(--navy)]">
                  {formatAmount(r.commissionEarned * (r.overridePercent / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update `commissions/page.tsx`**

Open the file. Do the following:

1. Add imports at the top:

```typescript
import { isAdmin } from "@/utils/helpers/role";
import { getMySubReps } from "@/app/(dashboard)/dashboard/my-team/(services)/actions";
import TeamEarnings from "./(sections)/TeamEarnings";
import { redirect } from "next/navigation";
```

2. Inside the page function, AFTER getting `role`, add:

```typescript
if (isAdmin(role)) redirect("/dashboard/my-team");
```

3. Fetch sub-reps for the rep and pass to `TeamEarnings`. Alongside the existing data fetches, add:

```typescript
const subReps = await getMySubReps();
```

4. Remove any JSX rendering `<RateManagement ... />` and `<CommissionCalculator ... />` from the returned JSX. The remaining page should still render `<CommissionLedger />`, `<PayoutTable />`, plus the new `<TeamEarnings subReps={subReps} />` at the top.

**If the existing page.tsx has a different structure, adapt these changes to match its conventions — do not refactor anything unrelated.**

- [ ] **Step 3: Verify**

Run `npm run build 2>&1 | tail -20` → success.

---

## Task 15: Hide Commissions entry in Sidebar for admins

**Files:**
- Modify: `app/(dashboard)/dashboard/(sections)/Sidebar.tsx`

- [ ] **Step 1: Find the Commissions sidebar item**

Search for `"Commissions"` or `/dashboard/commissions` in the file.

- [ ] **Step 2: Update its `visible` predicate to exclude admins**

If it currently looks like:

```typescript
{
  label: "Commissions",
  href: "/dashboard/commissions",
  visible: (role) => isAdmin(role) || isSalesRep(role),
  ...
}
```

Replace the `visible` line with:

```typescript
  visible: (role) => isSalesRep(role),
```

Leave the `label`, `href`, `icon` unchanged.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit 2>&1 | tail -5` → zero errors.

---

## Task 16: Full build + browser spot-check

- [ ] **Step 1: Run production build**

```bash
npm run build 2>&1 | tail -20
```

Expected: standard `Route (app)` table, zero errors.

- [ ] **Step 2: Spot-check as admin**

Start `npm run dev`. Log in as admin.

1. Sidebar should **not** show "Commissions".
2. Visit `/dashboard/commissions` directly — should redirect to `/dashboard/my-team`.
3. `/dashboard/my-team` shows a **hierarchy tree** of all sales reps. Expand/collapse works.
4. Click any rep → `/dashboard/my-team/[repId]` loads with hero, KPI row (no "Your Override Earned" card), rate section, calculator, accounts, commission history (no "Your Override" column).

- [ ] **Step 3: Spot-check as sales rep**

Log out, log in as a sales rep with sub-reps.

1. Sidebar still shows "Commissions".
2. `/dashboard/commissions` — no rate management UI, no calculator; shows `TeamEarnings` at top + existing ledger/payout tables.
3. `/dashboard/my-team` — sub-rep cards are clickable, show 4-cell stats including Commission $, show "Your override: N%" above the stats.
4. Click a sub-rep → detail page loads with all six sections including KPI "Your Override Earned" card and commission history "Your Override" column.
5. Try visiting `/dashboard/my-team/<someone-else's-rep-id>` → hard 404.
