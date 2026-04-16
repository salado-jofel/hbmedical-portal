# Demo Data Seed — Implementation Plan

> **For agentic workers:** This plan applies ONE large Supabase migration via `mcp__claude_ai_Supabase__apply_migration`. Each task below assembles a section of the migration. The final task applies it. **Do NOT run `git commit` or `git add`.** No files are modified on disk; the only artifact is the migration in Supabase's migration history.

**Goal:** Apply a single additive migration that seeds: 8 loginable users (3 sales reps, 3 clinical providers, 2 staff) with `test123!` password and provider pincode `1111`; 6 clinics; 30 patients; 20 contacts; 30 activities; 20 tasks; 100 orders across Nov 2025 → Apr 2026 with full status mix and 35 delivered; commissions, payouts, backfilled quotas, and commission rates for new reps.

**Architecture:** All seeded rows use deterministic UUIDs prefixed `aaaaaaaa-…`. Single migration executes in a transaction — if any statement fails, the whole thing rolls back. Rollback at any time via a copy-paste DELETE block.

**Execution environment:** Supabase project `ersdsmuybpfvgvaiwcgl`. Target tables listed in the seed spec at `docs/superpowers/specs/2026-04-16-demo-data-seed.md`.

---

## Overview

This plan is executed directly against the live database via the Supabase MCP server. Unlike code plans, there are no files to edit. The "tasks" below chunk the work into manageable SQL sections that can be reviewed before the final `apply_migration` call.

---

## Task 1: Verify baseline before seeding

- [ ] **Step 1: Capture current row counts**

Run via `execute_sql`:

```sql
SELECT 'profiles' AS t, COUNT(*) FROM profiles
UNION ALL SELECT 'facilities', COUNT(*) FROM facilities
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'commissions', COUNT(*) FROM commissions
UNION ALL SELECT 'payouts', COUNT(*) FROM payouts
UNION ALL SELECT 'sales_quotas', COUNT(*) FROM sales_quotas
UNION ALL SELECT 'commission_rates', COUNT(*) FROM commission_rates
UNION ALL SELECT 'rep_hierarchy', COUNT(*) FROM rep_hierarchy
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'activities', COUNT(*) FROM activities
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'provider_credentials', COUNT(*) FROM provider_credentials
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
ORDER BY 1;
```

Record the numbers — after seeding, verify each table's count increased by the expected amount.

- [ ] **Step 2: Confirm no existing rows clash with the `aaaaaaaa-%` prefix**

```sql
SELECT 'profiles' AS t, COUNT(*) FROM profiles WHERE id::text LIKE 'aaaaaaaa-%'
UNION ALL SELECT 'facilities', COUNT(*) FROM facilities WHERE id::text LIKE 'aaaaaaaa-%'
UNION ALL SELECT 'orders', COUNT(*) FROM orders WHERE id::text LIKE 'aaaaaaaa-%';
```

Expected: all zeros. If any row exists, STOP and resolve before seeding (might be a prior partial seed).

---

## Task 2: Build the migration — Section A (Auth + Profiles)

This section creates 8 auth.users rows, their identities, profiles, and provider_credentials for the clinical providers.

- [ ] **Step 1: Assemble SQL for auth.users inserts**

