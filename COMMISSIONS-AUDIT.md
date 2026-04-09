# Commissions Feature — Full Audit Report
**Date:** 2026-04-09  
**Auditor:** Claude Code  
**Scope:** All files under `commissions/`, related webhook handlers, utils, and store.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 3 |
| Medium   | 6 |
| Low      | 7 |

The feature is structurally sound but has one **critical functional bug**: commission calculation assigns commissions to the wrong user. There are also three high-severity issues covering the KPI query (already fixed), an unworkable "Generate Payout" button, and a stale `useState` initialization in the calculator. All other issues are medium/low.

---

## Section 1 — Business Logic Audit

### Flow (a): Admin sets rate → `commission_rates` row created
**Status: ✅ Correct**  
`setCommissionRate` closes existing active rate (`effective_to = today`) before inserting new. Auth guard present. Zod validation on all three fields.

### Flow (b): Rep sets rate on sub-rep → hierarchy verified
**Status: ✅ Application-level correct; ⚠️ DB-level not enforced**  
Application code checks `rep_hierarchy` before allowing the insert. However, the RLS policy `rep_manage_sub_rep_rates` only checks `set_by = auth.uid()` — a rep who bypassed the application layer (e.g., direct API call) could set rates for any rep, not just sub-reps. See Medium finding #3.

### Flow (c): Order paid → `calculateOrderCommission` → commission created
**Status: ❌ Critical bug — wrong user receives commission**  
See Critical finding #1. The function reads `facility.user_id` (clinic owner) instead of `facility.assigned_rep` (sales rep). In production where clinical providers own facilities, no commission rate will be found and the commission is silently skipped.

### Flow (d): Parent rep in hierarchy → override commission created
**Status: ✅ Correct (when flow (c) succeeds)**  
Parent lookup via `rep_hierarchy`, parent rate fetched, override inserted. Failure is non-fatal to the direct commission.

### Flow (e): Admin approves → payout generated → marked paid
**Status: ⚠️ Payout generation is broken in the UI**  
See High finding #2. The "Generate Payout" button passes `repId = ""`. The approval flow itself is correct.

### Flow (f): Rate change closes old rate first
**Status: ✅ Correct**  
Old rate closed with `effective_to = today` before new insert. Not atomic (two separate DB calls), but sequential. See Medium finding #5 for the atomicity note.

---

## Section 2 — Server Actions Audit

