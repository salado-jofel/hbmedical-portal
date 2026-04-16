# Demo Data Seed — Spec

**Date:** 2026-04-16
**Scope:** One additive Supabase migration that seeds enough historical and state-diverse demo data so every chart, KPI, filter, and widget we've built actually has something to render. **No deletions, no schema changes, no product additions.** All seeded rows use deterministic UUIDs with a recognizable prefix so they can be cleanly rolled back with a single `DELETE` statement.

---

## 1. Overview

The current database has 46 orders all in April 2026, zero delivered/shipped, no tasks, 1 contact, 1 activity, and only one top-level rep with one sub-rep. Most of the dashboards we built stay empty. This seed adds:

- **3 new sales reps** (so there are 2 top-level reps and multiple sub-reps to demonstrate hierarchy)
- **3 new clinical providers** + **2 clinical staff**
- **6 additional clinic facilities** spread across reps
- **30 patients**, **20 contacts** across those facilities
- **100 orders** spanning Nov 2025 → Apr 2026 with full status mix (including **delivered**)
- **Order items** using the existing `ossFx Surgical Matrix Test` product (per user instruction — don't seed new products)
- **Commissions** matching the delivered/paid orders, with monthly payout rows
- **Quotas** backfilled for prior months
- **Commission rates** for the new reps
- **30 activities** Feb–Apr 2026
- **20 tasks** with overdue / due-this-week / future mix

---

## 2. Guardrails (non-negotiable)

### 2.1 Additive only
No `DELETE`, no `UPDATE` of existing rows, no `DROP`, no `ALTER`. Only `INSERT`. Every statement uses `ON CONFLICT (id) DO NOTHING` so re-running the migration is idempotent.

### 2.2 Deterministic UUID marker
All seeded rows use UUIDs starting with the prefix `aaaaaaaa-` (first block = `aaaaaaaa`). Second block encodes the table, third block encodes the row type, fourth+fifth blocks encode the index.

Example:
- Profile (rep): `aaaaaaaa-0001-0001-0000-000000000001`
- Profile (provider): `aaaaaaaa-0001-0002-0000-000000000001`
- Facility: `aaaaaaaa-0002-0000-0000-000000000001`
- Patient: `aaaaaaaa-0003-0000-0000-000000000001`
- Order: `aaaaaaaa-0004-XXXX-YYYY-MMMMMMMMMMMM` (XXXX=month, YYYY=status, MMMM=idx)
- Order item: `aaaaaaaa-0005-...`
- Activity: `aaaaaaaa-0006-...`
- Task: `aaaaaaaa-0007-...`
- Contact: `aaaaaaaa-0008-...`
- Commission: `aaaaaaaa-0009-...`
- Payout: `aaaaaaaa-000a-...`
- rep_hierarchy: `aaaaaaaa-000b-...`
- sales_quota: `aaaaaaaa-000c-...`
- commission_rate: `aaaaaaaa-000d-...`

**Rollback:** one-liner — `DELETE FROM <table> WHERE id::text LIKE 'aaaaaaaa-%';` per table in reverse FK order. Captured in a "down migration" note at the end.

### 2.3 Auth accounts + provider pincodes (loginable)

Seeded users are **loginable**. For each seeded profile:

1. **`auth.users` row** — same `id` as `profiles.id`, password hashed with bcrypt:
   ```sql
   INSERT INTO auth.users (
     id, aud, role, email, encrypted_password, email_confirmed_at, confirmed_at,
     raw_app_meta_data, raw_user_meta_data,
     is_sso_user, is_anonymous, created_at, updated_at
   ) VALUES (
     'aaaaaaaa-...',
     'authenticated', 'authenticated',
     'seed.rep.alice@example.com',
     crypt('test123!', gen_salt('bf')),   -- bcrypt default cost (10)
     NOW(), NOW(),
     '{"provider":"email","providers":["email"]}',
     '{}',
     false, false, NOW(), NOW()
   ) ON CONFLICT (id) DO NOTHING;
   ```

2. **`auth.identities` row** — Supabase Auth requires this for email-provider users:
   ```sql
   INSERT INTO auth.identities (
     id, user_id, provider, provider_id, identity_data, email, created_at, updated_at
   ) VALUES (
     gen_random_uuid(),
     'aaaaaaaa-...',
     'email', 'aaaaaaaa-...',   -- provider_id = user id for email provider
     jsonb_build_object('sub','aaaaaaaa-...','email','seed.rep.alice@example.com','email_verified',true),
     'seed.rep.alice@example.com',
     NOW(), NOW()
   ) ON CONFLICT DO NOTHING;
   ```

3. **`provider_credentials` row** — only for clinical providers, with pincode `1111` bcrypt-hashed:
   ```sql
   INSERT INTO provider_credentials (id, user_id, credential, npi_number, pin_hash, baa_signed_at, terms_signed_at)
   VALUES (
     gen_random_uuid(),
     'aaaaaaaa-...',
     'MD', '1234567890',
     crypt('1111', gen_salt('bf', 6)),
     NOW(), NOW()
   ) ON CONFLICT DO NOTHING;
   ```

### 2.4 Auth safety verification

Already checked (Supabase MCP):
- Only 1 trigger on `auth.users` → `on_user_login` fires **AFTER UPDATE** only; **INSERT is clean, no side effects**
- `pgcrypto` (`crypt`, `gen_salt`) is available in the `public`/`extensions` schema and works in migrations
- `auth.identities` has the standard Supabase shape

### 2.5 Credentials (for reference)

| Role | Password | Pincode |
|---|---|---|
| Reps / staff / admins (seeded) | `test123!` | n/a |
| Clinical providers (seeded) | `test123!` | `1111` |

### 2.4 Single migration, single transaction
Supabase wraps each migration in a transaction by default. If any statement fails, the whole thing rolls back — nothing partial gets inserted.

---

## 3. Seeded data plan

### 3.1 Profiles (new: 3 reps + 3 providers + 2 staff = 8 rows)

**Sales reps:**
| ID (tail) | Name | Email | Role | Status | Notes |
|---|---|---|---|---|---|
| `...0001-0001-0000-000000000001` | Alice Nguyen | seed.rep.alice@example.com | sales_representative | active | New top-level rep |
| `...0001-0001-0000-000000000002` | Ben Torres | seed.rep.ben@example.com | sales_representative | active | Sub-rep under Ryan |
| `...0001-0001-0000-000000000003` | Chloe Park | seed.rep.chloe@example.com | sales_representative | active | Sub-rep under Alice (2nd-level downline) |

**Clinical providers:**
| ID (tail) | Name | Email | Role |
|---|---|---|---|
| `...0001-0002-0000-000000000001` | Dr. Evan Reyes | seed.prov.evan@example.com | clinical_provider |
| `...0001-0002-0000-000000000002` | Dr. Mia Kim | seed.prov.mia@example.com | clinical_provider |
| `...0001-0002-0000-000000000003` | Dr. Omar Patel | seed.prov.omar@example.com | clinical_provider |

**Clinical staff:**
| ID (tail) | Name | Email | Role |
|---|---|---|---|
| `...0001-0003-0000-000000000001` | Nina Walsh | seed.staff.nina@example.com | clinical_staff |
| `...0001-0003-0000-000000000002` | Greg Ito | seed.staff.greg@example.com | clinical_staff |

### 3.2 Rep hierarchy (new: 2 edges)

- Ryan (existing) → Ben (new) — adds a 2nd sub-rep beneath Ryan
- Alice (new) → Chloe (new) — creates a 2nd top-level rep with their own sub-rep

### 3.3 Commission rates (new: 3 rows)

One current rate per new rep so the commission ledger works immediately:
- Alice: 5% / 0% override
- Ben: 4% / 1% override (Ryan's override)
- Chloe: 4% / 1% override (Alice's override)

### 3.4 Facilities (new: 6 clinics, distributed)

| Name | City, State | Assigned rep |
|---|---|---|
| Desert Vista Wound Care | Phoenix, AZ | Alice (new top-level rep) |
| Cactus Canyon Clinic | Tucson, AZ | Alice |
| Lakeshore Wound Specialists | Chicago, IL | Ben (new sub-rep of Ryan) |
| Harbor Point Medical | Portland, OR | Ben |
| Bluegrass Wound Care | Louisville, KY | Chloe (new sub-rep of Alice) |
| Piedmont Surgical Associates | Raleigh, NC | Chloe |

All `facility_type='clinic'`, `status='active'`.

### 3.5 Patients (new: 30, 5 per new facility)

Realistic first/last names, mix of DOBs (adults 30–80), `is_active=true`.

### 3.6 Contacts (new: 20, ~3 per new facility + 2 for each existing clinic)

Titles: "Practice Manager", "Front Desk", "Billing Lead", "Medical Assistant", "Office Manager". Realistic emails/phones, `is_active=true`, `preferred_contact` rotates email/phone/either.

### 3.7 Orders (new: 100 orders, distributed historically)

Distribution by month (placed_at):

| Month | Orders | Rationale |
|---|---|---|
| Nov 2025 | 8 | Oldest data; older delivered orders |
| Dec 2025 | 10 | Holiday lull |
| Jan 2026 | 14 | Ramp up |
| Feb 2026 | 18 | Growth |
| Mar 2026 | 22 | More growth |
| Apr 2026 | 28 | Current month — mix of statuses (including in-flight) |

Status mix (percentages of the 100 total):
- **Delivered** (35) — `order_status=delivered`, `payment_status=paid`, `delivery_status=delivered`, `paid_at` and `delivered_at` set. Distributed Nov 2025 → Mar 2026 (very few in Apr since they usually take time to deliver).
- **Shipped** (15) — `shipped`, `paid`, `shipped`. Late Mar through Apr.
- **Approved** (15) — `approved`, `paid`, `not_shipped`. Apr.
- **Manufacturer review** (10) — `manufacturer_review`, `pending`. Mid-Apr.
- **Pending signature** (8) — `pending_signature`, `pending`. Mid-Apr.
- **Additional info needed** (5) — `additional_info_needed`, `pending`. Apr.
- **Draft** (8) — `draft`, `pending`. Apr (not counted as signed).
- **Canceled** (4) — `canceled`, `pending`. Spread Feb–Apr.

Each order:
- `facility_id` picked from seed facilities weighted by rep activity (top reps get more orders)
- `created_by` = facility's assigned rep
- `signed_by` / `signed_at` set if status ≠ draft
- `patient_id` from seed patients of that facility
- `assigned_provider_id` from seed providers (random pick)
- `wound_type` random pick: `chronic`/`acute`/`surgical`
- `date_of_service` = `placed_at::date`
- `order_number` = `SEED-<YYYYMMDD>-<4-char>` to distinguish from real orders

### 3.8 Order items (new: 100, one per order)

All point to the existing `ossFx Surgical Matrix Test` product (`product_id=7d9b5546-128b-407b-964a-7660db604472`, `unit_price=1490`). Quantity 1 per order. `total_amount=1490`, `subtotal=1490`. Matches what the real UI already shows.

### 3.9 Commissions (new: ~65, one per delivered + approved + shipped order)

Generated after orders:
- For each order with `order_status IN ('delivered','shipped','approved')` (i.e. statuses that carry a payment), create a commission row
- `type='direct'`, `order_amount=1490`, `rate_percent` = the rep's current rate (5% for Ryan, 3% for Ricky, 5% for Alice, 4% for Ben, 4% for Chloe)
- `commission_amount = order_amount × rate_percent / 100`
- `status`: orders delivered before April → `paid`, April → `pending`
- `payout_period` = `YYYY-MM` of `placed_at`

### 3.10 Payouts (new: 6 rows)

One per monthly period where commissions exist:
- Nov 2025: `status=paid`, sum of Nov commissions
- Dec 2025: `status=paid`
- Jan 2026: `status=paid`
- Feb 2026: `status=paid`
- Mar 2026: `status=paid`
- Apr 2026: `status=pending`

`paid_by` = admin profile (Alex Morgan, existing).

### 3.11 Quotas (new: 10, backfill)

For Ryan and Ricky for months Nov 2025 → Mar 2026 (5 months × 2 reps = 10 rows). Targets: Ryan $25k, Ricky $20k (matching their current April targets). Plus current-month quotas for Alice / Ben / Chloe.

- Alice Apr 2026: $22,000
- Ben Apr 2026: $15,000
- Chloe Apr 2026: $15,000

### 3.12 Activities (new: 30 rows)

Spread Feb–Apr 2026 across the new facilities. Mix of types (`call`, `email`, `visit`, `meeting`), outcomes (`positive`, `neutral`, `follow_up_needed`), logged by the facility's assigned rep.

### 3.13 Tasks (new: 20 rows)

Assigned to the three existing reps + Alice/Ben/Chloe. Split:
- 5 overdue (due_date in the past, status=open) → shows up in Today's Focus red group
- 8 due this week (due_date in next 7 days, status=open) → gold group
- 4 future (> 1 week out, status=open)
- 3 completed (status=completed)

Titles like "Follow up on Q2 quote", "Schedule product demo", "Send pricing to Mia Kim", etc.

---

## 4. Execution order (FK-safe)

1. **auth.users** (seeded users — password bcrypt-hashed)
2. **auth.identities** (email-provider identity row per user)
3. **profiles** (same id as auth.users row)
4. **provider_credentials** (only for clinical providers — pincode bcrypt-hashed)
5. commission_rates (for new reps)
6. rep_hierarchy
7. facilities
8. patients
9. contacts
10. activities (depends on facilities + profiles)
11. tasks (depends on profiles + facilities)
12. orders (depends on facilities + patients + profiles)
13. order_items (depends on orders)
14. commissions (depends on orders + profiles)
15. payouts (depends on profiles)
16. sales_quotas

---

## 5. Rollback plan

One SQL block — execute as a separate migration if ever needed:

```sql
BEGIN;
DELETE FROM sales_quotas         WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM payouts              WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM commissions          WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM order_items          WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM orders               WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM tasks                WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM activities           WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM contacts             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM patients             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM facilities           WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM rep_hierarchy        WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM commission_rates     WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM provider_credentials WHERE user_id::text LIKE 'aaaaaaaa-%';
DELETE FROM profiles             WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM auth.identities      WHERE user_id::text LIKE 'aaaaaaaa-%';
DELETE FROM auth.users           WHERE id::text LIKE 'aaaaaaaa-%';
COMMIT;
```

Included as an inline comment at the top of the migration file so it's always handy.

---

## 6. Verification (after applying)

After the seed runs, these queries should return expected counts:

```sql
SELECT COUNT(*) FROM profiles WHERE id::text LIKE 'aaaaaaaa-%';         -- 8
SELECT COUNT(*) FROM facilities WHERE id::text LIKE 'aaaaaaaa-%';       -- 6
SELECT COUNT(*) FROM orders WHERE id::text LIKE 'aaaaaaaa-%';           -- 100
SELECT COUNT(*) FROM orders WHERE id::text LIKE 'aaaaaaaa-%' AND order_status='delivered';  -- 35
SELECT COUNT(*) FROM tasks WHERE id::text LIKE 'aaaaaaaa-%';            -- 20
SELECT COUNT(*) FROM commissions WHERE id::text LIKE 'aaaaaaaa-%';     -- ~65
```

And the dashboards should now show: real revenue trend line, pipeline funnel with all statuses, top accounts ranked, tier badges (A/B/C), today's focus with overdue/week tasks, admin hierarchy tree with 2 root reps.

---

## 7. Out of Scope
- **Products** — not touched per user instruction; order items continue to use `ossFx Surgical Matrix Test`
- **Invoices / payments** — not seeded; commissions alone are enough for the dashboards
- **Stripe webhook events, shipments, provider_credentials, facility_enrollment, invite_tokens, order_documents, order_form, order_form_1500, order_history, order_ivr, order_messages, message_reads, notifications, payments, training_materials, contract_materials, hospital_onboarding_materials, marketing_materials** — not needed to populate dashboards
- **auth.users** — no new users created; seeded profiles are display-only
- **Updating existing rows** — the current 46 orders / 1 contact / 1 activity stay exactly as they are

---

## 8. Open concerns

- **Order `order_number` collisions.** Existing orders use format `HBM-YYYYMMDD-XXXX`. Seeded use `SEED-YYYYMMDD-XXXX`. If the column has a UNIQUE constraint, the `SEED-` prefix avoids collisions.
- **Commission math assumes a flat rate per rep.** The real commission logic may differ per rate-change-date; the seed simplifies by using one rate per rep across all their orders. Acceptable for demo purposes.
- **`auth.users` insert compatibility.** Supabase-managed projects tolerate direct inserts to `auth.users` as long as no INSERT trigger fires (verified — only an AFTER UPDATE trigger exists). If Supabase later adds an INSERT trigger on `auth.users`, this migration would need to be revisited. Low risk.
- **`has_completed_setup`.** New rep/provider profiles will be seeded with `has_completed_setup=true` so they skip the onboarding wizard when first opened (otherwise the UI would push them to `/onboarding/setup` on login).
