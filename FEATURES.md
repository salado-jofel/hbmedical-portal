# Meridian Portal — Feature Reference

> Complete audit of every feature in the frontend codebase.
> Generated: 2026-04-08. Read against actual source files before acting on specific line numbers or function signatures — this document is a point-in-time snapshot.

---

## Table of Contents

1. [Products](#1-products)
2. [Orders](#2-orders)
   - 2.1 [Order Workflow & Status Transitions](#21-order-workflow--status-transitions)
   - 2.2 [Order Detail Modal & Tabs](#22-order-detail-modal--tabs)
   - 2.3 [Payment Flow](#23-payment-flow)
   - 2.4 [Document Management](#24-document-management)
   - 2.5 [IVR / HCFA-1500 Forms](#25-ivr--hcfa-1500-forms)
   - 2.6 [Order Messaging](#26-order-messaging)
   - 2.7 [Shipping](#27-shipping)
   - 2.8 [Server Actions](#28-orders-server-actions)
3. [Accounts](#3-accounts)
   - 3.1 [Accounts List](#31-accounts-list)
   - 3.2 [Account Detail](#32-account-detail)
4. [Users](#4-users)
5. [Tasks](#5-tasks)
6. [Onboarding](#6-onboarding)
7. [Settings](#7-settings)
8. [Contracts](#8-contracts)
9. [Marketing](#9-marketing)
10. [Trainings](#10-trainings)
11. [Hospital Onboarding](#11-hospital-onboarding)
12. [Dashboard Home](#12-dashboard-home)
13. [Profile](#13-profile)
14. [Auth Flow](#14-auth-flow)
    - 14.1 [Sign In](#141-sign-in)
    - 14.2 [Sign Up (Public)](#142-sign-up-public)
    - 14.3 [Invite-Based Sign Up](#143-invite-based-sign-up)
    - 14.4 [Forgot Password / Password Reset](#144-forgot-password--password-reset)
    - 14.5 [Full User Lifecycle](#145-full-user-lifecycle)
15. [Shared Architecture](#15-shared-architecture)
    - 15.1 [Role System](#151-role-system)
    - 15.2 [Redux Store Layout](#152-redux-store-layout)
    - 15.3 [Shared Components](#153-shared-components)
    - 15.4 [Database Tables Reference](#154-database-tables-reference)
16. [Commissions](#16-commissions)

---

## 1. Products

### Purpose
Shared product catalog for Meridian. Admins manage products; all authenticated users can view them. Products are referenced by order line items (with name/SKU/price snapshotted at order time).

### User Roles

| Role | Access |
|------|--------|
| admin | Full CRUD — add, edit, delete, toggle active |
| sales_representative | Read-only |
| support_staff | Read-only |
| clinical_provider | Read-only |
| clinical_staff | Read-only |

### Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/products` | `products/page.tsx` | Product listing with search and inline editing |

### Business Logic
- Products have a `sort_order` (integer ≥ 0) controlling display order; secondary sort is by name.
- `is_active` flag soft-hides products from the order picker without deleting them.
- SKU must be unique (case-insensitive index in DB).
- `unit_price` must be ≥ 0.
- Deleting a product does **not** break order history — `order_items.product_id` is nullable; name/SKU/price are snapshotted at order time.

### Server Actions
**File:** `products/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getAllProducts()` | any authenticated | Fetches all products ordered by `sort_order`, then `name`. Returns `Product[]`. |
| `addProduct(formData)` | admin only | Validates via `createProductSchema` (sku, name, unit_price ≥ 0, sort_order ≥ 0). Inserts. Revalidates `/dashboard/products`. Returns created `Product`. |
| `editProduct(id, formData)` | admin only | Partial update via `updateProductSchema`; undefined fields filtered out. Revalidates path. |
| `deleteProduct(id)` | admin only | Hard delete from DB. Revalidates path. |

### Redux State
**Slice:** `products-slice.ts` — `ProductsState`

| Key | Type | Updated by |
|-----|------|-----------|
| `items` | `Product[]` | `setProducts`, `addProductToStore`, `updateProductInStore`, `removeProductFromStore` |
| `search` | `string` | `setSearch` |

### UI Behavior
- **Header:** Shows "Products" title + live count from Redux (`items.length`).
- **Search:** Filters by SKU, name, or category (client-side via `setSearch`).
- **Table (desktop):** Columns — SKU, Name, Category, Unit Price, Active/Inactive badge, Actions.
- **Card view (mobile):** `ProductCard.tsx` with inline edit support.
- **Inline editing:** Clicking Edit on a row/card replaces text with inputs (sku, name, category, unit_price, sort_order). Save disabled if required fields empty or price < 0.
- **Add product:** `AddProductModal` dialog — fields: SKU, Name, Category, Unit Price, Sort Order, Description, Is Active checkbox.
- **Delete:** Confirm modal before deletion; loading state on row during delete.
- **Empty state:** Shown when no products match search or catalog is empty.
- **Loading state:** `loading.tsx` skeleton on initial page load.

### Database Tables
- `products` (id, sku, name, description, category, unit_price, is_active, sort_order)
- RLS: any authenticated user can SELECT, INSERT, UPDATE, DELETE.

### Edge Cases
- Save button disabled until all required fields valid and price ≥ 0.
- `addProduct` returns the created product directly (not form state) — dispatched immediately to Redux.
- `editProduct` uses partial schema so only provided fields are written.

---

## 2. Orders

### Purpose
Core clinical workflow for Meridian. Clinic staff create wound-care orders; they go through a multi-step approval and fulfillment pipeline before being shipped to the patient. Supports two payment paths (Stripe checkout or Net-30 invoice).

### User Roles

| Role | Capabilities |
|------|-------------|
| clinical_staff | Create orders, view own facility orders, upload docs, submit for signature, recall, resubmit after info request, cancel draft orders |
| clinical_provider | All of clinical_staff + sign orders with PIN |
| admin | View all orders, approve/reject, request additional info, manage payment, mark shipped/delivered, full kanban + table view |
| support_staff | View all orders, approve/reject, request additional info, table view |
| sales_representative | View orders (table view) |

### Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/orders` | `orders/page.tsx` | Order list — kanban (clinic/admin) or table (rep/support) |

### 2.1 Order Workflow & Status Transitions

The `order_status` field drives the primary workflow. Additional status fields (`payment_status`, `fulfillment_status`, `delivery_status`, `invoice_status`) track orthogonal dimensions.

#### Primary Status Flow

```
draft
  │  submitForSignature() — clinical_staff or clinical_provider
  ▼
pending_signature
  │  signOrder(pin) — clinical_provider        ← recallOrder() → back to draft
  ▼
manufacturer_review
  │  approveOrder() — admin/support             ← requestAdditionalInfo(notes) → additional_info_needed
  ▼
approved
  │  setOrderPaymentMethod() + initiatePayment()
  ▼
(payment confirmed via Stripe webhook)
  │  markOrderShipped() — admin/support
  ▼
shipped
  │  markOrderDelivered() — admin/support
  ▼
delivered
```

```
additional_info_needed
  │  resubmitForReview() — clinic
  ▼
manufacturer_review
```

```
Any status (except shipped/delivered for clinic)
  │  cancelOrder()
  ▼
canceled (order_status = "canceled")
```

**Rules enforced in server actions:**
- `submitForSignature`: must be `draft`; requires at least one order item.
- `recallOrder`: must be `pending_signature`; clinic-side only.
- `signOrder`: must be `pending_signature`; clinical_provider only; verifies 4-digit PIN via `verify_pin` RPC.
- `approveOrder`: must be `manufacturer_review`; admin/support only.
- `requestAdditionalInfo`: must be `manufacturer_review`; admin/support only; stores notes on order.
- `resubmitForReview`: must be `additional_info_needed`; clinic-side only.
- `cancelOrder`: clinic can only cancel `draft`, `pending_signature`, `additional_info_needed`; admin/support can cancel any non-shipped/delivered.
- `deleteOrder`: draft only; clinic only; hard deletes order + items + history + messages + documents.

Every status transition inserts an `order_history` record and creates `notifications` for relevant roles/facility members (excluding the actor).

#### Kanban Column Mapping

| Column Label | Statuses Shown | Who Sees It |
|---|---|---|
| Draft | draft | clinic only |
| Pending Signature | pending_signature | clinic only |
| Manufacturer Review | manufacturer_review | all |
| Additional Info | additional_info_needed | all |
| Approved (Pending Payment) | approved + no payment_method | all |
| Approved (Processed) | approved + payment_method set | all |
| Shipped | shipped | all |
| Delivered | delivered | all |

### 2.2 Order Detail Modal & Tabs

**Component:** `OrderDetailModal.tsx`
Opened from kanban card click or `open-order-modal` custom event.

| Tab | Visible To | Description |
|-----|-----------|-------------|
| Overview | all | Order items table; add/remove products (draft only); notes field (draft only); admin info request notes display |
| Form | clinic + support | IVR clinical fields (chief_complaint, symptoms, wound_type, date_of_service, icd10_code, etc.) |
| Chat | all | Real-time messaging thread |
| Signature | clinical_provider | Sign order with 4-digit PIN (status = pending_signature only) |
| Approval | admin/support | Approve or request additional info (status = manufacturer_review) |
| Documents | all | Uploaded files — facesheet, clinical docs, wound pictures |
| HCFA-1500 | admin/support | CMS Form 1500 data view + PDF generation |
| IVR | all | IVR form view + PDF generation |
| History | all | Audit trail of status transitions with actor and timestamp |

**Tab visibility** depends on order status and user role — e.g., Signature tab only shown when `status = pending_signature` AND user `isClinicalProvider`.

**Realtime sync:** Modal subscribes to `orders` UPDATE events and patches Redux on changes. Also subscribes to `order_messages` INSERT to update unread counts.

**Payment return handling:** URL params `payment_success=true&order_id=X` (Stripe redirect back) trigger a success toast and auto-open the Orders modal to the affected order.

### 2.3 Payment Flow

**Triggered from:** Overview tab → set payment method → initiate payment.

#### Pay Now (Stripe Checkout)
1. `setOrderPaymentMethod(orderId, "pay_now")` — sets `payment_method` on order.
2. `initiatePayment(orderId, returnUrl)`:
   - Gets/creates Stripe customer from `facility.stripe_customer_id`.
   - Creates `checkout.session` with line items from `order_items`.
   - Inserts `payments` record (status=`pending`, type=`checkout`).
   - Returns checkout URL → browser redirect.
3. Stripe webhook (`checkout.session.completed`) → updates `payments.status = "paid"`, sets `orders.payment_status = "paid"`, `paid_at`.

#### Net-30 (Invoice)
1. `setOrderPaymentMethod(orderId, "net_30")`.
2. `initiatePayment(orderId, returnUrl)`:
   - Creates Stripe draft invoice + invoice items.
   - Finalizes invoice.
   - Inserts `invoices` record (status=`issued`).
   - Returns hosted invoice URL.
3. Stripe webhook (`invoice.paid`) → updates invoice and order payment status.

**Idempotency:** `stripe_webhook_events` table logs every processed Stripe event ID to prevent double-processing.

### 2.4 Document Management

**Upload during order creation (`CreateOrderModal`):**
- Step-based wizard uploads sequentially after order draft created.
- Document types: `facesheet` (required), `clinical_documentation` (optional, multiple), `wound_pictures` (required if `wound_type = "chronic"`).
- Max file size: 10 MB. Formats: PDF, JPG, JPEG, PNG, HEIC.
- Server action: `uploadOrderDocument(orderId, docType, formData)`.

**Viewing documents:** Documents tab in `OrderDetailModal` — lists all files with signed download URLs.

**Storage:** Files stored in Supabase private bucket `hbmedical-bucket-private`.

### 2.5 IVR / HCFA-1500 Forms

- **IVR tab:** Displays and edits clinical fields (`chief_complaint`, `symptoms`, `icd10_code`, `wound_type`, `date_of_service`, etc.). Editable by clinic-side and support_staff. `updateOrderClinicalFields()` action.
- **HCFA-1500 tab:** CMS Form 1500 data rendered as a preview; PDF generation triggered via `POST /api/generate-pdf`.
- **PDF generation:** `generateOrderPDFs()` helper in `_shared.ts` posts to the `/api/generate-pdf` route.
- **AI extraction:** `triggerAiExtraction()` posts to `/api/ai/extract-document` — auto-populates IVR fields from uploaded facesheet/clinical docs.

### 2.6 Order Messaging

**Component:** `OrderChatTab.tsx`

- Real-time messages per order stored in `order_messages` table.
- Messages show sender name, role badge (color-coded by role), timestamp, and avatar initials.
- Role badge colors: admin=purple, clinical_provider=blue, clinical_staff=green, support_staff=orange, sales_representative=gray.
- Unread counts tracked per user via `get_unread_message_counts(user_id)` Postgres RPC function.
- Unread count resets when user opens the chat tab (marks messages as read in `message_reads` table).
- `OrdersKanban` subscribes to `order_messages` INSERT events to increment badge counts in real time.

### 2.7 Shipping

- Shipment data mirrored from ShipStation (via webhook) into `shipments` table.
- `tracking_number` and `delivery_status` mirrored on the `orders` row for quick display.
- `markOrderDelivered(orderId)` — admin/support action; sets `delivery_status = "delivered"`, `delivered_at`.
- ShipStation fields: `carrier`, `service_level`, `tracking_number`, `tracking_url`, `shipstation_order_id`, `shipstation_shipment_id`, `estimated_delivery_at`.

### 2.8 Orders Server Actions

**Files:** `(services)/order-read-actions.ts`, `order-write-actions.ts`, `order-workflow-actions.ts`, `order-payment-actions.ts`, `_shared.ts`

| Action | File | Auth | Description |
|--------|------|------|-------------|
| `getOrders()` | read | clinic or distribution | Returns orders scoped by facility (clinic) or all (admin/rep/support). Uses `ORDER_WITH_RELATIONS_SELECT` (nested items, payments, shipments, invoices). |
| `getOrderById(id)` | read | any | Single order with all relations. |
| `getOrderHistory(id)` | read | any | Audit trail with performer names resolved. |
| `getOrderDocuments(id)` | read | any | All uploaded files for order. |
| `getOrderMessages(id)` | read | any | Messages with sender name/role resolved. |
| `getUnreadMessageCounts()` | read | any | RPC call returning `{order_id, unread_count}[]`. |
| `getNotifications()` | read | any | User notifications (admin client bypasses RLS). |
| `createOrder(data)` | write | clinic | Creates draft order; generates order number (`HBM-YYYYMMDD-RAND4`). |
| `uploadOrderDocument(id, type, formData)` | write | clinic | Uploads file to storage, inserts `order_documents` record. |
| `cancelOrder(id, notes)` | write | clinic or admin | Status-guarded cancellation. |
| `deleteOrder(id)` | write | clinic (draft only) | Hard delete with cascade. |
| `updateOrderClinicalFields(id, data)` | write | clinic or support | Updates IVR fields. |
| `assignProvider(id, providerId)` | write | clinic | Assigns clinical_provider to order (draft only). |
| `submitForSignature(id)` | workflow | clinic | draft → pending_signature. |
| `recallOrder(id)` | workflow | clinic | pending_signature → draft. |
| `signOrder(id, pin)` | workflow | clinical_provider | pending_signature → manufacturer_review; PIN verified. |
| `approveOrder(id)` | workflow | admin/support | manufacturer_review → approved. |
| `requestAdditionalInfo(id, notes)` | workflow | admin/support | manufacturer_review → additional_info_needed. |
| `resubmitForReview(id)` | workflow | clinic | additional_info_needed → manufacturer_review. |
| `markOrderDelivered(id)` | workflow | admin/support | shipped → delivered. |
| `setOrderPaymentMethod(id, method)` | payment | clinic | Sets pay_now or net_30 on approved order. |
| `initiatePayment(id, returnUrl)` | payment | clinic | Stripe checkout (pay_now) or invoice (net_30); returns URL. |
| `getOrderPayment(id)` | payment | any | Fetches latest payment record. |
| `getOrderInvoice(id)` | payment | any | Fetches latest invoice record. |

### Redux State
**Slice:** `orders-slice.ts` — `OrdersState`

| Key | Type | Updated by |
|-----|------|-----------|
| `items` | `DashboardOrder[]` | `setOrders`, `addOrderToStore`, `updateOrderInStore`, `removeOrderFromStore` |

### UI Behavior
- **View toggle:** Admin/support can switch between kanban and table view.
- **Realtime:** `OrdersKanban` subscribes to `orders` UPDATE and `order_messages` INSERT.
- **Unread badge:** Per-order unread message count shown on kanban cards.
- **Status navigation (mobile):** Tab strip for status columns.
- **Create order:** `CreateOrderModal` — multi-step wizard (wound type → date → notes → document upload with progress).
- **Order cards:** Show order number, patient/facility name, status badge, unread message count.
- **Empty column:** "No orders" message per kanban column.
- **Payment return URL:** `?payment_success=true&order_id=X` triggers toast + auto-opens modal.
- **Session storage:** `pending-order-open` key used when navigating from another page to trigger modal.
- **Custom event:** `open-order-modal` dispatched when on same page.

### Database Tables
- `orders` (order_status, payment_status, fulfillment_status, delivery_status, invoice_status, payment_method, order_number, facility_id, notes, placed_at, paid_at, delivered_at, tracking_number)
- `order_items` (order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal [GENERATED], total_amount [GENERATED])
- `payments` (order_id, provider, payment_type, status, amount, currency, stripe_* fields, receipt_url, paid_at)
- `invoices` (order_id, invoice_number, provider, status, amount_due, amount_paid, due_at, issued_at, paid_at, hosted_invoice_url)
- `shipments` (order_id, carrier, service_level, tracking_number, tracking_url, shipstation_* fields, status, shipped_at, estimated_delivery_at, delivered_at)
- `stripe_webhook_events` (event_id [PK], event_type, object_id) — idempotency log
- `order_messages` (order_id, sender_id, content, created_at)
- `message_reads` (message_id, user_id) — read receipts
- `order_history` (order_id, performer_id, from_status, to_status, notes, created_at)
- `notifications` (user_id, order_id, type, read_at)

### Edge Cases
- Draft orders block payment: `payment_method` must be NULL.
- Submitted orders require `payment_method` to be set.
- `order_items.product_id` is nullable — preserves history when a product is deleted.
- `total_amount` is a GENERATED column on `order_items`; never written directly.
- Clinic cannot cancel shipped/delivered orders.
- Admin cannot delete orders (only cancel).
- PIN must be set before signing (`has_pin` checked in UI; shows alert if unset).
- Stripe `customer_id` is created lazily on first payment attempt; stored on `facilities`.

---

## 3. Accounts

### Purpose
CRM-style account management for Meridian's clinic relationships. Each "account" is a clinic facility. Admins manage all accounts; sales reps manage their assigned clinics.

### User Roles

| Role | Capabilities |
|------|-------------|
| admin | View all accounts; change status (active/prospect/inactive); assign sales reps; view/manage contacts, activities, orders |
| sales_representative | View assigned accounts; view contacts and activities (read-only or manage own); cannot change account status or reassign reps |
| support_staff | View all accounts (read-only) |
| clinical_provider / clinical_staff | No access (redirected) |

### 3.1 Accounts List

**Route:** `/dashboard/accounts`
**Page:** `accounts/page.tsx`

#### Server Actions
**File:** `accounts/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getAccounts(filters?)` | admin/rep/support | Fetches clinics filtered by status, assigned_rep (admin only), and search term. Returns `IAccount[]` with contact counts and order counts. |
| `getSalesReps()` | admin | Lists all `sales_representative` profiles for the rep filter dropdown. |
| `updateAccountStatus(accountId, status)` | admin only | Sets `status` on facility (active/prospect/inactive). |
| `assignRep(accountId, repId)` | admin only | Sets `assigned_rep` on facility. |

#### Redux State
**Slice:** `accounts-slice.ts`

| Key | Updated by |
|-----|-----------|
| `items: IAccount[]` | `setAccounts`, `addAccountToStore`, `updateAccountInStore`, `removeAccountFromStore` |

#### UI Behavior
- **Filters:** Status filter (all/active/prospect/inactive), rep filter (admin only, dropdown), search input.
- **Table columns:** Name + location, Status badge, Assigned Rep, City/State, Contacts count, Orders count.
- **Row click:** Navigates to account detail page `/dashboard/accounts/[id]`.
- **Empty state:** Shown when no accounts match filters.
- **Status badge:** `AccountStatusBadge` — emerald (active), amber (prospect), gray (inactive).

### 3.2 Account Detail

**Route:** `/dashboard/accounts/[id]`
**Page:** `accounts/[id]/page.tsx`

Fetches: account, sales reps (admin), contacts, orders, activities. Determines `canEdit` (admin only) and `showActivities` (admin/rep).

#### Server Actions
**File:** `accounts/(services)/actions.ts` (continued from list)

| Action | Auth | Description |
|--------|------|-------------|
| `getAccountById(id)` | admin/rep/support | Fetches single account; blocks `rep_office` type. |
| `getActivitiesByFacility(id)` | admin/rep | Fetches all activities for facility, ordered by date. |
| `createActivity(facilityId, _prev, formData)` | admin | Creates activity (type, date, contact_id, outcome, notes). |
| `updateActivity(activityId, facilityId, _prev, formData)` | admin | Updates activity fields. |
| `deleteActivity(activityId, facilityId)` | admin | Hard deletes activity. |
| `getContactsByFacility(id)` | any | Fetches active contacts for facility. |
| `createContact(facilityId, _prev, formData)` | admin/rep (own) | Creates contact; rep auth check. |
| `updateContact(contactId, facilityId, _prev, formData)` | admin/rep (own) | Updates contact; rep auth check. |
| `deactivateContact(contactId, facilityId)` | admin/rep (own) | Soft-deletes via `is_active = false`. |

#### Tabs

| Tab | Visible To | Description |
|-----|-----------|-------------|
| Overview | all | Facility address, assigned rep card, created/updated timestamps |
| Contacts | all | Contact cards (3-col grid); Add/Edit/Delete buttons |
| Activities | admin + rep | Activity feed with type, outcome, contact link, notes; Edit/Delete |
| Orders | admin + rep | Horizontal kanban of orders grouped by status |

#### UI Behavior
- **Account header:** Name, status badge, contact person. Admin controls: status dropdown, rep assignment dropdown. Rep view: read-only rep name.
- **Contacts tab:** Card grid; `ContactModal` dialog for create/edit (first_name, last_name, title, email, phone, preferred_contact, notes). Delete triggers confirm modal. Stagger animation on load.
- **Activities tab:** Type filter pills (all/visit/call/email/demo). Cards show type icon, outcome badge, contact name, date, logged-by, notes. Edit/Delete with confirm.
- **ActivityModal:** Fields — type (required), activity_date (pre-filled today), contact_id (optional dropdown from Redux contacts), outcome (required), notes.
- **Orders tab:** Horizontal scroll kanban; click card → `OrderDetailModal`. Columns: manufacturer_review, additional_info_needed, approved pending/processed, shipped, delivered.
- **Realtime:** Supabase channel `account-orders-${account.id}` — orders UPDATE events sync via Redux `updateOrderInStore`.
- **Payment return handling:** `?payment_success=true`/`payment_cancelled=true` URL params trigger toasts and auto-switch to orders tab.
- **Providers dispatch:** `setAccounts([account])`, `setContacts(contacts)`, `setActivities(activities)` on mount.

#### Database Tables
- `facilities` (id, user_id, name, status, contact, phone, address, city, state, postal_code, country, stripe_customer_id, assigned_rep)
- `activities` (id, facility_id, contact_id, logged_by, type, activity_date, outcome, notes) — type ∈ {visit, call, email, demo}; outcome ∈ {positive, neutral, negative, no_response}
- `contacts` (id, facility_id, first_name, last_name, title, email, phone, preferred_contact, notes, is_active)
- `orders` — read-only in account detail; mutations via Orders feature

#### Edge Cases
- Rep cannot see accounts not assigned to them (server-side filter).
- `rep_office` facility type is blocked from account detail.
- Contacts use soft delete (`is_active = false`); they still appear in activity modal dropdown if linked to existing activities.
- Activity `contact_id` is optional — can log an activity without a contact.

---

## 4. Users

### Purpose
Admin-only user management. Invite new internal users (distribution-side: admin, sales_representative, support_staff), manage their lifecycle (activate/deactivate/delete), and resend invite emails.

### User Roles

| Role | Access |
|------|--------|
| admin | Full access — create, deactivate, reactivate, delete, resend invite |
| all others | Redirected to `/dashboard` |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/users` | User list with filters, stats, and actions |

### Business Logic
- **Status flow:** `pending` (invited, never logged in) → `active` (first login via trigger `handle_user_login`) → `inactive` (deactivated by admin).
- Reactivation restores `active` status; deactivation bans for ~100 years via Supabase admin API.
- **Delete prerequisites:** User must be deactivated first (guard: cannot delete active users). Cannot delete self.
- **Delete cascade:** Removes `rep_hierarchy`, `invite_tokens`, `facility_members`, `provider_credentials`, `facilities` (with orders/shipments/payments/invoices), nullifies `assigned_rep` on other facilities, then `auth.admin.deleteUser()` (cascades `profiles`).
- New users receive an invite email via Resend with a recovery link. Link uses Supabase `auth.admin.generateLink()`.
- Admin users get `has_completed_setup = true` automatically on creation.

### Server Actions
**File:** `users/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getUsers(filters?)` | admin | Fetches profiles with facility data; supports role and search filters. Includes auth ban status. |
| `createUser(_prev, formData)` | admin | Creates auth user + profile (status=pending), generates recovery link, sends invite email via Resend. |
| `deactivateUser(userId)` | admin | Bans user ~100 years; sets `status = "inactive"`. |
| `reactivateUser(userId)` | admin | Removes ban; sets `status = "active"`. |
| `deleteUser(userId)` | admin | Full cascade delete (see above). Guards: not self, must be inactive first. |
| `resendInvite(userId, email, firstName, role)` | admin | Generates new recovery link; sends via `sendInviteEmail()`. |

### Redux State
**Slice:** `users-slice.ts`

| Key | Updated by |
|-----|-----------|
| `items: IUser[]` | `setUsers`, `addUserToStore`, `updateUserInStore`, `removeUserFromStore` |

### UI Behavior
- **Stats row:** Total, Active, Pending, Inactive counts (computed from Redux items).
- **Filters:** Tab pills for status (all/active/pending/inactive with count badges), search input, role select.
- **Table columns:** User (avatar + name + facility), Email, Role badge, Status badge, Actions.
- **Row actions (by status):**
  - Pending: Resend Invite (mail icon), Delete
  - Active: Deactivate
  - Inactive: Reactivate, Delete
- **Delete guard:** Confirm modal; active users show "deactivate first" message instead.
- **Create user modal:** Fields — first_name, last_name, email, role (dropdown). Note: invite email sent automatically.
- **Loading states:** Per-row loading spinners during async actions.
- `CreateUserModal` uses `useActionState` bound to `createUser`; on success dispatches `addUserToStore`.

### Database Tables
- `profiles` (id, email, first_name, last_name, role, phone, status, has_completed_setup)
- Auth ban state stored in `auth.users` (Supabase managed)

### Edge Cases
- `createUser` creates `auth.users` first; if profile/facility creation fails, auth user is deleted (cleanup).
- Cannot delete self — guarded in `deleteUser`.
- `has_completed_setup` is only set `true` for `admin` role on creation; others complete it during onboarding.

---

## 5. Tasks

### Purpose
Admin-only task management for tracking follow-up actions linked to clinic accounts and contacts.

### User Roles

| Role | Access |
|------|--------|
| admin | Full access — create, view, edit, toggle status, delete |
| all others | Redirected to `/dashboard` |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/tasks` | Task board grouped by due date |

### Business Logic
- **Status:** `open` ↔ `done` (toggled via `toggleTaskStatus`).
- **Priority levels:** `high`, `medium`, `low`.
- **Grouping:** Tasks grouped by due date into: `overdue` (past due, not done), `today`, `upcoming`, `done`.
- **Sorting:** By `due_date` ascending, then `created_at` descending.
- `assigned_to` defaults to current user if not specified on creation.
- `reminder_sent` flag initialized to `false` on creation (for future reminder logic).
- Tasks can optionally link to a `facility_id` (account) and `contact_id`.

### Server Actions
**File:** `tasks/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getTasks(filters?)` | admin | Fetches tasks filtered by status, priority, facility_id. |
| `getTasksByFacility(facilityId)` | admin | Wrapper for `getTasks` with facility filter. |
| `createTask(_prev, formData)` | admin | Creates task; defaults assigned_to to current user. Returns `ITaskFormState`. |
| `updateTask(id, _prev, formData)` | admin | Updates task fields (not status). |
| `toggleTaskStatus(id, currentStatus)` | admin | Flips open↔done; fetches and returns updated task. Revalidates path. |
| `deleteTask(id)` | admin | Hard deletes task. |

### Redux State
**Slice:** `tasks-slice.ts`

| Key | Updated by |
|-----|-----------|
| `items: ITask[]` | `setTasks`, `addTaskToStore`, `updateTaskInStore`, `removeTaskFromStore` |

### UI Behavior
- **Board layout:** Kanban columns per group (overdue, today, upcoming, done) with max-height scroll.
- **Mobile FAB:** Fixed bottom-right "+" button opens `TaskModal`.
- **Task cards:** Checkbox to toggle done/open (strikethrough on title when done), priority badge (red/amber/gray), overdue badge (red, if not done and date < today), due date, facility name, contact name, notes (2-line clamp). Edit/Delete icon buttons.
- **Disabled state:** Card actions disabled (opacity-50) while async operation in progress.
- **Toolbar:** Status filter dropdown (all/open/done), priority dropdown (all/high/medium/low).
- **TaskModal:** Fields — title, due_date, priority, assigned_to, facility_id (dropdown), contact_id (cascades from facility selection via `getContactsByFacility`), notes.
- **Empty state:** Per-group message when no tasks in that group.
- **Confirm modal:** For delete action.

### Database Tables
- `tasks` (id, title, due_date, priority, status, assigned_to, facility_id, contact_id, notes, reminder_sent, created_at, updated_at)
- `contacts` — for contact dropdown in `TaskModal`
- `facilities` — for facility dropdown in `TaskModal`

### Edge Cases
- Facility dropdown dynamically loads contacts via `getContactsByFacility` — contact field resets when facility changes.
- `reminder_sent` is reserved for future automated reminder logic; not currently used in UI.

---

## 6. Onboarding

### Purpose
Invitation management for bringing new users into the system. Sales reps invite clinic users; clinical providers invite clinic staff; admins can do both. Manages invite tokens, sub-rep hierarchies, and sends invitation emails.

### User Roles

| Role | Access |
|------|--------|
| admin | View info banner (links to Users page for internal invites); invite clinical providers to reps' clinics; view all tokens |
| sales_representative | Invite clinical providers to their clinic; invite sub-reps; manage sub-reps; view own tokens |
| clinical_provider | Invite clinical staff to their own facility; view own tokens |
| clinical_staff / support_staff | Redirected to `/dashboard` |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/onboarding` | Role-specific onboarding dashboard |

### Business Logic

#### Invite Token System
- Tokens have an expiry (default 30 days).
- Fields: `token` (UUID), `invited_email`, `role`, `facility_id`, `created_by`, `used_by`, `used_at`, `expires_at`.
- Validation: no duplicate active token for same email+role; no duplicate account.
- Token URL format: `${baseUrl}/invite/${token}` — sent via Resend email.
- Tokens can be resent (regenerates recovery link) or deleted.

#### Role-Specific Invite Rules (enforced in `generateInviteToken`)
- **Admin:** Can only invite `clinical_provider`; requires `facility_id` (a rep's clinic).
- **Sales rep:** Can invite `clinical_provider` (to their clinic) or `sales_representative` (sub-rep); `facility_id` auto-set for providers, null for sub-rep invites.
- **Clinical provider:** Can only invite `clinical_staff` to their own facility.

#### Sub-Rep System
- `inviteSubRep` creates a placeholder profile ("Pending Setup"), links parent→child in `rep_hierarchy`, sends invite email.
- Sub-rep status management: `active` ↔ `inactive` (bans/unbans auth user).
- Delete: only pending/inactive sub-reps; calls `auth.admin.deleteUser`.
- `getMySubReps` fetches child reps via `rep_hierarchy` join.

### Server Actions
**File:** `onboarding/(services)/actions.ts` and `(services)/invite-tokens/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `generateInviteToken(_prev, formData)` | admin/rep/provider | Role-scoped token creation + email send. |
| `getSalesRepsWithFacilities()` | admin | Lists sales_rep profiles with their facilities. |
| `getMyInviteTokens()` | any | Own tokens (admin sees all). |
| `validateInviteToken(token)` | public | Checks validity and expiry — used in invite signup page. |
| `consumeInviteToken(token, usedBy)` | public | Marks token used after successful signup. |
| `deleteInviteToken(tokenId)` | admin/rep/provider | Deletes token record. |
| `inviteSubRep(_prev, formData)` | rep | Creates placeholder profile + rep_hierarchy entry + sends email. |
| `getMySubReps()` | rep | Fetches hierarchical children from rep_hierarchy. |
| `generateClinicMemberInvite(_prev, formData)` | clinical_provider | Invites clinical_staff to own facility. |
| `updateSubRepStatus(subRepId, status)` | rep | Bans/unbans auth user; updates status. |
| `deleteSubRep(subRepId)` | rep | Deletes pending/inactive sub-rep auth user + profile. |
| `resendSubRepInvite(subRepId, email, firstName)` | rep | Generates recovery link; sends invite email. |
| `resendInviteEmail(tokenId)` | admin/rep/provider | Resends email for existing token. |

### Redux State
**Slice:** `invite-tokens-slice.ts`

| Key | Updated by |
|-----|-----------|
| `items: IInviteToken[]` | `setInviteTokens`, `addInviteTokenToStore`, `removeInviteTokenFromStore` |

### UI Behavior
- **Admin:** Info banner only — directs admin to `/dashboard/users` for internal user creation.
- **Invite Clinic section (admin/rep):** Form to invite clinical_provider; admin selects rep's facility.
- **Invite Clinic Staff section (provider):** Form to invite clinical_staff to own facility.
- **Invite Sub-Rep section (rep):** Form to invite a sub-rep (sales_representative).
- **Invite Tokens section:** Lists all created tokens — `InviteTokenCard` shows email, created_by, status (used/expired/valid), expiry. Actions: Resend, Delete.
- **Sub-rep management (rep):** Table of sub-reps with status badge; deactivate/reactivate/delete/resend actions. Confirm modals for destructive actions.
- **Token status display:** valid (green), used (blue), expired (gray).

### Database Tables
- `invite_tokens` (id, token, invited_email, role, facility_id, created_by, used_by, used_at, expires_at)
- `rep_hierarchy` (parent_rep_id, child_rep_id) — for sub-rep tree
- `profiles` — placeholder created for sub-rep on invite
- `facility_members` — populated when invite is consumed

### Edge Cases
- Duplicate invite prevention: server checks for active token with same email+role before creating.
- `consumeInviteToken` must be called at invite signup completion to prevent token reuse.
- Admin info banner replaces the invite form — admin does not use tokens for internal HB staff (uses Users page instead).

---

## 7. Settings

### Purpose
Personal account settings. Profile editing, password change, and role-specific sections: team management (rep sees clinics + sub-reps; provider sees clinic members) and credential management (provider only).

### User Roles
All authenticated roles access Settings. Tab visibility varies:

| Tab | Visible To |
|-----|-----------|
| Profile | all |
| Team | sales_representative, clinical_provider |
| Credentials | clinical_provider only |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/settings` | Tabbed settings page |

### Business Logic
- **Profile updates:** Only `first_name`, `last_name`, `phone` can be changed; email and role are read-only. Updates both `profiles` table and `auth.users.user_metadata`.
- **Password change:** Validates 8+ chars and new/confirm match. Calls `supabase.auth.updateUser`.
- **PIN management (provider):** `verifyAndChangePin` uses `verify_pin` and `hash_pin` RPC functions. PIN is stored as a bcrypt hash in `provider_credentials`.
- **Provider credentials:** NPI (10-digit), PTAN, medical_license_number — stored in `provider_credentials` table.
- **Team tab (rep):** Shows assigned clinics (`getMyClinicAccounts`) and sub-reps (`getMySubReps`).
- **Team tab (provider):** Shows facility members (`getMyClinicMembers`) — excludes self.
- **Facility member roles:** `updateMemberRole` updates `facility_members.role_type`.

### Server Actions
**File:** `settings/(services)/actions.ts` (wrapper over canonical service files)

| Action | Auth | Description |
|--------|------|-------------|
| `getMyProfile()` | any | Delegates to profile service. |
| `updateProfile(_prev, formData)` | any | Validates; updates profiles + auth metadata. |
| `changePassword(_prev, formData)` | any | Validates 8+ chars and match; calls `supabase.auth.updateUser`. |
| `getMyCredentials()` | clinical_provider | Fetches `provider_credentials`. |
| `saveCredentials(_prev, formData)` | clinical_provider | Upserts credential type, NPI, PTAN, medical_license_number. |
| `deleteCredentials()` | clinical_provider | Deletes credentials record. |
| `verifyAndChangePin(currentPin, newPin)` | clinical_provider | RPC verify + hash + update. |
| `getFacilityMembers(facilityId?)` | any | Fetches `facility_members` with profile joins. |
| `removeFacilityMember(memberId)` | provider | Deletes `facility_members` record. |
| `updateMemberRole(memberId, _prev, formData)` | provider | Updates `facility_members.role_type`. |
| `getMyClinicAccounts()` | rep | Clinics where `assigned_rep = current user`. |
| `getMySubReps()` | rep | Sub-reps from `rep_hierarchy` children. |
| `getMyClinicMembers()` | provider | `getFacilityMembers` excluding self. |

### UI Behavior
- **Profile tab:** Two-column form (desktop); fields: first_name, last_name, phone; read-only: email, role. `ChangePasswordForm` section below divider. Save Changes button with loading state.
- **Team tab (rep):** "My Clinics" section (cards with clinic name, address, orders/contacts count) and "My Sub-Reps" section (cards with name, email, status badge).
- **Team tab (provider):** "My Clinic Members" section with member cards; delete button per member.
- **Credentials tab:** PIN status (set/not set) with "Change PIN" button → `ChangePinModal` (current PIN if set, new PIN, confirm PIN — dot indicators). Credentials form: credential type dropdown, NPI, PTAN, medical license. Delete credentials with confirm modal.
- **ChangePinModal:** 4-dot visual indicator for PIN input; validates PIN is exactly 4 digits.

### Database Tables
- `profiles` (first_name, last_name, phone — editable; email, role — read-only)
- `provider_credentials` (user_id, credential_type, npi_number, ptan_number, medical_license_number, pin_hash)
- `facility_members` (id, facility_id, user_id, role_type)
- `rep_hierarchy` (parent_rep_id, child_rep_id)
- `facilities` — for `getMyClinicAccounts`

### Edge Cases
- Email and role are never updated by `updateProfile` — enforced server-side.
- PIN stored as bcrypt hash; `verify_pin` RPC used to check before allowing change.
- `deleteCredentials` removes entire credentials row including PIN hash — provider will need to re-set PIN.

---

## 8. Contracts

### Purpose
Contract and agreement document library. Admins upload and manage PDFs; sales reps and admins can download them.

### User Roles

| Role | Access |
|------|--------|
| admin | Full CRUD — upload, download, delete, bulk delete; sees inactive items |
| sales_representative | Read + download only (active items only) |
| all others | Redirected to `/dashboard` |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/contracts` | Contract materials grid |

### Business Logic
- Materials are grouped into categories by keyword analysis of the title:
  - **Contracts & Agreements:** keywords → NDA, agreement, contract, BAA, MSA
  - **Commercial Terms:** keywords → pricing, terms, commercial
  - **Policies & Forms:** keywords → policy, form, procedure
- Acronyms expanded in display: NDA, MSA, HIPAA, BAA, PHI, OCM.
- Non-admins only see `is_active = true` records (RLS + server action filter).
- File upload is a two-step flow: prepare (server validates, returns signed token) → client uploads directly to Supabase storage → complete (server saves DB record).
- File validation: PDF only; filename sanitization.

### Server Actions
**File:** `contracts/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getContractMaterials()` | admin/rep | Fetches `contract_materials`; non-admin filtered to `is_active = true`. |
| `getSignedDownloadUrl(filePath)` | any | Generates signed download URL from private storage. |
| `prepareContractUpload(formData)` | admin | Validates PDF; returns signed upload token. |
| `completeContractUpload(data)` | admin | Saves `contract_materials` DB record after upload. |
| `deleteContractMaterial(id)` | admin | Deletes from storage + DB. |
| `bulkDeleteContractMaterials(ids)` | admin | Deletes multiple materials. |

**File:** `contracts/(services)/client-upload.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `uploadContractMaterial(formData)` | admin | Direct Supabase upload; handles prepare-complete flow. |

### Redux State
**Slice:** `contracts-slice.ts`

| Key | Updated by |
|-----|-----------|
| `items` | `setContractMaterials` |
| `selectedIds` | `toggleSelectContractItem`, `selectAllContractItems`, `clearContractSelection` |
| `isSelecting` | `setContractSelecting` |

### UI Behavior
- **Grid layout:** 1 col (mobile), 2 (tablet), 3 (desktop), 4 (xl). Grouped by category with section headers.
- **User card (`MaterialCard`):** Gradient header, icon, title, description (2-line clamp), tag badge, Download button (signed URL → new tab).
- **Admin card (`AdminMaterialCard`):** Adds checkbox (top-left), delete button (top-right), inactive badge if `is_active = false`, selection highlight.
- **Bulk bar (`AdminBulkBar`):** Appears when items selected — shows count, clear, "Delete Selected" with confirm modal.
- **Upload button (`AdminUploadButton`):** Dialog with file picker (PDF only, drag-drop style), title (auto-populated from filename, max 120 chars), tag (max 60 chars), sort order.
- **Empty state:** `EmptyState` component when no materials.
- **Loading state:** Per-card during delete operation.

### Database Tables
- `contract_materials` (id, title, description, tag, bucket, file_path, file_name, mime_type, sort_order, is_active)
- Storage bucket: `hbmedical-bucket-private` with path prefix `contracts/%`

### Edge Cases
- Non-admin users never see inactive materials (dual enforcement: RLS + server action filter).
- Bulk delete dispatches individual Redux removals after server confirmation.

---

## 9. Marketing

### Purpose
Marketing materials library for sales reps. Same pattern as Contracts with different category logic.

### User Roles
Same as Contracts (admin full CRUD, sales_rep read+download, others redirected).

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/marketing` | Marketing materials grid |

### Business Logic
- Materials grouped by keyword analysis:
  - **Marketing Materials:** brochures, sell sheets, general marketing
  - **Reimbursement Guides:** title contains "reimbursement"
  - **Product Documents:** product-specific docs
- Classification: `reimbursement-guide` → reimbursement keyword; `sales-presentation` → pitch deck/slide deck/presentation/podiatry; `clinical-reference` → clinical/study/reference; `brochure` → brochure; `document` → default.
- Icons: Presentation (sales), Flask (clinical), BookOpen (brochure), FileBarChart (reimbursement), FileText (default).
- Upload path: `storage/marketing/`.

### Server Actions
**File:** `marketing/(services)/actions.ts` — same CRUD pattern as Contracts.

### Redux State
**Slice:** `marketing-slice.ts` — same structure (items, selectedIds, isSelecting).

### UI Behavior
Identical to Contracts — grouped grid, MaterialCard/AdminMaterialCard, bulk bar, upload dialog.

### Database Tables
- `marketing_materials` (same structure as contract_materials with path prefix `marketing/%`)

---

## 10. Trainings

### Purpose
Training materials library for sales reps. Same pattern as Contracts/Marketing with training-specific categories.

### User Roles
Same as Contracts (admin full CRUD, sales_rep read+download, others redirected).

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/trainings` | Training materials grid |

### Business Logic
- Categories: "Training Materials", "Clinical Training", "Training Guides".
- Classification: `onboarding-guide` (onboarding/orientation), `training-deck` (slide/deck/presentation), `clinical-training` (clinical/study/reference), `instructions-for-use` (instruction/IFU), `training-checklist` (checklist/competency), `document` (default).
- Icons: Presentation (deck), Flask (clinical), BookOpen (onboarding), ClipboardCheck (checklist), ScrollText (IFU), FileText (default).
- Acronyms: IFU, HIPAA, OCM, CGS, NGS.
- Upload path: `storage/trainings/`.

### Redux State
**Slice:** `trainings-slice.ts` — same structure.

### Database Tables
- `training_materials` (same structure, path prefix `trainings/%`)

---

## 11. Hospital Onboarding

### Purpose
Hospital onboarding materials library. Admin-managed PDFs for hospital facility credentialing and orientation.

### User Roles
Same as Contracts (admin full CRUD, sales_rep read+download, others redirected).

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/hospital-onboarding` | Hospital onboarding materials grid |

### Business Logic
- Categories: "Onboarding Guides", "Credentialing & Documents", "Presentations & Resources".
- Classification:
  - `onboarding-guide`, `orientation`, `facility-guide` → "Onboarding Guides"
  - `credentialing`, `checklist`, `policy-form` → "Credentialing & Documents"
  - `presentation`, `document` → "Presentations & Resources"
- Icons: Building2 (facility), ScrollText (credentialing), ClipboardCheck (checklist), Presentation (presentation).
- Acronyms: HIPAA, PHI, NDA, OCM, CGS, NGS.
- Upload path: `storage/hospital-onboarding/`.

### Redux State
**Slice:** `hospital-onboarding-slice.ts` — same structure (note: slice name includes spaces).

### Database Tables
- `hospital_onboarding_materials` (same structure, path prefix `hospital-onboarding/%`)

---

## 12. Dashboard Home

### Purpose
Landing page after login. Shows summary stats and recent orders.

### User Roles
All authenticated roles access the dashboard home.

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Dashboard overview |

### Business Logic
- **Stats computed server-side:**
  - Total Orders — count of all orders
  - Total Revenue — sum of `order_items.total_amount` for all non-canceled orders
  - Active Orders — orders not `canceled` or `draft`
- **Recent orders:** Latest 10 orders sorted by `placed_at` descending.

### Server Actions
**File:** `(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getUserData()` | any | Fetches profile, checks `isSubRep` via `rep_hierarchy`, returns `UserData` for Redux. |
| `signOut()` | any | Clears Supabase session; redirects to `/sign-in`. |
| `getAllOrders()` | any | Fetches all orders with items for stats computation. |

### Redux State
**Slice:** `dashboard-slice.ts` — `UserState`

| Key | Type | Updated by |
|-----|------|-----------|
| `name` | string | `setUser` |
| `email` | string | `setUser` |
| `initials` | string | `setUser` |
| `role` | UserRole | `setUser` |
| `isSubRep` | boolean | `setUser` |
| `userId` | string | `setUser` |
| `isSidebarOpen` | boolean | `openSidebar`, `closeSidebar`, `toggleSidebar` |

### UI Behavior
- **Stats cards (`StatsCard`):** 3-column grid (desktop). Total Orders, Total Revenue (formatted currency), Active Orders.
- **Recent orders table (`RecentOrdersTable`):** Desktop — DataTable with columns (Order ID, Date, Amount, Status). Mobile — `OrderMobileCard` components. Status badge per row.
- **Layout (`DashboardLayout`):**
  - Sidebar: sticky desktop (220px expanded / 60px collapsed via localStorage `hb-sidebar-collapsed`), fixed overlay mobile.
  - Mobile top bar (`MobileTopBar`): HB logo + hamburger menu.
  - Bottom nav (`BottomNav`): Mobile-only; role-filtered items.
  - `NextTopLoader` for page transition progress bar.
- **Sidebar (`Sidebar.tsx`):** Navigation grouped by section; role-based visibility; notification bell; `SidebarUserCard` at bottom (avatar, name, email, role badge, sub-rep indicator). Logout button.
- **Greeting:** `DashboardHeader` with `showGreeting` shows welcome message with user name (client-only, hydration-safe).

### Database Tables
- `orders` + `order_items` — for stats
- `profiles` — for user data
- `rep_hierarchy` — for `isSubRep` check

---

## 13. Profile

### Purpose
User's own profile page — view and edit personal information (name, phone).

### User Roles
All authenticated roles.

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/profile` | Personal profile form |

### Business Logic
- Only `first_name`, `last_name`, `phone` are editable. Email and role are always read-only.
- `updateProfile` syncs changes to both `profiles` table and `auth.users.user_metadata`.
- Returns 404 if profile not found.

### Server Actions
**File:** `profile/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getProfile()` | any | Fetches own profile from `profiles` table. |
| `updateProfile(_prev, formData)` | any | Validates with `updateProfileSchema`; updates profiles + auth metadata. Field errors returned for invalid input. |

### Redux State
**Slice:** `profile-slice.ts`

| Key | Updated by |
|-----|-----------|
| `item: Profile \| null` | `setProfile`, `updateProfileInStore`, `clearProfile` |

### UI Behavior
- **Form fields:** first_name, last_name, phone (PhoneInputField with international validation), email (read-only), role (read-only).
- **Layout:** Two-column on desktop, single column on mobile. Icon labels (User, Mail icons).
- **Save Changes button:** Loading state during submission; disabled while pending.
- **Toast notifications:** Success/error feedback.
- **Phone input:** `PhoneInputField` component with E.164 format validation.

### Database Tables
- `profiles` (id, email, first_name, last_name, phone, role, created_at, updated_at)

---

## 14. Auth Flow

### Purpose
User authentication, registration, and lifecycle management. Public sign-in/sign-up, invite-based onboarding for clinic users, and password reset.

### 14.1 Sign In

**Route:** `/sign-in`
**Component:** `SignInForm.tsx`

**Fields:** Email, Password (toggle visibility).
**Features:** Remember me checkbox, Forgot password link, error display (`ErrorAlert`).
**Server Action:** `signIn(prevState, formData)` → `supabase.auth.signInWithPassword`.

**Business Logic:**
- On first login (`last_sign_in_at` changes from NULL): DB trigger `handle_user_login` updates `profiles.status` from `pending` to `active`.
- Redirect on success: admins → `/dashboard/products`; others → `/dashboard`.
- Safety net: If `access_token` hash in URL (from a reset link), redirects to `/set-password#{hash}` before rendering form.
- Shows "Password updated successfully" message if redirected from password reset.

### 14.2 Sign Up (Public)

**Route:** `/sign-up`
**Component:** `SignUpForm.tsx`

> **Note:** As of 2026-04-02, the sign-up page shows an "invitation only" message — the form is no longer accessible for self-registration. The form code exists but is gated. New users must use the invite flow.

**Form fields (when available):**
- Role selection: Sales Rep or Clinical Provider (button toggle)
- Personal: first_name, last_name, email, phone (international)
- Facility: name, address line 1/2, city, state, postal code
- Security: password, confirm password (mismatch validation)
- Agreement: Terms & Privacy checkbox (required)

**Server Action:** `signUp(prevState, formData)`:
1. Validates email, password, role, phone, country.
2. `supabase.auth.signUp()` with metadata.
3. Creates `profiles` record.
4. Creates `facilities` record.
5. Cleanup: deletes auth user if profile/facility creation fails.
6. Redirects to `/verify-email`.

### 14.3 Invite-Based Sign Up

**Route:** `/invite/[token]/signup`
**Component:** `InviteSignUpForm.tsx`

Multi-step wizard with Framer Motion animations.

| Step | Shown To | Fields |
|------|---------|--------|
| 1 — Role Display | all | Shows assigned role from token, invited-by name |
| 2 — Personal Info | all | first_name, last_name, email, phone (international) |
| 3 — Office Info | clinical_provider only | Practice name, phone, address, city, state, zip |
| 4 — Security | all | Password, confirm password; clinical_provider adds: NPI (10-digit), PIN (4-digit), credential type |
| 5 — Agreement | all | Clinical providers: BAA + Product/Services PDFs in iframes with retry; others: text agreement |

**Server Action:** `inviteSignUp(token, formData)` (token bound via `.bind()`):
1. Validates invite token via `validateInviteToken`.
2. Creates user account linked to role/facility from token.
3. Calls `consumeInviteToken(token, newUserId)` to prevent reuse.
4. For clinical_provider: creates `provider_credentials` with NPI, credential type, hashed PIN.
5. Adds user to `facility_members` via `addFacilityMember`.
6. Sends welcome email.

**Contract PDFs:** `getContractSignedUrls()` fetches signed URLs from private storage for BAA/Product PDFs embedded in the agreement step.

**Step validation:** Each step validates before proceeding; step indicator shows progress.

**Validations:**
- NPI: exactly 10 digits.
- PIN: exactly 4 digits.
- Passwords: must match.

### 14.4 Forgot Password / Password Reset

**Route:** `/forgot-password`
**Component:** `ForgotPasswordForm.tsx`

**Initial state:** Email input + submit.
**Server Action:** `forgotPassword(prevState, formData)` → `supabase.auth.resetPasswordForEmail(email)`.
**Success state:** "Check your email" message with back-to-login link.

**Reset flow:**
1. User clicks link in email → redirected to `/set-password#{access_token}`.
2. `SignInForm` detects hash token → redirects to `/set-password` with hash preserved.
3. Set-password form calls `supabase.auth.updateUser({ password })` with the session from the hash.
4. On success → redirects to `/sign-in?passwordUpdated=true`.

### 14.5 Full User Lifecycle

```
Admin/Rep creates invite
  │  inviteSubRep() or generateInviteToken()
  ▼
Placeholder profile created (status=pending)
  │  Invite email sent via Resend
  ▼
User opens invite link /invite/[token]/signup
  │  validateInviteToken() — checks expiry
  ▼
Multi-step wizard (role-specific)
  │  inviteSignUp() — creates auth user, profile, facility_members
  │  consumeInviteToken() — marks token used
  ▼
User logs in for first time
  │  handle_user_login trigger — status: pending → active
  ▼
Active user
  │  deactivateUser() — bans, status: inactive
  ▼
Inactive user
  │  reactivateUser() — unbans, status: active
  │  OR
  │  deleteUser() — full cascade delete
  ▼
Deleted
```

**Invite email delivery:** Resend API with HTML template. Uses `auth.admin.generateLink()` to create a one-time recovery link embedded in the email body.

---

## 15. Shared Architecture

### 15.1 Role System

**File:** `utils/helpers/role.ts`

**5 canonical roles:**

| Role | Side | Description |
|------|------|-------------|
| `admin` | distribution | Meridian admin — full access |
| `sales_representative` | distribution | Field rep — accounts, tasks, onboarding |
| `support_staff` | distribution | Tech support — accounts, orders |
| `clinical_provider` | clinic | Physician — can create and sign orders |
| `clinical_staff` | clinic | Clinic staff — can create orders, cannot sign |

**Helper functions:**
- `isAdmin(role)`, `isSalesRep(role)`, `isSupport(role)`, `isClinicalProvider(role)`, `isClinicalStaff(role)`
- `isDistributionSide(role)` — admin OR sales_rep OR support
- `isClinicSide(role)` — clinical_provider OR clinical_staff
- `canSignOrders(role)` — clinical_provider only
- `canCreateOrders(role)` — clinical_provider OR clinical_staff

**Auth helpers** (`lib/supabase/auth.ts`):
- `getCurrentUserOrThrow(supabase)` — throws if not authenticated
- `getUserRole(supabase)` — fetches role from profiles, returns null if no profile
- `requireAdminOrThrow(supabase)` — throws if not admin
- `requireSupportOrAdminOrThrow(supabase)` — throws if not admin or support

**Sidebar navigation per role:**

| Role | Nav Items |
|------|-----------|
| admin | Dashboard, Products, Marketing, Contracts, Trainings, Hospital Onboarding, Accounts, Tasks, Onboarding, Users, Settings |
| sales_representative | Dashboard, Accounts, Tasks, Onboarding, Settings |
| support_staff | Dashboard, Accounts, Orders, Settings |
| clinical_provider | Dashboard, Orders, Settings |
| clinical_staff | Dashboard, Orders, Settings |

### 15.2 Redux Store Layout

```
store
├── dashboard     → user data (name, email, role, initials, isSubRep, userId), isSidebarOpen
├── products      → items[], search
├── orders        → items[]
├── accounts      → items[]
├── users         → items[]
├── tasks         → items[]
├── inviteTokens  → items[]
├── activities    → items[]  (shared, used in account detail)
├── contacts      → items[]  (shared, used in account detail + task modal)
├── contracts     → items[], selectedIds[], isSelecting
├── marketing     → items[], selectedIds[], isSelecting
├── trainings     → items[], selectedIds[], isSelecting
├── hospitalOnboarding → items[], selectedIds[], isSelecting
├── profile       → item (Profile | null)
└── commissions   → rates[], commissions[], payouts[], summary{}
```

**Pattern:** Each feature's `Providers.tsx` hydrates its slice from server-fetched data on mount. Mutations call server actions then dispatch optimistic Redux updates.

### 15.3 Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DashboardHeader` | `app/(components)/` | Page title + description + optional actions + optional greeting |
| `EmptyState` | `app/(components)/` | Centered icon + message + description |
| `MaterialCard` | `app/(components)/` | User-facing document card with download |
| `AdminMaterialCard` | `app/(components)/` | Admin document card with checkbox + delete |
| `AdminUploadButton` | `app/(components)/` | Upload dialog (PDF only, drag-drop, title/tag/sort) |
| `AdminBulkBar` | `app/(components)/` | Bulk selection bar with delete confirm |
| `MaterialsSection` | `app/(components)/` | Grouped section header + responsive card grid |
| `ConfirmModal` | `app/(components)/` | Destructive action confirm dialog with red accent |
| `SidebarUserCard` | `app/(components)/` | User avatar + name + role badge in sidebar footer |
| `StatCard` | `app/(components)/` | Dashboard stat card (icon + label + value) |
| `SubmitButton` | `app/(components)/` | Form submit with `isPending` spinner state |
| `StatusBadge` | `app/(components)/` | Status badge (active/inactive/pending) |
| `DataTable` | `app/(components)/` | Generic animated table with empty state + row click |
| `PhoneInputField` | shared | International phone input with E.164 validation |

**shadcn/ui primitives** (in `components/ui/`): Button, Input, Dialog, Select, Textarea, Checkbox, Tabs, Tooltip, etc.
### 15.4 Database Tables Reference

| Table | Feature(s) | Notes |
|-------|-----------|-------|
| `profiles` | Users, Auth, Settings, Profile | 1:1 with auth.users; has role, status, has_completed_setup |
| `facilities` | Accounts, Orders, Onboarding | 1:1 with profiles (user_id UNIQUE); has stripe_customer_id, assigned_rep |
| `products` | Products, Orders | Shared catalog; order_items snapshots name/sku/price |
| `orders` | Orders | Multi-status; FK → facilities |
| `order_items` | Orders | GENERATED subtotal + total_amount; nullable product_id |
| `payments` | Orders | Stripe checkout/invoice records |
| `invoices` | Orders | Net-30 invoice records (1:1 with orders) |
| `shipments` | Orders | ShipStation data (1:1 with orders) |
| `marketing_materials` | Marketing | PDF library |
| `contract_materials` | Contracts | PDF library |
| `training_materials` | Trainings | PDF library |
| `hospital_onboarding_materials` | Hospital Onboarding | PDF library |
| `stripe_webhook_events` | Orders | Idempotency log (service role only) |
| `activities` | Accounts | Visit/call/email/demo logs against facility + contact |
| `contacts` | Accounts, Tasks | Soft-deleted via is_active |
| `tasks` | Tasks | Linked to facility + contact |
| `invite_tokens` | Onboarding, Auth | Token-based invitations |
| `rep_hierarchy` | Onboarding, Users, Settings | parent_rep_id → child_rep_id |
| `facility_members` | Onboarding, Settings | Maps users to facilities with role_type |
| `provider_credentials` | Settings, Orders | NPI, PTAN, medical_license, pin_hash |
| `order_messages` | Orders | Real-time chat per order |
| `message_reads` | Orders | Read receipts per user per message |
| `order_history` | Orders | Audit trail of status transitions |
| `notifications` | Orders | Per-user notifications from status changes |
| `commission_rates` | Commissions | Versioned rates per rep (effective_from/to); active = effective_to IS NULL |
| `commissions` | Commissions | One row per paid order per rep; snapshots rate at calculation time |
| `payouts` | Commissions | Monthly payout batches per rep; unique on (rep_id, period) |

**DB functions:**
- `get_unread_message_counts(user_id)` → `{order_id, unread_count}[]`
- `get_user_facility_ids(user_uuid)` → `{facility_id}[]`
- `handle_user_login()` — trigger: first login sets profile status pending→active
- `hash_pin(input_pin)` → bcrypt hash
- `verify_pin(input_pin, stored_hash)` → boolean
- `is_facility_member(facility_id)` → boolean
- `is_rep_facility(rep_id, facility_id)` → boolean (recursive via rep_hierarchy)
- `set_updated_at()` / `set_row_updated_at()` — BEFORE UPDATE triggers on all tables

---

## 16. Commissions

### Purpose
Commission tracking and payout management for sales representatives. Admins set per-rep rates, commissions are auto-calculated when an order is paid, admins approve and batch commissions into monthly payouts.

### User Roles

| Role | Access |
|------|--------|
| admin | Full access — set rates for any rep, view all commissions, approve, adjust, generate and mark payouts |
| sales_representative | View own commissions and payouts; set rates for direct sub-reps only |
| all others | Redirected to `/dashboard` |

### Pages & Routes

| Route | Description |
|-------|-------------|
| `/dashboard/commissions` | Commission overview — KPIs, calculator, rate management, ledger, payouts |

### Business Logic

**Commission flow:**
1. **Rate set:** Admin (or rep for sub-reps) creates a rate record via `setCommissionRate`. A new rate is inserted first (with `effective_to = NULL`), then all other active rates for that rep are closed (`effective_to = today`), excluding the newly inserted row. The active rate is always the one where `effective_to IS NULL`.
2. **Order paid:** Stripe webhook (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, or `invoice.paid`) triggers `calculateOrderCommission(orderId)` inside a non-blocking try/catch — payment flow is never blocked by commission failure.
3. **Commission calculated:** `calculateOrderCommission` looks up the facility's `assigned_rep`, resolves the active rate for that rep, inserts a `direct` commission row. If the rep has a parent rep (`rep_hierarchy`), also inserts an `override` commission for the parent at the parent's `override_percent`.
4. **Admin approves:** Admin selects pending commissions in the ledger and bulk-approves via `approveCommissions(ids)`. Status: `pending` → `approved`.
5. **Payout generated:** Admin calls `generatePayout(repId, period)` — upserts a payout record (unique on rep_id + period) that sums all `approved` commissions for that rep and period. Status starts as `draft`.
6. **Payout paid:** Admin calls `markPayoutPaid(payoutId)` — sets payout `status = "paid"` and updates all linked commissions to `status = "paid"`, recording `paid_at` and `paid_by`.

**Commission types:**
- `direct` — standard commission for the rep assigned to the facility
- `override` — commission for the parent rep based on `override_percent` from their rate

**Statuses:**
- `commissions.status`: `pending` → `approved` → `paid`; `void` (manual nullification)
- `payouts.status`: `draft` → `approved` → `paid`

**Rate versioning:** Only one active rate per rep at a time (`effective_to IS NULL`). New rate is inserted first, then prior active rates are closed — insert failure leaves prior rate intact.

**Adjustment:** Admin can apply a dollar adjustment to any commission via `adjustCommission`. `final_amount` is a generated column (`commission_amount + adjustment`); falls back to `commission_amount + adjustment` if null.

### Server Actions
**File:** `app/(dashboard)/dashboard/commissions/(services)/actions.ts`

| Action | Auth | Description |
|--------|------|-------------|
| `getCommissionRates()` | admin/rep | Fetches all commission rates with rep and set-by name joins. Returns `ICommissionRate[]`. |
| `setCommissionRate(_prev, formData)` | admin/rep | Validates (rep_id, rate_percent 0–100, override_percent 0–100). Inserts new rate first (captures new row ID), then closes prior active rates excluding the new one. Returns `ICommissionRateFormState`. |
| `getCommissions()` | admin/rep | Fetches commissions with order number and rep name. Admin sees all; rep sees own only (RLS). Returns `ICommission[]`. |
| `calculateOrderCommission(orderId)` | server-only | Resolves `assigned_rep` from facility; resolves active rate; idempotency pre-check before insert. Inserts direct commission. If rep has parent in `rep_hierarchy`, idempotency-checks then inserts override commission. Skips $0 orders and $0 overrides. |
| `adjustCommission(id, adjustment, notes)` | admin | Validates adjustment is finite and within ±$1,000,000. Updates `adjustment` and `notes` on a commission row. Returns `{ success, error }`. |
| `approveCommissions(ids)` | admin | Bulk-updates `status = "approved"` for given commission IDs. Returns `{ success, error }`. |
| `getPayouts()` | admin/rep | Fetches payouts with rep name. Admin sees all; rep sees own. Returns `IPayout[]`. |
| `generatePayout(repId, period)` | admin | Upserts payout for rep+period; sums approved commissions into `total_amount`. Returns `{ success, error }`. |
| `markPayoutPaid(payoutId)` | admin | Sets payout `status = "paid"`, records `paid_at` and `paid_by`. Updates linked commissions to `status = "paid"`. Returns `{ success, error }`. |
| `getRepCommissionSummary()` | admin/rep | Returns `ICommissionSummary`: `totalEarned`, `totalPending`, `totalPaid`, `currentRate`. |

### Redux State
**Slice:** `commissions-slice.ts` — `CommissionsState`

| Key | Type | Updated by |
|-----|------|-----------|
| `rates` | `ICommissionRate[]` | `setRates`, `addRateToStore` |
| `commissions` | `ICommission[]` | `setCommissions`, `updateCommissionInStore` |
| `payouts` | `IPayout[]` | `setPayouts`, `updatePayoutInStore` |
| `summary` | `ICommissionSummary` | `setSummary` |

### Database Tables

**`commission_rates`**
- `id`, `rep_id` (FK → profiles), `set_by` (FK → profiles), `rate_percent`, `override_percent`, `effective_from`, `effective_to` (NULL = active), `created_at`, `updated_at`
- Active rate query: `.eq("rep_id", repId).is("effective_to", null)`

**`commissions`**
- `id`, `order_id` (FK → orders), `rep_id` (FK → profiles), `type` (direct|override), `order_amount`, `rate_percent` (snapshotted), `commission_amount`, `adjustment`, `final_amount` (generated: commission_amount + adjustment), `status` (pending|approved|paid|void), `payout_period` (YYYY-MM), `paid_at`, `notes`, `created_at`, `updated_at`

**`payouts`**
- `id`, `rep_id` (FK → profiles), `period` (YYYY-MM), `total_amount`, `status` (draft|approved|paid), `paid_at`, `paid_by` (FK → profiles), `notes`, `created_at`, `updated_at`
- Unique constraint on `(rep_id, period)` — enforced via upsert

### UI Sections

| Section | Component | Description |
|---------|-----------|-------------|
| KPI Row | `page.tsx` | Total Earned, Pending Approval, Total Paid, Current Rate |
| Commission Calculator | `CommissionCalculator.tsx` | Estimate tool; pre-fills from `summary.currentRate` |
| Rate Management | `RateManagement.tsx` | Rates table per rep; "Set Rate" dialog (rep select, rate %, override %) |
| Commission Ledger | `CommissionLedger.tsx` | Full commission table; period filter; bulk approve; per-row adjust; CSV export |
| Payouts | `PayoutTable.tsx` | Monthly payout batches; "Mark Paid" per approved payout; rep selector (derived from approved commissions in current period) + "Generate Payout" button |

### Webhook Integration
`calculateOrderCommission` is called non-blocking (wrapped in try/catch) after:
- `checkout.session.completed` — inside `!wasAlreadyPaid && didMarkPaid` guard
- `checkout.session.async_payment_succeeded` — inside same guard
- `invoice.paid` — after receipt email hook in `handleInvoicePaid`

**File references:**
- `lib/stripe/payments/handle-checkout-webhook.ts` → `calculateCommissionSafely`
- `lib/stripe/invoices/handle-stripe-invoice-webhook.ts` → `calculateCommissionSafely`

### Edge Cases
- Commission calculation is idempotent: explicit pre-checks query for existing `(order_id, rep_id, type)` before inserting; unique DB index `commissions_order_rep_type_uidx` is the final backstop.
- $0 orders are skipped before any DB writes; $0 override amounts are skipped before the override pre-check.
- Override commissions are only created if the rep has a parent in `rep_hierarchy` AND the parent has an active rate with `override_percent > 0`.
- `final_amount` is a DB generated column (`commission_amount + adjustment`); UI falls back to `commission_amount + adjustment` when null.
- Payout `generatePayout` uses upsert — calling it twice for the same rep+period updates the total rather than creating duplicates.
- Rate insert-first-then-close: if the insert fails, the prior active rate is unchanged. If the close step fails, the new rate is still active; a future `setCommissionRate` call will close the orphaned rate.
- `CommissionCalculator` initializes commission rate to `5` as a default, then syncs to `summary.currentRate` via `useEffect` once Redux hydrates — avoids stale `useState` initialization from null Redux state on first render.