### `getCommissionRates()`
- **Auth:** `getCurrentUserOrThrow` ✅
- **Admin sees all:** ✅ (no rep filter when `isAdmin`)
- **Rep filter:** ✅ `set_by.eq.${user.id},rep_id.eq.${user.id}` — sees rates they set and rates set for them
- **Issue (Low #1):** `createAdminClient()` is called without `const adminClient = await createAdminClient()` but `createAdminClient` is synchronous so this is fine. Consistent with the rest of the file.

### `setCommissionRate()`
- **Auth:** `getCurrentUserOrThrow` + role check ✅
- **Zod validation:** ✅ `setCommissionRateSchema`
- **Hierarchy check:** ✅ for non-admins
- **Closes old rate:** ✅
- **`revalidatePath`:** ✅
- **Issue (Medium #4):** On success, no Redux dispatch of `addRateToStore` — the UI rate table only updates on page refresh. The `useActionState` flow just closes the modal and toasts; it does not optimistically add the new rate to the store.

### `getCommissions()`
- **Auth:** `getCurrentUserOrThrow` ✅
- **Joins:** `order:orders!commissions_order_id_fkey(order_number)` and `rep:profiles!commissions_rep_id_fkey(first_name, last_name)` ✅
- **Admin sees all:** ✅ (no rep filter when `isAdmin`)
- **Period filter:** ✅ optional `period` param

### `calculateOrderCommission()`
- **Auth:** No explicit auth guard (called internally from webhook handler) ✅ — appropriate for server-only function
- **No assigned rep:** ✅ returns early with error message, non-blocking
- **No active rate:** ✅ returns early with error message, non-blocking
- **Idempotency:** ⚠️ See High finding #3 — not a pre-check, relies on DB unique constraint which causes a logged error on duplicate
- **Parent has no rate:** ✅ skips override commission gracefully
- **CRITICAL BUG:** ❌ See Critical finding #1

### `adjustCommission()`
- **Auth:** `requireAdminOrThrow` ✅
- **Validation:** ⚠️ No Zod schema — `adjustment` and `notes` are passed raw from client. Adjustment is a number (coerced by parseFloat in UI) but there is no server-side type enforcement. Negative values are silently allowed (Medium #6).
- **`revalidatePath`:** ✅

### `approveCommissions()`
- **Auth:** `requireAdminOrThrow` ✅
- **Bulk update:** ✅ uses `.in("id", commissionIds).eq("status", "pending")` — already-approved commissions silently no-op ✅
- **Empty array guard:** ✅ returns early
- **`revalidatePath`:** ✅

### `getPayouts()`
- **Auth:** `getCurrentUserOrThrow` ✅
- **Joins:** `rep:profiles!payouts_rep_id_fkey(first_name, last_name)` ✅
- **Rep filter:** ✅

### `generatePayout()`
- **Auth:** `requireAdminOrThrow` ✅
- **Sums only approved:** ✅ `.eq("status", "approved")`
- **Upsert logic:** ✅ `onConflict: "rep_id,period"` — unique index `payouts_rep_period_uidx` exists ✅
- **HIGH BUG #2:** `repId = ""` passed from UI — see High finding #2
- **Edge case (Medium #7):** No approved commissions → `totalAmount = 0` → upserts a $0 payout. No guard or error returned.

### `markPayoutPaid()`
- **Auth:** `requireAdminOrThrow` + `getCurrentUserOrThrow` ✅
- **Sets `paid_at` and `paid_by`:** ✅
- **Updates linked commissions:** ✅ `.eq("status", "approved")` filter
- **Issue (Medium #8):** Calling `markPayoutPaid` twice will run both DB updates again with `status = "paid"`. Since the commission filter is `.eq("status", "approved")`, the second call's commission update will match 0 rows (already paid). The payout update will still run (no guard like `.neq("status", "paid")`). Benign but wasteful.

### `getRepCommissionSummary()`
- **Status: FIXED** in previous session. Admin no longer filters by `user.id` when no `repId` provided.
- **Post-fix correctness:** ✅ Admin without `repId` → all commissions; admin with `repId` → filtered; rep → own only.
- **`currentRate` for admin:** Shows most recently set active rate by admin (`set_by = user.id`). If admin has never set a rate, returns `null` → KPI shows "—". This is reasonable.

---

## Section 3 — Edge Cases

| # | Edge Case | Handled? | Notes |
|---|-----------|----------|-------|
| a | No `assigned_rep` on facility | ⚠️ Partially | Returns early — but uses wrong field (`user_id` not `assigned_rep`), so this guard rarely fires when it should |
| b | No active rate for rep | ✅ | Returns `{ success: false }` non-blocking |
| c | Order already has commission (idempotency) | ⚠️ Partial | DB unique index blocks duplicate, but insert error is logged as failure rather than graceful no-op |
| d | Parent rep has no active rate | ✅ | Override skipped, direct commission still created |
| e | Rate set to 0% | ✅ | `commission_amount = 0`, record still created |
| f | Override set to 0% | ✅ | `overrideAmount = 0` — override commission is created but with $0. May be undesirable. |
| g | Negative adjustment | ⚠️ No guard | Server allows negative `adjustment`, `final_amount` can go negative. No validation. |
| h | Approve already-approved commission | ✅ | `.eq("status", "pending")` silently no-ops |
| i | Generate payout with no approved commissions | ⚠️ No guard | Creates a $0 payout instead of returning an error or warning |
| j | Mark payout paid twice | ✅ | Payout update runs again (benign). Commission update matches 0 rows (already paid). |
| k | Delete rep who has commissions | ✅ | `commissions.rep_id` FK is `ON DELETE CASCADE` — commissions deleted with rep. Same for `commission_rates.rep_id`. `payouts.rep_id` is also `CASCADE`. `commission_rates.set_by` is `SET NULL`. |
| l | Delete order that has commissions | ✅ | `commissions.order_id` FK is `ON DELETE CASCADE`. |
| m | Concurrent rate changes | ⚠️ Not atomic | Two separate DB calls (close old → insert new) with no transaction. Concurrent admins could result in both old rates being closed and one new rate winning. Very low probability. |
| n | Commission calculation during webhook timeout | ✅ | `calculateCommissionSafely` wraps in try/catch. Payment flow never blocked. |
| o | Rep with no sales views commission page | ✅ | Empty arrays and `summary.totalEarned = 0` — no errors, empty states shown. |

---

## Section 4 — Redux & UI Audit

### Store registration
`store/store.ts` line 33: `commissions: commissionsSlice` ✅

### `Providers.tsx` dispatches
All 4: `setRates`, `setCommissions`, `setPayouts`, `setSummary` dispatched on mount ✅

### KPI Cards (`page.tsx`)
Read from `summary` prop directly (server-rendered), not Redux:  
```tsx
<KpiCard label="Total Earned" value={formatAmount(summary.totalEarned)} />
```
✅ KPIs use the server-fetched `summary` directly, not Redux. The $0 bug was in `getRepCommissionSummary` (now fixed).

### `CommissionLedger.tsx`
- Reads `s.commissions.commissions` ✅
- Bulk approve: dispatches `updateCommissionInStore` for each approved ID ✅
- Adjust modal: dispatches `updateCommissionInStore` on success ✅
- Period filter: derived from data (`payoutPeriod` values) ✅
- CSV export: exports all visible columns ✅
- **Issue (High #3):** `selectedIds` checkbox state is not cleared after period filter changes — previously selected IDs from another period remain "selected" (invisible but counted in `pendingSelected`). Minor UX bug.

### `RateManagement.tsx`
- Uses `useActionState` correctly ✅
- **Issue (Medium #4):** On success, only shows toast and closes modal. Does not dispatch `addRateToStore`. New rate only appears after page refresh.

### `PayoutTable.tsx`
- Mark Paid: dispatches `updatePayoutInStore` ✅
- **Issue (High #2):** "Generate Payout" calls `handleGeneratePayout("", currentPeriod)` — empty `repId` will fail at DB level.

### `CommissionCalculator.tsx`
- **Issue (High #3, UI):** `useState(summary?.currentRate ?? 5)` — `summary` is `null` in Redux on first render (before `Providers.tsx` useEffect fires). The initial value is always `5`, even if `summary.currentRate` is a different value. After Redux hydrates, the component re-renders but `useState` does not reinitialize — `commRate` stays stuck at `5`.

---

## Section 5 — RLS Policy Audit

### `commission_rates`

| Policy | Type | Condition | Assessment |
|--------|------|-----------|------------|
| `admin_all_commission_rates` | ALL | `profiles.role = 'admin'` | ✅ Admin full CRUD |
| `rep_manage_sub_rep_rates` | ALL | `set_by = auth.uid() AND role = 'sales_representative'` | ⚠️ Allows write for any rep_id, not just sub-reps (Medium #3) |
| `rep_read_own_commission_rates` | SELECT | `rep_id = auth.uid() OR set_by = auth.uid()` | ✅ Rep reads own + set rates |

**Gap:** Other roles (clinical_provider, clinical_staff, support_staff) have no policy — correctly denied ✅

### `commissions`

| Policy | Type | Condition | Assessment |
|--------|------|-----------|------------|
| `admin_all_commissions` | ALL | `profiles.role = 'admin'` | ✅ |
| `rep_read_own_commissions` | SELECT | `rep_id = auth.uid()` | ✅ |

**Gap:** Rep has no INSERT/UPDATE/DELETE on `commissions` — ✅ correct, only the webhook (service role) and admin can write.

### `payouts`

| Policy | Type | Condition | Assessment |
|--------|------|-----------|------------|
| `admin_all_payouts` | ALL | `profiles.role = 'admin'` | ✅ |
| `rep_read_own_payouts` | SELECT | `rep_id = auth.uid()` | ✅ |

**Note:** All commission table mutations use `createAdminClient()` (service role, bypasses RLS). The RLS policies protect direct client-side access but are not the enforcement layer for server actions. ✅

---

## Section 6 — Webhook Integration Audit

| Check | Status |
|-------|--------|
| Called in `checkout.session.completed` | ✅ `handle-checkout-webhook.ts` line ~499 |
| Called in `checkout.session.async_payment_succeeded` | ✅ line ~526 |
| Called in `invoice.paid` | ✅ `handle-stripe-invoice-webhook.ts` after email hook |
| NOT called in `invoice.payment_succeeded` (avoid duplicates) | ✅ intentionally excluded |
| Wrapped in try/catch (non-blocking) | ✅ `calculateCommissionSafely` |
| Called AFTER `payment_status = 'paid'` confirmed | ✅ inside `!wasAlreadyPaid && didMarkPaid` guard |
| Idempotent (double webhook fire) | ⚠️ See Medium #1 — unique index blocks duplicate but logs error |
| `handlePaymentIntentSucceeded` path | ✅ delegates to `handleCheckoutSessionCompleted` which has the guard |

---

## Findings — Detailed

---

### 🔴 CRITICAL-1 — Wrong field used for rep lookup in commission calculation

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 243–253  
**Category:** Bug  
**Severity:** Critical

```typescript
.select("id, order_number, order_status, facilities!orders_facility_id_fkey(user_id)")
// ...
const repId: string | null = facility?.user_id ?? null;
```

`facilities.user_id` is the clinic account owner (typically a `clinical_provider`). The assigned sales rep is stored in `facilities.assigned_rep`. In production, orders placed by clinical providers will have `user_id = clinical_provider_id`, which has no commission rate. The calculation logs "No active commission rate for this rep" and returns without creating a commission. **Sales reps never receive commissions for clinic orders.**

The two existing test commission records (totaling $149) likely exist because the test facility's `user_id` happens to be a sales rep (rep created a facility for testing), making the coincidentally correct.

**Recommended fix:**
```typescript
.select("id, order_number, order_status, facilities!orders_facility_id_fkey(assigned_rep)")
// ...
const repId: string | null = facility?.assigned_rep ?? null;
```

---

### 🟠 HIGH-1 — KPI totals show $0 for admin (FIXED)

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 592 (original) — now fixed  
**Category:** Bug  
**Severity:** High (resolved)

`const targetRepId = isAdmin(role) && repId ? repId : user.id` — when admin provides no `repId`, condition short-circuits to `user.id`. Admin has no commission records → $0 totals. Fixed in previous session: admin without `repId` now queries all commissions; admin `currentRate` now queries by `set_by` instead of `rep_id`.

---

### 🟠 HIGH-2 — Generate Payout button passes empty `repId`

**File:** `app/(dashboard)/dashboard/commissions/(sections)/PayoutTable.tsx`  
**Line:** 92  
**Category:** Bug  
**Severity:** High

```typescript
onClick={() => handleGeneratePayout("", currentPeriod)}
```

`repId = ""` is passed to `generatePayout`. In the action, `.eq("rep_id", "")` matches no commissions → `totalAmount = 0`. The upsert then attempts `{ rep_id: "", period, ... }` which violates the FK constraint on `payouts.rep_id → profiles.id`. The button is non-functional for all users.

**Recommended fix:** The "Generate Payout" button should either (a) require a rep to be selected first, or (b) iterate all reps with approved commissions in the current period and generate one payout per rep. Option (a) is simpler.

---

### 🟠 HIGH-3 — `CommissionCalculator` rate slider always initializes to 5%

**File:** `app/(dashboard)/dashboard/commissions/(sections)/CommissionCalculator.tsx`  
**Line:** 17–19  
**Category:** Bug  
**Severity:** High

```typescript
const summary = useAppSelector((s) => s.commissions.summary);
const initialRate = summary?.currentRate ?? 5;
const [commRate, setCommRate] = useState(initialRate);
```

`summary` is `null` at first render (Redux `initialState`). `Providers.tsx` dispatches `setSummary` only in `useEffect`, which fires *after* the first render. So `useState(null?.currentRate ?? 5)` → `useState(5)`. When Redux hydrates and `summary` becomes available, the component re-renders but `useState` does not reinitialize — `commRate` remains `5` regardless of the actual commission rate.

**Recommended fix:**
```typescript
const [commRate, setCommRate] = useState(() => summary?.currentRate ?? 5);
useEffect(() => {
  if (summary?.currentRate != null) setCommRate(summary.currentRate);
}, [summary?.currentRate]);
```

---

### 🟡 MEDIUM-1 — `calculateOrderCommission` not idempotent (logged error on duplicate)

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 287–306  
**Category:** Edge case  
**Severity:** Medium

No pre-check for existing commissions. If called twice for the same order (e.g., webhook retry), the unique index `commissions_order_rep_type_uidx (order_id, rep_id, type)` blocks the second insert, but the code logs `"[calculateOrderCommission] Insert error: ..."` — a misleading error for expected behavior. The `calculateCommissionSafely` wrapper prevents payment from being blocked.

**Recommended fix:** Add idempotency check before insert:
```typescript
const { data: existing } = await adminClient
  .from(COMMISSION_TABLE)
  .select("id")
  .eq("order_id", orderId)
  .eq("rep_id", repId)
  .maybeSingle();
if (existing) return { success: true }; // Already calculated
```

---

### 🟡 MEDIUM-2 — `calculateOrderCommission` has no guard against missing `total_amount` on items

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 267  
**Category:** Edge case  
**Severity:** Medium

```typescript
const orderAmount = (items ?? []).reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);
```

`order_items.total_amount` is a generated column (computed from `unit_price * quantity + shipping + tax`). If items array is empty or all items have `total_amount = null`, `orderAmount = 0`. A $0 commission record is inserted without warning. This is arguably correct behavior but should be logged.

---

### 🟡 MEDIUM-3 — RLS `rep_manage_sub_rep_rates` doesn't enforce hierarchy at DB level

**File:** Supabase RLS policy  
**Table:** `commission_rates`  
**Category:** RLS issue  
**Severity:** Medium

Policy: `(set_by = auth.uid()) AND (role = 'sales_representative')`

A rep who bypasses the Next.js application layer (direct PostgREST API call) can insert a rate for any `rep_id`, not just their sub-reps. The hierarchy check only exists in `setCommissionRate` server action. For complete enforcement, the policy should also join `rep_hierarchy`:

```sql
(set_by = auth.uid()) AND (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_representative')
) AND (
  EXISTS (SELECT 1 FROM rep_hierarchy WHERE parent_rep_id = auth.uid() AND child_rep_id = rep_id)
)
```

---

### 🟡 MEDIUM-4 — `setCommissionRate` success doesn't update Redux store

**File:** `app/(dashboard)/dashboard/commissions/(sections)/RateManagement.tsx`  
**Line:** 34–42  
**Category:** UI issue  
**Severity:** Medium

On success, the action just closes the modal and shows a toast. The new rate row is not added to Redux (`addRateToStore` is never dispatched). The rates table remains stale until page refresh.

**Recommended fix:** After `state.success`, fetch the new rate from DB or dispatch `addRateToStore` with the newly created rate data. However, `useActionState` doesn't return the created record — the action would need to return it, or `revalidatePath` would need to trigger a full data refresh.

---

### 🟡 MEDIUM-5 — Rate closing and new rate insert are not atomic

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 140–161  
**Category:** Edge case  
**Severity:** Medium

Two sequential DB calls without a transaction:
1. `UPDATE commission_rates SET effective_to = today WHERE rep_id = X AND effective_to IS NULL`
2. `INSERT INTO commission_rates (...)`

If step 2 fails (e.g., validation error, network timeout), step 1 has already run — the old rate is closed with no active rate for the rep. Commissions can no longer be calculated until a new rate is set.

**Recommended fix:** Use a DB transaction (Supabase supports RPC transactions) or reverse the order (insert new first, then close old on success).

---

### 🟡 MEDIUM-6 — `adjustCommission` has no server-side type validation

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 363–389  
**Category:** Missing validation  
**Severity:** Medium

```typescript
export async function adjustCommission(commissionId: string, adjustment: number, notes: string)
```

`adjustment` is typed as `number` in TypeScript but arrives from the client as a `parseFloat(adjValue)` result. No Zod schema validates it server-side. A crafted request could pass `NaN`, `Infinity`, or an extremely large negative number. `final_amount` would become corrupted.

**Recommended fix:** Add validation:
```typescript
if (!isFinite(adjustment)) return { success: false, error: "Invalid adjustment value." };
```

---

### 🟡 MEDIUM-7 — `generatePayout` creates $0 payout when no approved commissions

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 498–508  
**Category:** Edge case  
**Severity:** Medium

If called with no approved commissions in the period, `totalAmount = 0`. A payout record with `total_amount = 0` and `status = "draft"` is created (or the existing one is updated to $0). No error or warning returned. This creates meaningless payout records.

**Recommended fix:** Return early if `totalAmount === 0`:
```typescript
if (totalAmount === 0) return { success: false, error: "No approved commissions found for this rep and period." };
```

---

### 🟡 MEDIUM-8 — `selectedIds` not cleared on period filter change in `CommissionLedger`

**File:** `app/(dashboard)/dashboard/commissions/(sections)/CommissionLedger.tsx`  
**Line:** 68, 81–83  
**Category:** UI issue  
**Severity:** Medium

`selectedIds` (the checkbox Set) is not reset when `selectedPeriod` changes. If a user selects commissions in period "2026-03", then switches to "2026-04", the previously selected IDs from "2026-03" remain in `selectedIds`. The "Approve (N)" button count would include invisible selections. Approving would silently approve the hidden period's commissions.

**Recommended fix:** Reset `selectedIds` when `selectedPeriod` changes:
```typescript
function handlePeriodChange(period: string) {
  setSelectedPeriod(period);
  setSelectedIds(new Set());
}
```

---

### 🔵 LOW-1 — `getCommissionRates()` result sorted twice (redundantly)

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 62, 80  
**Category:** Code quality  
**Severity:** Low

Query uses `.order("created_at", { ascending: false })` and then the mapped result is `.sort((a, b) => a.repName.localeCompare(b.repName))`. Two sorts on every call. Minor — not a bug.

---

### 🔵 LOW-2 — `calculateOrderCommission` assumes the order's facility is not an array

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 252  
**Category:** Code quality  
**Severity:** Low

```typescript
const facility = Array.isArray(order.facilities) ? order.facilities[0] : order.facilities;
```

PostgREST returns a single object for `!inner` FK joins, not an array. The `Array.isArray` guard is defensive but unnecessary. Not a bug.

---

### 🔵 LOW-3 — `CommissionCalculator` rate slider min is 1%, but 0% is a valid rate

**File:** `app/(dashboard)/dashboard/commissions/(sections)/CommissionCalculator.tsx`  
**Line:** 67  
**Category:** UI inconsistency  
**Severity:** Low

The slider `min={1}` prevents simulating a 0% commission in the calculator, but `commission_rates.rate_percent` allows 0. Users can't test the "no commission" scenario.

---

### 🔵 LOW-4 — `markPayoutPaid` runs payout update even if already paid

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 551–558  
**Category:** Edge case  
**Severity:** Low

No guard: `.neq("status", "paid")`. Calling twice re-updates `paid_at` to the current timestamp. Functionally benign but could cause confusion in audit logs.

---

### 🔵 LOW-5 — `console.log` left in `getRepCommissionSummary` after debug

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** ~648 (post-fix)  
**Category:** Code quality  
**Severity:** Low

Debug `console.log("[getRepCommissionSummary] adminMode:", ...)` was intentionally added during the $0 bug investigation. Should be removed or converted to `console.info` once the fix is confirmed working.

---

### 🔵 LOW-6 — `generatePayout` doesn't return the created payout for optimistic Redux update

**File:** `app/(dashboard)/dashboard/commissions/(sections)/PayoutTable.tsx`  
**Line:** 66–75  
**Category:** UI issue  
**Severity:** Low

After successful `generatePayout`, the code just shows a toast. The new payout doesn't appear in the table until page refresh. There is no `addPayoutToStore` reducer in the slice. (Compare: `markPayoutPaid` uses `updatePayoutInStore` for optimistic update.)

---

### 🔵 LOW-7 — No `ORDER BY` idempotency check on `order_id` in `calculateOrderCommission`

**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`  
**Line:** 287  
**Category:** Code quality  
**Severity:** Low

If both `checkout.session.completed` AND `payment_intent.succeeded` fire at the same millisecond, the unique index prevents double-insert but both attempts hit the DB. The `!wasAlreadyPaid && didMarkPaid` guard in the checkout handler prevents the second webhook from even reaching `calculateCommissionSafely`, so in practice this race is not possible. Still, an explicit idempotency check (Medium #1 above) would make the intent clearer.

---

## Appendix — Files Audited

| File | Status |
|------|--------|
| `commissions/(services)/actions.ts` | Audited — 1 critical, 3 medium |
| `commissions/(sections)/CommissionCalculator.tsx` | Audited — 1 high |
| `commissions/(sections)/CommissionLedger.tsx` | Audited — 1 medium |
| `commissions/(sections)/PayoutTable.tsx` | Audited — 1 high |
| `commissions/(sections)/RateManagement.tsx` | Audited — 1 medium |
| `commissions/(sections)/Providers.tsx` | Audited — clean |
| `commissions/(redux)/commissions-slice.ts` | Audited — clean |
| `commissions/(redux)/commissions-state.ts` | Audited — clean |
| `commissions/page.tsx` | Audited — clean |
| `utils/interfaces/commissions.ts` | Audited — clean |
| `utils/constants/commissions.ts` | Audited — clean |
| `utils/validators/commissions.ts` | Audited — clean |
| `store/store.ts` | Audited — `commissions` slice registered ✅ |
| `lib/stripe/payments/handle-checkout-webhook.ts` | Audited — clean |
| `lib/stripe/invoices/handle-stripe-invoice-webhook.ts` | Audited — clean |
| `commission_rates` RLS policies | Audited — 1 medium gap |
| `commissions` RLS policies | Audited — clean |
| `payouts` RLS policies | Audited — clean |
| DB FK constraints | Audited — CASCADE correct on all FK refs |
| DB unique indexes | Audited — `commissions_order_rep_type_uidx` ✅, `payouts_rep_period_uidx` ✅ |