```sql
-- ============================================================
--  Seeded auth.users (password: test123! bcrypt-hashed)
-- ============================================================
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at
) VALUES
  ('aaaaaaaa-0001-0001-0000-000000000001', 'authenticated','authenticated','seed.rep.alice@example.com',    crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000002', 'authenticated','authenticated','seed.rep.ben@example.com',      crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000003', 'authenticated','authenticated','seed.rep.chloe@example.com',    crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000001', 'authenticated','authenticated','seed.prov.evan@example.com',    crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000002', 'authenticated','authenticated','seed.prov.mia@example.com',     crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000003', 'authenticated','authenticated','seed.prov.omar@example.com',    crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000001', 'authenticated','authenticated','seed.staff.nina@example.com',   crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000002', 'authenticated','authenticated','seed.staff.greg@example.com',   crypt('test123!', gen_salt('bf')), NOW(), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  Seeded auth.identities (email provider)
-- ============================================================
INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, email, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  'email',
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  u.email,
  NOW(), NOW()
FROM auth.users u
WHERE u.id::text LIKE 'aaaaaaaa-%'
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email');

-- ============================================================
--  Seeded profiles
-- ============================================================
INSERT INTO profiles (id, email, first_name, last_name, phone, role, status, has_completed_setup, created_at, updated_at) VALUES
  ('aaaaaaaa-0001-0001-0000-000000000001','seed.rep.alice@example.com','Alice','Nguyen','555-0101','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000002','seed.rep.ben@example.com',  'Ben',  'Torres', '555-0102','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000003','seed.rep.chloe@example.com','Chloe','Park',   '555-0103','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000001','seed.prov.evan@example.com','Dr. Evan','Reyes','555-0201','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000002','seed.prov.mia@example.com', 'Dr. Mia','Kim',   '555-0202','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000003','seed.prov.omar@example.com','Dr. Omar','Patel','555-0203','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000001','seed.staff.nina@example.com','Nina','Walsh',  '555-0301','clinical_staff','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000002','seed.staff.greg@example.com','Greg','Ito',    '555-0302','clinical_staff','active', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  Seeded provider_credentials (pincode: 1111)
-- ============================================================
INSERT INTO provider_credentials (id, user_id, credential, npi_number, pin_hash, baa_signed_at, terms_signed_at, created_at, updated_at) VALUES
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000001','MD','2222222221', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000002','DO','2222222222', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000003','MD','2222222223', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;
```

---

## Task 3: Build the migration — Section B (Rep hierarchy, rates, quotas)

- [ ] **Step 1: Assemble SQL**

