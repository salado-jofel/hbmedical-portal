# HB Medical Portal — Security & Performance Audit Report

> Generated: 2026-04-08  
> Scope: Full frontend codebase — `app/`, `lib/`, `utils/`, `store/`, `middleware.ts`  
> Method: Static analysis via parallel codebase exploration agents  
> **No code was changed during this audit.**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Severity](#critical-severity)
3. [High Severity](#high-severity)
4. [Medium Severity](#medium-severity)
5. [Low Severity](#low-severity)
6. [Clean Areas](#clean-areas)

---

## Executive Summary

| Severity | Security | Performance | Total |
|----------|----------|-------------|-------|
| Critical | 0 | 0 | 0 |
| High | 5 | 0 | 5 |
| Medium | 5 | 2 | 7 |
| Low | 1 | 10 | 11 |
| **Total** | **11** | **12** | **23** |

**Overall posture:** The codebase has strong foundational security — server actions consistently use auth guards, no secrets are hardcoded, file uploads in the material libraries are properly validated, and the Stripe webhook correctly verifies signatures. The most urgent issues are authorization gaps on two unauthenticated API routes and missing ownership checks in three shared service actions.

---

## Critical Severity

*No critical findings.*

---

## High Severity

### H1 — API route `/api/ai/extract-document` has no authentication or authorization check

- **File:** `app/api/ai/extract-document/route.ts`
- **Category:** Security
- **Severity:** high
- **Issue:** The POST handler accepts arbitrary `orderId`, `filePath`, and `bucket` from the request body and immediately uses `createAdminClient()` — which bypasses all RLS — without verifying who the caller is or whether they have access to the referenced order. Any authenticated user (or an unauthenticated user if the route lacks session enforcement) can trigger AI extraction on any order in the system.
- **Fix:** Add `getCurrentUserOrThrow(supabase)` at the top of the handler. Then verify the caller has facility-level access to the order: fetch `orders.facility_id` for the given `orderId`, and confirm it matches the caller's facility (or that the caller is admin/support). Reject with 403 otherwise.
- **Risk of fix:** Low. Only restricts the route to users who already have legitimate order access, which is the intended behavior.

---

### H2 — API route `/api/generate-pdf` has no authentication or authorization check

- **File:** `app/api/generate-pdf/route.tsx`
- **Category:** Security
- **Severity:** high
- **Issue:** Same pattern as H1. The POST handler accepts `orderId` from the request body and uses `createAdminClient()` to fetch and render order data without any auth or ownership check. Any caller can generate PDFs (IVR, HCFA-1500) for any order.
- **Fix:** Same fix as H1 — add `getCurrentUserOrThrow`, verify facility access, reject with 403 on mismatch.
- **Risk of fix:** Low. PDF generation is only meaningful to the order's facility or to admin/support; restricting it is correct.

---

### H3 — `getDocumentSignedUrl()` generates signed URLs without verifying caller has access to the order

- **File:** `app/(dashboard)/dashboard/orders/(services)/order-document-actions.ts`
- **Category:** Security
- **Severity:** high
- **Issue:** `getDocumentSignedUrl(filePath)` accepts any storage path string and returns a signed download URL from the private bucket using `createAdminClient()`. There is no check that the authenticated user owns or has access to the order that the document belongs to. An authenticated user who knows or can guess a file path can download any patient document.
- **Fix:** Before generating the signed URL, extract the `orderId` from the file path (path format: `order-documents/{orderId}/...`), query `orders` for that order's `facility_id`, and verify the caller is the facility owner or is admin/support. If verification fails, return `{ url: null, error: "Unauthorized." }`.
- **Risk of fix:** Low. The function already returns a nullable url; adding a 403-equivalent path is safe.

---

### H4 — `updateMemberRole()` and `removeFacilityMember()` have no ownership verification

- **File:** `app/(dashboard)/dashboard/(services)/facility-members/actions.ts`
- **Category:** Security
- **Severity:** high
- **Issue:** Both `updateMemberRole()` and `removeFacilityMember()` call `getCurrentUserOrThrow` (confirming the user is authenticated) but never verify that the caller is authorized to manage the target facility. Any authenticated user who knows a `facility_members` record ID can change another clinic's member roles or evict members from facilities they don't belong to.
- **Fix:** After fetching the caller's identity, look up the `facility_members` record to get its `facility_id`, then confirm the caller is either the facility owner (`facilities.user_id = caller.id`) or an admin. Reject with a thrown error otherwise.
- **Risk of fix:** Medium. Clinical providers currently call these functions to manage their own clinic members via the Settings page. The fix must preserve that path — confirm the caller's facility matches the member's facility before allowing the operation.

---

### H5 — `deleteInviteToken()` in shared service does not verify token ownership

- **File:** `app/(dashboard)/dashboard/(services)/invite-tokens/actions.ts`
- **Category:** Security
- **Severity:** high
- **Issue:** `deleteInviteToken(tokenId)` deletes the token record by ID without checking that `created_by = current user`. Any authenticated user who knows a token's UUID can delete invite tokens created by others, disrupting pending onboarding flows.
- **Fix:** Add `.eq("created_by", user.id)` to the delete query — or, if admin should be able to delete any token, add `if (!isAdmin(role)) { filter by created_by }`. Note: the onboarding-feature-specific wrapper in `onboarding/(services)/actions.ts` already applies this filter correctly; the shared service function is the gap.
- **Risk of fix:** Low. The fix only tightens ownership; it won't break the onboarding feature which already scopes by caller.

---

## Medium Severity

### M1 — File uploads in `uploadOrderDocument` lack server-side MIME type and size validation

- **File:** `app/(dashboard)/dashboard/orders/(services)/order-document-actions.ts`
- **Category:** Security
- **Severity:** medium
- **Issue:** The `accept` filter (`.pdf,.jpg,.jpeg,.png,.heic`) and the 10 MB size cap are enforced only in `CreateOrderModal` on the client. The server action itself does not re-validate the MIME type or file size before writing to storage. A client bypassing the UI can upload executables, scripts, or oversized files disguised as PDFs.
- **Fix:** In the server action, before the storage upload:
  ```ts
  const ALLOWED_TYPES = ['application/pdf','image/jpeg','image/png','image/heic'];
  const ALLOWED_EXTS  = ['pdf','jpg','jpeg','png','heic'];
  const MAX_BYTES     = 10 * 1024 * 1024;

  if (!ALLOWED_TYPES.includes(file.type)) return { success: false, error: "Invalid file type." };
  if (!ALLOWED_EXTS.includes(ext)) return { success: false, error: "Invalid extension." };
  if (file.size > MAX_BYTES) return { success: false, error: "File exceeds 10 MB." };
  ```
- **Risk of fix:** Low. Adds server-side enforcement that mirrors what the UI already requires.

---

### M2 — PIN verification (`signOrder`) has no rate limiting — susceptible to brute-force

- **File:** `app/(dashboard)/dashboard/orders/(services)/order-workflow-actions.ts`
- **Category:** Security
- **Severity:** medium
- **Issue:** `signOrder(orderId, pin)` calls the `verify_pin` RPC on every attempt with no throttling, lockout, or attempt counter. An attacker with a valid `clinical_provider` session and a target `orderId` could brute-force the 4-digit PIN (10,000 combinations) in seconds.
- **Fix:** Track failed attempts per `(user_id, order_id)` in a Redis cache or a lightweight DB table. Lock out after 5 consecutive failures for 15 minutes. Alternatively, use Upstash Rate Limit or a Next.js middleware rate limiter on the action. At a minimum, add a short `await sleep(200)` to slow enumeration.
- **Risk of fix:** Medium. Requires introducing a rate-limiting mechanism; incorrect implementation could lock out legitimate providers. Test thoroughly.

---

### M3 — Cron routes allow unauthenticated requests in non-production environments

- **File:** `app/api/cron/net-30-reminders/route.ts`, `app/api/cron/task-reminders/route.ts`
- **Category:** Security
- **Severity:** medium
- **Issue:** Both cron handlers include logic equivalent to: `if (!cronSecret) return process.env.NODE_ENV !== "production"` — meaning if `CRON_SECRET` is not configured, all requests are accepted in any non-production environment. If a staging or preview deployment is publicly accessible without `CRON_SECRET` set, anyone can trigger invoice reminders and task reminder emails at will.
- **Fix:** Remove the environment-based bypass. Require `CRON_SECRET` unconditionally, and document that it must be set in all deployed environments. For local dev, set a dummy value in `.env.local`.
- **Risk of fix:** Low. Only affects unauthenticated triggering of background jobs; no data is mutated in a harmful way by these jobs, but spamming reminder emails is a real concern.

---

### M4 — `console.log(formData)` in invite signup action logs passwords and PINs

- **File:** `app/(auth)/invite/[token]/signup/(services)/actions.ts` (line ~36)
- **Category:** Security
- **Severity:** medium
- **Issue:** A `console.log("[inviteSignUp] formData:", Object.fromEntries(formData))` statement logs the entire form submission, which includes the user's plaintext password, NPI, and 4-digit PIN. These appear in server logs (Vercel function logs, etc.) which may be accessible to multiple team members and are retained for extended periods.
- **Fix:** Remove the log line entirely, or gate it: `if (process.env.NODE_ENV === "development") { ... }`. Never log FormData that contains passwords or credentials.
- **Risk of fix:** None. Removing a debug log has zero functional impact.

---

### M5 — Middleware executes `getUserData()` (a DB query) on every request

- **File:** `middleware.ts` (line ~33)
- **Category:** Performance
- **Severity:** medium
- **Issue:** The middleware imports and calls `getUserData()` — which performs a Supabase profile query — on every request that passes the matcher. Even with the static-asset exclusion in the matcher config, this runs on every page navigation and API call, adding a round-trip database query to each. At scale this increases both latency and Supabase read usage linearly with traffic.
- **Fix:** Evaluate whether `getUserData()` is actually needed in middleware. If its only use is role-based redirects, the user's role can be stored in a lightweight JWT claim or a short-lived cookie after login (Supabase supports custom JWT claims). Alternatively, scope the middleware to only the routes that need the role check rather than all dashboard routes.
- **Risk of fix:** Medium. Restructuring middleware session/role handling touches auth flow; requires careful testing of all redirect paths.

---

### M6 — Sequential `await` calls in `orders/page.tsx` where parallelism is possible

- **File:** `app/(dashboard)/dashboard/orders/page.tsx` (lines ~34–40)
- **Category:** Performance
- **Severity:** medium
- **Issue:** The page calls `getUserRole()` and then `getOrders()` in separate sequential `await` statements. The role fetch and the orders fetch are independent and could run in parallel, reducing TTFB.
- **Fix:**
  ```ts
  const supabase = await createClient();
  const [role, orders] = await Promise.all([
    getUserRole(supabase),
    getOrders(),
  ]);
  ```
- **Risk of fix:** Very low. Pure parallelization; no logic change.

---

### M7 — Sequential `await` calls in `sign-in` action

- **File:** `app/(auth)/sign-in/(services)/actions.ts` (lines ~26–35)
- **Category:** Performance
- **Severity:** medium
- **Issue:** After `signInWithPassword`, the action makes three sequential Supabase calls: `getUser()`, then `select("status")`, then a conditional `update()`. The status check and update could be combined into a single conditional upsert or the first two queries merged.
- **Fix:** Combine the profile fetch and update into a single operation, or at minimum verify the structure allows parallelizing the profile read with any post-login work.
- **Risk of fix:** Low. Sign-in is infrequent; the latency impact is minimal but the pattern improvement is worth making.

---

## Low Severity

### L1 — Missing `loading.tsx` in six feature folders

- **Category:** Performance
- **Severity:** low
- **Issue:** The following feature pages have no `loading.tsx` skeleton, so Next.js will show a blank white screen during server-side data fetching instead of a streaming skeleton:
  - `app/(dashboard)/dashboard/accounts/`
  - `app/(dashboard)/dashboard/accounts/[id]/`
  - `app/(dashboard)/dashboard/users/`
  - `app/(dashboard)/dashboard/tasks/`
  - `app/(dashboard)/dashboard/onboarding/`
  - `app/(dashboard)/dashboard/settings/`
- **Fix:** Add a `loading.tsx` to each folder returning a skeleton layout that approximates the page structure (cards, table rows, header). The existing `products/loading.tsx` and material library `loading.tsx` files can serve as templates.
- **Risk of fix:** None. Loading skeletons are purely additive.

---

### L2 — `select("*")` in multiple order service files

- **Files:**
  - `app/(dashboard)/dashboard/orders/(services)/order-read-actions.ts` — `getOrderDocuments()`, `getNotifications()`, `getUnreadNotificationCount()`
  - `app/(dashboard)/dashboard/orders/(services)/order-payment-actions.ts` — `getOrderPayment()`, `getOrderInvoice()`
  - `app/(dashboard)/dashboard/orders/(services)/order-misc-actions.ts` — `getPatients()`, `getUserFacility()`
  - `app/(dashboard)/dashboard/orders/(services)/order-ivr-actions.ts` — `getOrderIVR()`, `getOrderAiStatus()`
  - `app/(dashboard)/dashboard/orders/(services)/order-document-actions.ts` — `getForm1500()`
- **Category:** Performance
- **Severity:** low
- **Issue:** These queries fetch all columns (`select("*")`) when the consuming code only uses a subset of fields. This transfers unnecessary data over the network from Supabase on every call.
- **Fix:** Replace each `select("*")` with an explicit column list matching what the mapper function or component actually uses. For example, `getOrderDocuments()` only needs `id, order_id, document_type, bucket, file_path, file_name, mime_type, file_size, uploaded_by, created_at`.
- **Risk of fix:** Low. If a column is added to a mapper later, the select must also be updated — this is expected maintenance. No runtime breakage from narrowing.

---

### L3 — `select("*")` in provider-credentials shared action

- **File:** `app/(dashboard)/dashboard/(services)/provider-credentials/actions.ts` (line ~30)
- **Category:** Performance
- **Severity:** low
- **Issue:** `getMyCredentials()` uses `select("*")` on `provider_credentials`. The table includes `pin_hash` — this column is fetched and returned to the client component unnecessarily. The hash should never leave the server.
- **Fix:** Explicitly exclude `pin_hash` from the select: `.select("user_id, credential, npi_number, ptan_number, medical_license_number, updated_at")`. The hash is only needed for server-side PIN verification via the `verify_pin` RPC.
- **Risk of fix:** Low. The credential form does not display or use `pin_hash`; removing it from the fetch is safe.

---

### L4 — `select("*")` leaks `pin_hash` concern aside, in onboarding `resendInviteEmail`

- **File:** `app/(dashboard)/dashboard/onboarding/(services)/actions.ts` (line ~912)
- **Category:** Performance
- **Severity:** low
- **Issue:** `resendInviteEmail()` fetches the full token row with `select("*")` when it only needs `id`, `token`, `invited_email`, `expires_at`, `used_at`.
- **Fix:** Replace with `.select("id, token, invited_email, expires_at, used_at, created_by")`.
- **Risk of fix:** None.

---

### L5 — Unnecessary `await` on synchronous `createClient()` in client-upload utility

- **File:** `app/(dashboard)/dashboard/marketing/(services)/client-upload.ts` (line ~30)
- **Category:** Performance
- **Severity:** low
- **Issue:** `createClient()` (the browser-side Supabase client) is a synchronous factory function. Awaiting it is harmless but misleading — it implies async behavior and may confuse future developers.
- **Fix:** Remove the `await` from `const supabase = await createClient()` → `const supabase = createClient()`.
- **Risk of fix:** None.

---

## Clean Areas

The following areas passed all checks with no findings:

**Security — fully clean:**
- All `products/` server actions — `requireAdminOrThrow` on every write; specific column selection.
- All material library server actions (`contracts/`, `marketing/`, `trainings/`, `hospital-onboarding/`) — proper admin guards, file type validation, filename sanitization, specific column selects.
- `users/(services)/actions.ts` — admin-only with correct cascade delete logic and self-delete guard.
- `tasks/(services)/actions.ts` — `requireAdminOrThrow` on all mutations.
- `accounts/(services)/actions.ts` — role-scoped reads with rep isolation; admin-only writes.
- `(services)/contacts/actions.ts` — rep ownership verification on write.
- `(services)/activities/actions.ts` — `requireAdminOrThrow` on all mutations.
- `onboarding/(services)/actions.ts` — robust role-scoped invite logic; duplicate prevention.
- `settings/(services)/actions.ts` — correct delegation with role verification.
- `profile/(services)/actions.ts` — email/role never updated; RLS-scoped.
- `lib/supabase/auth.ts` — auth helpers are correct and consistent.
- `lib/supabase/middleware.ts` — session recovery, dashboard protection, setup guard all correctly implemented.
- `app/api/stripe/webhook/route.ts` — Stripe signature verified with `stripe.webhooks.constructEvent()`; idempotency enforced via `stripe_webhook_events`.
- Auth pages (`sign-in`, `set-password`, `reset-password`, `forgot-password`) — session handling, token removal from URL, and recovery flow are all correctly implemented.
- No `dangerouslySetInnerHTML` usage found anywhere in the codebase.
- No hardcoded API keys, tokens, or secrets found in any client-side or server-side file.
- No raw SQL string interpolation with user input found anywhere.

**Performance — fully clean:**
- Products, contracts, marketing, trainings, hospital-onboarding all have `loading.tsx` and `export const dynamic = "force-dynamic"`.
- `ProductsTable`, `ContractCards`, `MarketingCards`, `TrainingCards` all use `useMemo` for filtering/sorting.
- Redux selectors across all material slices read specific fields, not entire slices.
- No `<img>` tags found — all images use `next/image` or are not present.
- No N+1 query patterns detected in any server action.
- Redux store configuration is correct; `StoreProvider` uses `useRef` to prevent re-initialization.
- `OrdersKanban` already uses `useMemo` for all grouping and filtering computations.