```sql
-- ============================================================
--  Seeded rep_hierarchy
--  Ryan (existing) -> Ben (new sub-rep)
--  Alice (new top-level) -> Chloe (new sub-rep)
-- ============================================================
INSERT INTO rep_hierarchy (id, parent_rep_id, child_rep_id, created_by, created_at) VALUES
  ('aaaaaaaa-000b-0000-0000-000000000001','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','aaaaaaaa-0001-0001-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953', NOW()),
  ('aaaaaaaa-000b-0000-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000001', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  Seeded commission_rates (current rate per new rep)
-- ============================================================
INSERT INTO commission_rates (id, rep_id, set_by, rate_percent, override_percent, effective_from, effective_to, created_at, updated_at) VALUES
  ('aaaaaaaa-000d-0000-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','bafaa688-4862-427f-a3f6-b9873ab603f2', 5.00, 0.00, '2025-11-01', NULL, NOW(), NOW()),
  ('aaaaaaaa-000d-0000-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953', 4.00, 1.00, '2025-11-01', NULL, NOW(), NOW()),
  ('aaaaaaaa-000d-0000-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000001', 4.00, 1.00, '2025-11-01', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  Seeded sales_quotas (backfill Nov-Mar for Ryan/Ricky + April for new reps)
-- ============================================================
INSERT INTO sales_quotas (id, rep_id, set_by, period, target_amount, notes, created_at, updated_at) VALUES
  ('aaaaaaaa-000c-0000-0000-000000000001','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','bafaa688-4862-427f-a3f6-b9873ab603f2','2025-11', 25000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','bafaa688-4862-427f-a3f6-b9873ab603f2','2025-12', 25000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000003','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','bafaa688-4862-427f-a3f6-b9873ab603f2','2026-01', 25000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000004','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','bafaa688-4862-427f-a3f6-b9873ab603f2','2026-02', 25000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000005','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','bafaa688-4862-427f-a3f6-b9873ab603f2','2026-03', 25000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000006','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2025-11', 20000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000007','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2025-12', 20000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000008','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2026-01', 20000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-000000000009','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2026-02', 20000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-00000000000a','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2026-03', 20000, 'Backfill', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-00000000000b','aaaaaaaa-0001-0001-0000-000000000001','bafaa688-4862-427f-a3f6-b9873ab603f2','2026-04', 22000, 'Apr target', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-00000000000c','aaaaaaaa-0001-0001-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','2026-04', 15000, 'Apr target', NOW(), NOW()),
  ('aaaaaaaa-000c-0000-0000-00000000000d','aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000001','2026-04', 15000, 'Apr target', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## Task 4: Build the migration — Section C (Facilities, patients, contacts)

- [ ] **Step 1: Facilities (6 new clinics)**

```sql
INSERT INTO facilities (id, name, city, state, country, address_line_1, postal_code, facility_type, assigned_rep, status, contact, phone, created_at, updated_at) VALUES
  ('aaaaaaaa-0002-0000-0000-000000000001','Desert Vista Wound Care',     'Phoenix','AZ','USA','101 Sun Blvd',      '85001','clinic','aaaaaaaa-0001-0001-0000-000000000001','active','Dr. Evan Reyes','602-555-1001', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000002','Cactus Canyon Clinic',        'Tucson', 'AZ','USA','202 Saguaro Dr',    '85701','clinic','aaaaaaaa-0001-0001-0000-000000000001','active','Dr. Mia Kim',  '520-555-1002', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000003','Lakeshore Wound Specialists', 'Chicago','IL','USA','303 Lake Shore Dr', '60601','clinic','aaaaaaaa-0001-0001-0000-000000000002','active','Dr. Omar Patel','312-555-1003', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000004','Harbor Point Medical',        'Portland','OR','USA','404 Harbor Way',   '97201','clinic','aaaaaaaa-0001-0001-0000-000000000002','active','Dr. Evan Reyes','503-555-1004', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000005','Bluegrass Wound Care',        'Louisville','KY','USA','505 Derby Ln',   '40201','clinic','aaaaaaaa-0001-0001-0000-000000000003','active','Dr. Mia Kim',  '502-555-1005', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000006','Piedmont Surgical Associates','Raleigh','NC','USA','606 Oak Ridge Rd',  '27601','clinic','aaaaaaaa-0001-0001-0000-000000000003','active','Dr. Omar Patel','919-555-1006', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Patients (30, 5 per new facility)**

```sql
INSERT INTO patients (id, facility_id, first_name, last_name, date_of_birth, patient_ref, is_active, created_at, updated_at) VALUES
  -- Desert Vista (facility 01)
  ('aaaaaaaa-0003-0001-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001','Amanda','Clark', '1962-03-11','DV-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000001','Brian',  'Diaz',  '1958-07-23','DV-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000001','Carol',  'Evans', '1970-12-05','DV-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000001','Derek',  'Fox',   '1965-01-18','DV-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000001','Elena',  'Gomez', '1975-09-28','DV-0005', true, NOW(), NOW()),
  -- Cactus Canyon (facility 02)
  ('aaaaaaaa-0003-0002-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000002','Frank',  'Hale',  '1952-04-17','CC-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000002','Gina',   'Ivanov','1967-06-09','CC-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000002','Henry',  'Jones', '1961-11-30','CC-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000002','Isabel', 'Kent',  '1948-02-14','CC-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000002','Jack',   'Lopez', '1972-08-21','CC-0005', true, NOW(), NOW()),
  -- Lakeshore (facility 03)
  ('aaaaaaaa-0003-0003-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000003','Karen',  'Mendez','1955-05-03','LS-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000003','Leo',    'Nash',  '1963-10-11','LS-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000003','Maria',  'Ortiz', '1978-03-24','LS-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000003','Nathan', 'Pryor', '1959-07-01','LS-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000003','Olga',   'Quinn', '1966-12-19','LS-0005', true, NOW(), NOW()),
  -- Harbor Point (facility 04)
  ('aaaaaaaa-0003-0004-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000004','Peter',  'Ross',  '1970-01-29','HP-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000004','Quinn',  'Shah',  '1953-04-08','HP-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000004','Rachel', 'Tran',  '1969-09-15','HP-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000004','Sam',    'Umar',  '1962-02-22','HP-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000004','Tina',   'Vega',  '1957-11-07','HP-0005', true, NOW(), NOW()),
  -- Bluegrass (facility 05)
  ('aaaaaaaa-0003-0005-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000005','Uma',    'Wallis','1964-06-25','BG-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000005','Victor', 'Xu',    '1950-03-13','BG-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000005','Wendy',  'Young', '1973-08-02','BG-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000005','Xavier', 'Zane',  '1968-12-27','BG-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000005','Yvonne', 'Alder', '1955-05-16','BG-0005', true, NOW(), NOW()),
  -- Piedmont (facility 06)
  ('aaaaaaaa-0003-0006-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000006','Zack',   'Baker', '1961-01-04','PM-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000006','Abby',   'Cross', '1975-07-31','PM-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000006','Blake',  'Dunn',  '1967-10-20','PM-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000006','Cara',   'Ellis', '1952-04-12','PM-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000006','Dan',    'Frost', '1970-09-06','PM-0005', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Contacts (20 spread across the 6 new clinics)**

```sql
INSERT INTO contacts (id, facility_id, first_name, last_name, title, email, phone, preferred_contact, is_active, created_at, updated_at) VALUES
  ('aaaaaaaa-0008-0000-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001','Rebecca','Lane','Practice Manager','rlane@desertvista.test','602-555-2001','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000001','Tom',    'Reid','Front Desk',      'treid@desertvista.test','602-555-2002','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000001','Gina',   'Best','Billing Lead',    'gbest@desertvista.test','602-555-2003','email', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000002','Paul',   'Meyer','Office Manager','pmeyer@cactuscanyon.test','520-555-2004','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000002','Linda',  'Pike', 'Medical Assistant','lpike@cactuscanyon.test','520-555-2005','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000006','aaaaaaaa-0002-0000-0000-000000000002','Keith',  'Roy',  'Front Desk',    'kroy@cactuscanyon.test','520-555-2006','either', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-000000000007','aaaaaaaa-0002-0000-0000-000000000003','Nancy',  'Shaw', 'Practice Manager','nshaw@lakeshore.test','312-555-2007','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000008','aaaaaaaa-0002-0000-0000-000000000003','Emily',  'Tate', 'Billing Lead',  'etate@lakeshore.test','312-555-2008','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000009','aaaaaaaa-0002-0000-0000-000000000003','Ron',    'Uhl',  'Front Desk',    'ruhl@lakeshore.test', '312-555-2009','phone', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-00000000000a','aaaaaaaa-0002-0000-0000-000000000004','Diana',  'Vance','Practice Manager','dvance@harborpoint.test','503-555-2010','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000b','aaaaaaaa-0002-0000-0000-000000000004','Greg',   'West', 'Office Manager','gwest@harborpoint.test','503-555-2011','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000c','aaaaaaaa-0002-0000-0000-000000000004','Cindy',  'Yoho', 'Medical Assistant','cyoho@harborpoint.test','503-555-2012','email', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-00000000000d','aaaaaaaa-0002-0000-0000-000000000005','Owen',   'Ash',  'Practice Manager','oash@bluegrass.test','502-555-2013','either', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000e','aaaaaaaa-0002-0000-0000-000000000005','Mia',    'Burch','Billing Lead',  'mburch@bluegrass.test','502-555-2014','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000f','aaaaaaaa-0002-0000-0000-000000000005','Eric',   'Cove', 'Front Desk',    'ecove@bluegrass.test',  '502-555-2015','phone', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-000000000010','aaaaaaaa-0002-0000-0000-000000000006','Lynn',   'Drake','Practice Manager','ldrake@piedmont.test','919-555-2016','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000011','aaaaaaaa-0002-0000-0000-000000000006','Dave',   'Ewing','Medical Assistant','dewing@piedmont.test','919-555-2017','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000012','aaaaaaaa-0002-0000-0000-000000000006','Ruth',   'Flynn','Office Manager','rflynn@piedmont.test','919-555-2018','email', true, NOW(), NOW()),

  ('aaaaaaaa-0008-0000-0000-000000000013','aaaaaaaa-0002-0000-0000-000000000001','Anna',   'Garza','Medical Assistant','agarza@desertvista.test','602-555-2019','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000014','aaaaaaaa-0002-0000-0000-000000000003','Marco',  'Hart', 'Office Manager','mhart@lakeshore.test','312-555-2020','email', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## Task 5: Build the migration — Section D (Activities + Tasks)

- [ ] **Step 1: Activities (30 spread Feb–Apr 2026)**

Assemble 30 rows using a `SELECT` with `generate_series` and modulo-picking of facility + rep + activity_type + outcome. Pattern:

```sql
INSERT INTO activities (id, facility_id, contact_id, logged_by, type, activity_date, outcome, notes, created_at, updated_at)
SELECT
  ('aaaaaaaa-0006-0000-0000-' || lpad(i::text, 12, '0'))::uuid AS id,
  (ARRAY[
    'aaaaaaaa-0002-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0002-0000-0000-000000000002'::uuid,
    'aaaaaaaa-0002-0000-0000-000000000003'::uuid,
    'aaaaaaaa-0002-0000-0000-000000000004'::uuid,
    'aaaaaaaa-0002-0000-0000-000000000005'::uuid,
    'aaaaaaaa-0002-0000-0000-000000000006'::uuid
  ])[((i - 1) % 6) + 1] AS facility_id,
  NULL AS contact_id,
  (ARRAY[
    'aaaaaaaa-0001-0001-0000-000000000001'::uuid, -- Alice
    'aaaaaaaa-0001-0001-0000-000000000001'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000002'::uuid, -- Ben
    'aaaaaaaa-0001-0001-0000-000000000002'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000003'::uuid, -- Chloe
    'aaaaaaaa-0001-0001-0000-000000000003'::uuid
  ])[((i - 1) % 6) + 1] AS logged_by,
  (ARRAY['call','email','visit','meeting'])[((i - 1) % 4) + 1] AS type,
  (CURRENT_DATE - ((60 - i) || ' days')::interval)::date AS activity_date,
  (ARRAY['positive','neutral','follow_up_needed','neutral'])[((i - 1) % 4) + 1] AS outcome,
  'Seeded activity #' || i AS notes,
  NOW(), NOW()
FROM generate_series(1, 30) AS i
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Tasks (20 with mix of overdue/this-week/future/completed)**

```sql
INSERT INTO tasks (id, facility_id, contact_id, created_by, assigned_to, title, due_date, priority, status, notes, reminder_sent, created_at, updated_at) VALUES
  -- 5 OVERDUE (past due_date, status=open)
  ('aaaaaaaa-0007-0000-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Follow up on Q2 quote', (CURRENT_DATE - INTERVAL '5 days')::date, 'high',  'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000002',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Send pricing to Dr. Mia Kim', (CURRENT_DATE - INTERVAL '2 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Confirm inventory for next shipment', (CURRENT_DATE - INTERVAL '1 days')::date, 'high', 'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000004','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Renew service agreement',              (CURRENT_DATE - INTERVAL '7 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Call back about product demo',           (CURRENT_DATE - INTERVAL '3 days')::date, 'high',  'open', NULL, false, NOW(), NOW()),

  -- 8 DUE THIS WEEK (due_date in next 7 days, status=open)
  ('aaaaaaaa-0007-0000-0000-000000000006','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Product training session', (CURRENT_DATE + INTERVAL '1 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000007','aaaaaaaa-0002-0000-0000-000000000002',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Submit onboarding docs',    (CURRENT_DATE + INTERVAL '2 days')::date, 'low',   'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000008','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Review pricing update',     (CURRENT_DATE + INTERVAL '3 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000009','aaaaaaaa-0002-0000-0000-000000000004',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Schedule quarterly check-in', (CURRENT_DATE + INTERVAL '4 days')::date, 'low',  'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000a','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Send sample packet',        (CURRENT_DATE + INTERVAL '5 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000b','aaaaaaaa-0002-0000-0000-000000000006',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Coordinate delivery window',(CURRENT_DATE + INTERVAL '6 days')::date, 'high', 'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000c','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Hand off admin onboarding', (CURRENT_DATE + INTERVAL '4 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000d','1327339c-7668-41d3-a499-7250b50b79de',NULL,'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','Email Ricky sub-rep',       (CURRENT_DATE + INTERVAL '2 days')::date, 'medium','open', NULL, false, NOW(), NOW()),

  -- 4 FUTURE (>1 week out)
  ('aaaaaaaa-0007-0000-0000-00000000000e','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Annual business review',     (CURRENT_DATE + INTERVAL '21 days')::date, 'low','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000f','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Plan lunch-and-learn',      (CURRENT_DATE + INTERVAL '14 days')::date, 'low','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000010','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Prepare customer satisfaction survey',(CURRENT_DATE + INTERVAL '28 days')::date,'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000011','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Review commission structure',(CURRENT_DATE + INTERVAL '10 days')::date, 'low','open', NULL, false, NOW(), NOW()),

  -- 3 COMPLETED
  ('aaaaaaaa-0007-0000-0000-000000000012','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Initial facility visit',    (CURRENT_DATE - INTERVAL '20 days')::date, 'medium','completed', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000013','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Contract signed',           (CURRENT_DATE - INTERVAL '15 days')::date, 'high',  'completed', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000014','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','First order placed',        (CURRENT_DATE - INTERVAL '10 days')::date, 'medium','completed', NULL, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## Task 6: Build the migration — Section E (Orders + Order Items)

100 orders spread across 6 months with status mix. Using generated SQL to keep this compact.

- [ ] **Step 1: Orders inserted via structured VALUES**

The orders insert is large. Assemble as a single multi-row `INSERT … VALUES …` block with ~100 rows covering these cohorts:

**Cohort 1 — Nov 2025 delivered (8 orders)**, all `order_status='delivered'`, `payment_status='paid'`, `delivery_status='delivered'`, `fulfillment_status='delivered'`, `invoice_status='paid'`, `placed_at`, `paid_at`, `delivered_at` set (placed spread across Nov 2–28, paid +3 days, delivered +10 days).

**Cohort 2 — Dec 2025 delivered (10)**: same pattern, Dec 1–30.

**Cohort 3 — Jan 2026 delivered (14)**: Jan 3–31.

**Cohort 4 — Feb 2026 delivered (18)**, including **3 canceled** (order_status='canceled', payment_status='pending', invoice_status='not_applicable'), Feb 1–28.

**Cohort 5 — Mar 2026 mix (22)**: 15 delivered, 4 shipped (`shipped`, `paid`, `shipped`), 2 approved (`approved`, `paid`, `not_shipped`), 1 canceled.

**Cohort 6 — Apr 2026 in-flight mix (28)**:
- 11 shipped (shipped, paid, shipped)
- 13 approved (approved, paid, not_shipped)
- 10 manufacturer_review (manufacturer_review, pending, not_shipped)
- 8 pending_signature (pending_signature, pending, not_shipped)
- 5 additional_info_needed (additional_info_needed, pending, not_shipped)
- 8 draft (draft, pending, not_shipped)

**Important columns on every row:**
- `id` = `aaaaaaaa-0004-<MM>-<status_code>-<idx>` where MM = 2-digit month, status_code = 4-digit status ordinal, idx = 12-char sequence
- `order_number` = `'SEED-' || to_char(placed_at,'YYYYMMDD') || '-' || substr(id::text, 33, 4)`
- `facility_id` cycles across the 6 seeded clinics
- `created_by` = facility's assigned rep
- `signed_by` = same as created_by (NULL if draft), `signed_at` = placed_at (NULL if draft)
- `patient_id` — pick deterministically from that facility's 5 patients using `(index mod 5) + 1`
- `assigned_provider_id` — cycle across 3 seeded providers by index
- `date_of_service` = `placed_at::date`
- `wound_type` — cycle across `['chronic','acute','surgical']` by index
- `order_form_locked` = true for delivered/shipped, false otherwise
- `ai_extracted` = false, `ai_extracted_at` = NULL

Because writing out 100 rows longhand would bloat the file, the implementation subagent should write a single SQL block using either:
1. A CTE with `generate_series` + `VALUES` tables for cohort definitions, or
2. Explicit multi-row `INSERT … VALUES` with 100 rows, programmatically generated by the subagent

Either approach is fine as long as:
- Every order has a unique `aaaaaaaa-…` id
- Every order has a unique `order_number` (`SEED-YYYYMMDD-XXXX`)
- Cohort counts match exactly (sum = 100)
- Dates stay within their month
- `paid_at` > `placed_at`, `delivered_at` > `paid_at` when set

- [ ] **Step 2: Order items (100, one per order)**

Every order gets exactly one order_item, referencing the existing `ossFx Surgical Matrix Test` product (`product_id='7d9b5546-128b-407b-964a-7660db604472'`):

```sql
INSERT INTO order_items (id, order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal, total_amount, created_at, updated_at)
SELECT
  ('aaaaaaaa-0005-0000-0000-' || lpad(row_number() OVER (ORDER BY o.id)::text, 12, '0'))::uuid,
  o.id,
  '7d9b5546-128b-407b-964a-7660db604472',
  'ossFx Surgical Matrix Test',
  'OSSFX',
  1490.00, 1, 0, 0, 1490.00, 1490.00,
  o.created_at, o.updated_at
FROM orders o
WHERE o.id::text LIKE 'aaaaaaaa-0004-%'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);
```

---

## Task 7: Build the migration — Section F (Commissions + Payouts)

- [ ] **Step 1: Commissions — generated from orders where a payout is owed**

For each seeded order in `('delivered','shipped','approved')` status (i.e., paid orders), insert a commission row. Use the seeded rep's commission rate for calculation.

```sql
INSERT INTO commissions (id, order_id, rep_id, type, order_amount, rate_percent, commission_amount, adjustment, final_amount, status, payout_period, paid_at, created_at, updated_at)
SELECT
  ('aaaaaaaa-0009-0000-0000-' || lpad(row_number() OVER (ORDER BY o.placed_at, o.id)::text, 12, '0'))::uuid,
  o.id,
  f.assigned_rep,
  'direct',
  1490.00,
  CASE f.assigned_rep
    WHEN 'aaaaaaaa-0001-0001-0000-000000000001' THEN 5.00  -- Alice
    WHEN 'aaaaaaaa-0001-0001-0000-000000000002' THEN 4.00  -- Ben
    WHEN 'aaaaaaaa-0001-0001-0000-000000000003' THEN 4.00  -- Chloe
    WHEN 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953' THEN 5.00  -- Ryan
    WHEN 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d' THEN 3.00  -- Ricky
    ELSE 5.00
  END AS rate_percent,
  CASE f.assigned_rep
    WHEN 'aaaaaaaa-0001-0001-0000-000000000001' THEN 74.50
    WHEN 'aaaaaaaa-0001-0001-0000-000000000002' THEN 59.60
    WHEN 'aaaaaaaa-0001-0001-0000-000000000003' THEN 59.60
    WHEN 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953' THEN 74.50
    WHEN 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d' THEN 44.70
    ELSE 74.50
  END AS commission_amount,
  0.00 AS adjustment,
  CASE f.assigned_rep
    WHEN 'aaaaaaaa-0001-0001-0000-000000000001' THEN 74.50
    WHEN 'aaaaaaaa-0001-0001-0000-000000000002' THEN 59.60
    WHEN 'aaaaaaaa-0001-0001-0000-000000000003' THEN 59.60
    WHEN 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953' THEN 74.50
    WHEN 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d' THEN 44.70
    ELSE 74.50
  END AS final_amount,
  CASE
    WHEN o.placed_at < DATE_TRUNC('month', CURRENT_DATE) THEN 'paid'
    ELSE 'pending'
  END AS status,
  to_char(o.placed_at, 'YYYY-MM') AS payout_period,
  CASE
    WHEN o.placed_at < DATE_TRUNC('month', CURRENT_DATE) THEN (DATE_TRUNC('month', o.placed_at) + INTERVAL '1 month 5 days')
    ELSE NULL
  END AS paid_at,
  o.created_at, o.updated_at
FROM orders o
JOIN facilities f ON f.id = o.facility_id
WHERE o.id::text LIKE 'aaaaaaaa-0004-%'
  AND o.order_status IN ('delivered','shipped','approved')
  AND NOT EXISTS (SELECT 1 FROM commissions c WHERE c.order_id = o.id);
```

- [ ] **Step 2: Payouts — one per prior month (Nov 2025 – Mar 2026) per rep**

```sql
INSERT INTO payouts (id, rep_id, period, total_amount, status, paid_at, paid_by, notes, created_at, updated_at)
SELECT
  ('aaaaaaaa-000a-0000-0000-' || lpad(row_number() OVER (ORDER BY rep, period)::text, 12, '0'))::uuid,
  rep,
  period,
  SUM(amount)::numeric(10,2),
  CASE WHEN period < to_char(CURRENT_DATE, 'YYYY-MM') THEN 'paid' ELSE 'pending' END,
  CASE WHEN period < to_char(CURRENT_DATE, 'YYYY-MM') THEN (to_timestamp(period || '-15', 'YYYY-MM-DD') AT TIME ZONE 'UTC') ELSE NULL END,
  'bafaa688-4862-427f-a3f6-b9873ab603f2',
  'Seeded payout',
  NOW(), NOW()
FROM (
  SELECT rep_id AS rep, payout_period AS period, commission_amount AS amount
  FROM commissions
  WHERE id::text LIKE 'aaaaaaaa-0009-%'
) sub
GROUP BY rep, period
HAVING SUM(amount) > 0;
```

---

## Task 8: Apply the migration

- [ ] **Step 1: Concatenate all SQL sections into one block**

The final SQL is Section A (Task 2) + Section B (Task 3) + Section C (Task 4) + Section D (Task 5) + Section E (Task 6) + Section F (Task 7), in that order. No `BEGIN`/`COMMIT` wrappers needed — `apply_migration` handles transactions.

- [ ] **Step 2: Call `apply_migration`**

```
mcp__claude_ai_Supabase__apply_migration(
  project_id: "ersdsmuybpfvgvaiwcgl",
  name: "seed_demo_data_2026_04_16",
  query: "<concatenated SQL from sections A-F>"
)
```

Expected response: `{ "success": true }`.

- [ ] **Step 3: If the migration fails**

Read the error carefully. The transaction is auto-rolled back; nothing partial is in the DB.

Most likely failure modes:
1. **FK violation** — one of the referenced UUIDs (existing reps, facilities, products) is wrong. Re-verify against baseline.
2. **CHECK constraint on status fields** — order_status/payment_status values might not be in the allowed set. Confirm the values from the spec against existing orders.
3. **UNIQUE constraint on `order_number`** — extremely unlikely with SEED- prefix, but if it happens, the collision is with a real order.
4. **`crypt` / `gen_salt` not found** — pgcrypto not in search_path. Use `extensions.crypt(...)` / `extensions.gen_salt(...)` instead.

Fix the offending statement, call `apply_migration` again.

---

## Task 9: Verification

- [ ] **Step 1: Re-run the counts**

Run the baseline query from Task 1. Confirm increases:

| Table | Before | After | Delta |
|---|---|---|---|
| profiles | 12 | 20 | +8 |
| auth.users | ? | ?+8 | +8 |
| provider_credentials | 2 | 5 | +3 |
| facilities | 7 | 13 | +6 |
| patients | 9 | 39 | +30 |
| contacts | 1 | 21 | +20 |
| activities | 1 | 31 | +30 |
| tasks | 0 | 20 | +20 |
| orders | 46 | 146 | +100 |
| order_items | 18 | 118 | +100 |
| commissions | 12 | ~82 | +~70 |
| payouts | 1 | ~7 | +~6 |
| sales_quotas | 3 | 16 | +13 |
| rep_hierarchy | 1 | 3 | +2 |
| commission_rates | 5 | 8 | +3 |

- [ ] **Step 2: Sanity queries**

```sql
-- Delivered orders span Nov 2025 - Mar 2026
SELECT DATE_TRUNC('month', placed_at) AS month, COUNT(*)
FROM orders
WHERE id::text LIKE 'aaaaaaaa-%'
GROUP BY 1 ORDER BY 1;

-- All seeded reps have commissions
SELECT p.first_name, p.last_name, COUNT(c.id) AS commissions, SUM(c.commission_amount) AS total
FROM profiles p
LEFT JOIN commissions c ON c.rep_id = p.id AND c.id::text LIKE 'aaaaaaaa-%'
WHERE p.id::text LIKE 'aaaaaaaa-0001-0001-%'
GROUP BY p.id, p.first_name, p.last_name;

-- Tasks distributed overdue / this-week / future / completed
SELECT
  CASE
    WHEN status = 'completed' THEN 'completed'
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    WHEN due_date < CURRENT_DATE + 7 THEN 'this_week'
    ELSE 'future'
  END AS bucket,
  COUNT(*)
FROM tasks WHERE id::text LIKE 'aaaaaaaa-%' GROUP BY 1 ORDER BY 1;
```

- [ ] **Step 3: Browser smoke test**

1. Log in as `seed.rep.alice@example.com` / `test123!` → visit `/dashboard` → dashboard should be populated (charts have data, top accounts shows 2 facilities, commission history exists)
2. Log in as `seed.prov.evan@example.com` / `test123!` (pincode `1111` when prompted)
3. Log in as admin → `/dashboard/my-team` → see Alice and Ryan as root nodes, with Ben and Chloe as sub-reps

---

## Rollback plan (if ever needed)

Apply this as a separate migration `seed_demo_data_rollback`:

```sql
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
```
