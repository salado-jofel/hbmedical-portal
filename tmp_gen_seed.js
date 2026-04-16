// Generator for the demo-data seed migration.
// Emits the full migration SQL to stdout.

const fs = require("fs");

const REPS = {
  alice: "aaaaaaaa-0001-0001-0000-000000000001",
  ben:   "aaaaaaaa-0001-0001-0000-000000000002",
  chloe: "aaaaaaaa-0001-0001-0000-000000000003",
};
const PROVIDERS = [
  "aaaaaaaa-0001-0002-0000-000000000001",
  "aaaaaaaa-0001-0002-0000-000000000002",
  "aaaaaaaa-0001-0002-0000-000000000003",
];
const FACILITIES = [
  "aaaaaaaa-0002-0000-0000-000000000001", // 01 -> Alice
  "aaaaaaaa-0002-0000-0000-000000000002", // 02 -> Alice
  "aaaaaaaa-0002-0000-0000-000000000003", // 03 -> Ben
  "aaaaaaaa-0002-0000-0000-000000000004", // 04 -> Ben
  "aaaaaaaa-0002-0000-0000-000000000005", // 05 -> Chloe
  "aaaaaaaa-0002-0000-0000-000000000006", // 06 -> Chloe
];
const FAC_REP = [
  REPS.alice, REPS.alice, REPS.ben, REPS.ben, REPS.chloe, REPS.chloe,
];
const WOUND = ["chronic", "acute", "surgical"];

function pad(n, w) {
  return String(n).padStart(w, "0");
}
function patientIdFor(facIdx0, row_idx) {
  // facIdx0: 0..5 ; patient slot 1..5
  const p = (row_idx % 5) + 1;
  return `aaaaaaaa-0003-${pad(facIdx0 + 1, 4)}-0000-${pad(p, 12)}`;
}

// Cohort: list of {month, day, status}
// For each index, we pick a day within the month.
// Spread: dayOfMonth = ((i*3) % 26) + 1  -> yields 1..26
function dayOfMonth(i) {
  return ((i * 3) % 26) + 1;
}

// Status -> column values
function statusFields(s) {
  switch (s) {
    case "delivered":
      return {
        order_status: "delivered",
        payment_status: "paid",
        delivery_status: "delivered",
        fulfillment_status: "delivered",
        invoice_status: "paid",
        payment_method: "'stripe'",
      };
    case "canceled":
      return {
        order_status: "canceled",
        payment_status: "pending",
        delivery_status: "not_shipped",
        fulfillment_status: "pending",
        invoice_status: "not_applicable",
        payment_method: "NULL",
      };
    case "shipped":
      return {
        order_status: "shipped",
        payment_status: "paid",
        delivery_status: "shipped",
        fulfillment_status: "shipped",
        invoice_status: "paid",
        payment_method: "'stripe'",
      };
    case "approved":
      return {
        order_status: "approved",
        payment_status: "paid",
        delivery_status: "not_shipped",
        fulfillment_status: "processing",
        invoice_status: "paid",
        payment_method: "'stripe'",
      };
    case "manufacturer_review":
    case "additional_info_needed":
    case "pending_signature":
      return {
        order_status: s,
        payment_status: "pending",
        delivery_status: "not_shipped",
        fulfillment_status: "pending",
        invoice_status: "not_applicable",
        payment_method: "NULL",
      };
    case "draft":
      return {
        order_status: "draft",
        payment_status: "pending",
        delivery_status: "not_shipped",
        fulfillment_status: "pending",
        invoice_status: "not_applicable",
        payment_method: "NULL",
      };
    default:
      throw new Error("unknown status " + s);
  }
}

// Build cohort list
function buildCohorts() {
  const out = [];
  function push(n, yyyy, mm, status) {
    for (let k = 0; k < n; k++) out.push({ year: yyyy, month: mm, status });
  }
  push(8, 2025, 11, "delivered");
  push(10, 2025, 12, "delivered");
  push(14, 2026, 1, "delivered");
  // Feb 18 total
  push(15, 2026, 2, "delivered");
  push(3, 2026, 2, "canceled");
  // Mar 22 total
  push(15, 2026, 3, "delivered");
  push(4, 2026, 3, "shipped");
  push(2, 2026, 3, "approved");
  push(1, 2026, 3, "canceled");
  // Apr 28 total
  push(4, 2026, 4, "shipped");
  push(5, 2026, 4, "approved");
  push(6, 2026, 4, "manufacturer_review");
  push(4, 2026, 4, "pending_signature");
  push(3, 2026, 4, "additional_info_needed");
  push(6, 2026, 4, "draft");
  return out;
}

// Distribute days within same month without collisions in date spread.
// We'll track per-month index to compute day spread.
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function formatOrderRow(i, cohort, perMonthIdx) {
  // i: 1..100
  const facIdx0 = (i - 1) % 6;
  const facility_id = FACILITIES[facIdx0];
  const created_by = FAC_REP[facIdx0];
  const provider_id = PROVIDERS[(i - 1) % 3];
  const patient_id = patientIdFor(facIdx0, i - 1);
  const wound = WOUND[(i - 1) % 3];

  // Day: spread within month using ((perMonthIdx*3) % 26)+1 for safety
  const dim = daysInMonth(cohort.year, cohort.month);
  let day = ((perMonthIdx * 3) % 26) + 1;
  if (day > dim) day = dim;

  const y = cohort.year;
  const m = cohort.month;
  const dd = pad(day, 2);
  const mm = pad(m, 2);
  const dateStr = `${y}-${mm}-${dd}`;
  const placed_at = `'${dateStr} 09:00:00+00'`;

  const s = statusFields(cohort.status);

  // derive paid_at / delivered_at
  // paid_at = placed_at + 3 days for not pending/draft/canceled AND not in pending status list
  let paid_at = "NULL";
  let delivered_at = "NULL";
  const isPending = ["pending_signature", "manufacturer_review", "additional_info_needed", "draft", "canceled"].includes(cohort.status);
  if (!isPending) {
    paid_at = `('${dateStr}'::timestamptz + INTERVAL '3 days')`;
  }
  if (cohort.status === "delivered") {
    delivered_at = `('${dateStr}'::timestamptz + INTERVAL '10 days')`;
  }

  const order_form_locked = cohort.status === "delivered" || cohort.status === "shipped" ? "true" : "false";

  const signed_by = cohort.status === "draft" ? "NULL" : `'${created_by}'`;
  const signed_at = cohort.status === "draft" ? "NULL" : placed_at;

  const id = `aaaaaaaa-0004-${pad(i, 4)}-0000-${pad(i, 12)}`;
  const orderNumber = `SEED-${y}${mm}${dd}-${pad(i, 4)}`;

  // date_of_service
  const date_of_service = `'${dateStr}'::date`;

  // row
  return `(`
    + [
      `'${id}'`,
      `'${orderNumber}'`,
      `'${facility_id}'`,
      s.payment_method,
      `'${s.payment_status}'`,
      `'${s.invoice_status}'`,
      `'${s.fulfillment_status}'`,
      `'${s.delivery_status}'`,
      `NULL`, // tracking_number
      `'Seeded order #${i}'`, // notes
      placed_at,
      paid_at,
      delivered_at,
      placed_at, // created_at
      placed_at, // updated_at
      `'${s.order_status}'`,
      `'${created_by}'`,
      signed_by,
      signed_at,
      `'${wound}'`,
      date_of_service,
      `'${patient_id}'`,
      `'${provider_id}'`,
      `false`, // ai_extracted
      `NULL`, // ai_extracted_at
      order_form_locked,
    ].join(",")
    + `)`;
}

function buildOrdersSQL() {
  const cohorts = buildCohorts();
  if (cohorts.length !== 100) throw new Error("expected 100 cohorts, got " + cohorts.length);

  // perMonth index tracking
  const monthSeen = new Map();
  const rows = [];
  for (let i = 1; i <= 100; i++) {
    const c = cohorts[i - 1];
    const key = `${c.year}-${c.month}`;
    const idx = (monthSeen.get(key) || 0);
    monthSeen.set(key, idx + 1);
    rows.push(formatOrderRow(i, c, idx));
  }

  const cols = [
    "id",
    "order_number",
    "facility_id",
    "payment_method",
    "payment_status",
    "invoice_status",
    "fulfillment_status",
    "delivery_status",
    "tracking_number",
    "notes",
    "placed_at",
    "paid_at",
    "delivered_at",
    "created_at",
    "updated_at",
    "order_status",
    "created_by",
    "signed_by",
    "signed_at",
    "wound_type",
    "date_of_service",
    "patient_id",
    "assigned_provider_id",
    "ai_extracted",
    "ai_extracted_at",
    "order_form_locked",
  ];

  return `INSERT INTO orders (${cols.join(", ")}) VALUES\n  ${rows.join(",\n  ")}\nON CONFLICT (id) DO NOTHING;`;
}

// === Assemble full migration ===
const SECTION_A = `
-- ============================================================
--  Section A: auth.users + identities + profiles + provider_credentials
-- ============================================================
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at) VALUES
  ('aaaaaaaa-0001-0001-0000-000000000001','authenticated','authenticated','seed.rep.alice@example.com',    crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000002','authenticated','authenticated','seed.rep.ben@example.com',      crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000003','authenticated','authenticated','seed.rep.chloe@example.com',    crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000001','authenticated','authenticated','seed.prov.evan@example.com',    crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000002','authenticated','authenticated','seed.prov.mia@example.com',     crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000003','authenticated','authenticated','seed.prov.omar@example.com',    crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000001','authenticated','authenticated','seed.staff.nina@example.com',   crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000002','authenticated','authenticated','seed.staff.greg@example.com',   crypt('test123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}','{}', false, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'email', u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  NOW(), NOW()
FROM auth.users u
WHERE u.id::text LIKE 'aaaaaaaa-%'
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email');

INSERT INTO profiles (id, email, first_name, last_name, phone, role, status, has_completed_setup, created_at, updated_at) VALUES
  ('aaaaaaaa-0001-0001-0000-000000000001','seed.rep.alice@example.com','Alice','Nguyen','+15555550101','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000002','seed.rep.ben@example.com',  'Ben',  'Torres', '+15555550102','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0001-0000-000000000003','seed.rep.chloe@example.com','Chloe','Park',   '+15555550103','sales_representative','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000001','seed.prov.evan@example.com','Dr. Evan','Reyes','+15555550201','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000002','seed.prov.mia@example.com', 'Dr. Mia','Kim',   '+15555550202','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0002-0000-000000000003','seed.prov.omar@example.com','Dr. Omar','Patel','+15555550203','clinical_provider','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000001','seed.staff.nina@example.com','Nina','Walsh',  '+15555550301','clinical_staff','active', true, NOW(), NOW()),
  ('aaaaaaaa-0001-0003-0000-000000000002','seed.staff.greg@example.com','Greg','Ito',    '+15555550302','clinical_staff','active', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_credentials (id, user_id, credential, npi_number, pin_hash, baa_signed_at, terms_signed_at, created_at, updated_at) VALUES
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000001','MD','2222222221', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000002','DO','2222222222', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'aaaaaaaa-0001-0002-0000-000000000003','MD','2222222223', crypt('1111', gen_salt('bf', 6)), NOW(), NOW(), NOW(), NOW());
`;

const SECTION_B = `
-- ============================================================
--  Section B: rep_hierarchy, commission_rates, sales_quotas
-- ============================================================
INSERT INTO rep_hierarchy (id, parent_rep_id, child_rep_id, created_by, created_at) VALUES
  ('aaaaaaaa-000b-0000-0000-000000000001','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','aaaaaaaa-0001-0001-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953', NOW()),
  ('aaaaaaaa-000b-0000-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000001', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO commission_rates (id, rep_id, set_by, rate_percent, override_percent, effective_from, effective_to, created_at, updated_at) VALUES
  ('aaaaaaaa-000d-0000-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','bafaa688-4862-427f-a3f6-b9873ab603f2', 5.00, 0.00, '2025-11-01', NULL, NOW(), NOW()),
  ('aaaaaaaa-000d-0000-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','fd542a2a-ef6e-4587-8c8c-2bd138c5e953', 4.00, 1.00, '2025-11-01', NULL, NOW(), NOW()),
  ('aaaaaaaa-000d-0000-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000001', 4.00, 1.00, '2025-11-01', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

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
`;

// Section C with user_id = assigned_rep fallback
const SECTION_C = `
-- ============================================================
--  Section C: facilities, patients, contacts
-- ============================================================
INSERT INTO facilities (id, user_id, name, city, state, country, address_line_1, postal_code, facility_type, assigned_rep, status, contact, phone, created_at, updated_at) VALUES
  ('aaaaaaaa-0002-0000-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Desert Vista Wound Care',     'Phoenix','AZ','USA','101 Sun Blvd',      '85001','clinic','aaaaaaaa-0001-0001-0000-000000000001','active','Dr. Evan Reyes','+16025551001', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000001','Cactus Canyon Clinic',        'Tucson', 'AZ','USA','202 Saguaro Dr',    '85701','clinic','aaaaaaaa-0001-0001-0000-000000000001','active','Dr. Mia Kim',  '+15205551002', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000002','Lakeshore Wound Specialists', 'Chicago','IL','USA','303 Lake Shore Dr', '60601','clinic','aaaaaaaa-0001-0001-0000-000000000002','active','Dr. Omar Patel','+13125551003', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000004','aaaaaaaa-0001-0001-0000-000000000002','Harbor Point Medical',        'Portland','OR','USA','404 Harbor Way',   '97201','clinic','aaaaaaaa-0001-0001-0000-000000000002','active','Dr. Evan Reyes','+15035551004', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000005','aaaaaaaa-0001-0001-0000-000000000003','Bluegrass Wound Care',        'Louisville','KY','USA','505 Derby Ln',   '40201','clinic','aaaaaaaa-0001-0001-0000-000000000003','active','Dr. Mia Kim',  '+15025551005', NOW(), NOW()),
  ('aaaaaaaa-0002-0000-0000-000000000006','aaaaaaaa-0001-0001-0000-000000000003','Piedmont Surgical Associates','Raleigh','NC','USA','606 Oak Ridge Rd',  '27601','clinic','aaaaaaaa-0001-0001-0000-000000000003','active','Dr. Omar Patel','+19195551006', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO patients (id, facility_id, first_name, last_name, date_of_birth, patient_ref, is_active, created_at, updated_at) VALUES
  ('aaaaaaaa-0003-0001-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001','Amanda','Clark', '1962-03-11','DV-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000001','Brian',  'Diaz',  '1958-07-23','DV-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000001','Carol',  'Evans', '1970-12-05','DV-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000001','Derek',  'Fox',   '1965-01-18','DV-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0001-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000001','Elena',  'Gomez', '1975-09-28','DV-0005', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000002','Frank',  'Hale',  '1952-04-17','CC-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000002','Gina',   'Ivanov','1967-06-09','CC-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000002','Henry',  'Jones', '1961-11-30','CC-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000002','Isabel', 'Kent',  '1948-02-14','CC-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0002-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000002','Jack',   'Lopez', '1972-08-21','CC-0005', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000003','Karen',  'Mendez','1955-05-03','LS-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000003','Leo',    'Nash',  '1963-10-11','LS-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000003','Maria',  'Ortiz', '1978-03-24','LS-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000003','Nathan', 'Pryor', '1959-07-01','LS-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0003-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000003','Olga',   'Quinn', '1966-12-19','LS-0005', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000004','Peter',  'Ross',  '1970-01-29','HP-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000004','Quinn',  'Shah',  '1953-04-08','HP-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000004','Rachel', 'Tran',  '1969-09-15','HP-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000004','Sam',    'Umar',  '1962-02-22','HP-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0004-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000004','Tina',   'Vega',  '1957-11-07','HP-0005', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000005','Uma',    'Wallis','1964-06-25','BG-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000005','Victor', 'Xu',    '1950-03-13','BG-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000005','Wendy',  'Young', '1973-08-02','BG-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000005','Xavier', 'Zane',  '1968-12-27','BG-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0005-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000005','Yvonne', 'Alder', '1955-05-16','BG-0005', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000006','Zack',   'Baker', '1961-01-04','PM-0001', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000006','Abby',   'Cross', '1975-07-31','PM-0002', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000006','Blake',  'Dunn',  '1967-10-20','PM-0003', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000006','Cara',   'Ellis', '1952-04-12','PM-0004', true, NOW(), NOW()),
  ('aaaaaaaa-0003-0006-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000006','Dan',    'Frost', '1970-09-06','PM-0005', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO contacts (id, facility_id, first_name, last_name, title, email, phone, preferred_contact, is_active, created_at, updated_at) VALUES
  ('aaaaaaaa-0008-0000-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001','Rebecca','Lane','Practice Manager','rlane@desertvista.test','+16025552001','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000001','Tom',    'Reid','Front Desk',      'treid@desertvista.test','+16025552002','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000001','Gina',   'Best','Billing Lead',    'gbest@desertvista.test','+16025552003','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000004','aaaaaaaa-0002-0000-0000-000000000002','Paul',   'Meyer','Office Manager','pmeyer@cactuscanyon.test','+15205552004','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000002','Linda',  'Pike', 'Medical Assistant','lpike@cactuscanyon.test','+15205552005','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000006','aaaaaaaa-0002-0000-0000-000000000002','Keith',  'Roy',  'Front Desk',    'kroy@cactuscanyon.test','+15205552006','either', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000007','aaaaaaaa-0002-0000-0000-000000000003','Nancy',  'Shaw', 'Practice Manager','nshaw@lakeshore.test','+13125552007','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000008','aaaaaaaa-0002-0000-0000-000000000003','Emily',  'Tate', 'Billing Lead',  'etate@lakeshore.test','+13125552008','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000009','aaaaaaaa-0002-0000-0000-000000000003','Ron',    'Uhl',  'Front Desk',    'ruhl@lakeshore.test', '+13125552009','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000a','aaaaaaaa-0002-0000-0000-000000000004','Diana',  'Vance','Practice Manager','dvance@harborpoint.test','+15035552010','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000b','aaaaaaaa-0002-0000-0000-000000000004','Greg',   'West', 'Office Manager','gwest@harborpoint.test','+15035552011','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000c','aaaaaaaa-0002-0000-0000-000000000004','Cindy',  'Yoho', 'Medical Assistant','cyoho@harborpoint.test','+15035552012','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000d','aaaaaaaa-0002-0000-0000-000000000005','Owen',   'Ash',  'Practice Manager','oash@bluegrass.test','+15025552013','either', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000e','aaaaaaaa-0002-0000-0000-000000000005','Mia',    'Burch','Billing Lead',  'mburch@bluegrass.test','+15025552014','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-00000000000f','aaaaaaaa-0002-0000-0000-000000000005','Eric',   'Cove', 'Front Desk',    'ecove@bluegrass.test',  '+15025552015','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000010','aaaaaaaa-0002-0000-0000-000000000006','Lynn',   'Drake','Practice Manager','ldrake@piedmont.test','+19195552016','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000011','aaaaaaaa-0002-0000-0000-000000000006','Dave',   'Ewing','Medical Assistant','dewing@piedmont.test','+19195552017','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000012','aaaaaaaa-0002-0000-0000-000000000006','Ruth',   'Flynn','Office Manager','rflynn@piedmont.test','+19195552018','email', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000013','aaaaaaaa-0002-0000-0000-000000000001','Anna',   'Garza','Medical Assistant','agarza@desertvista.test','+16025552019','phone', true, NOW(), NOW()),
  ('aaaaaaaa-0008-0000-0000-000000000014','aaaaaaaa-0002-0000-0000-000000000003','Marco',  'Hart', 'Office Manager','mhart@lakeshore.test','+13125552020','email', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
`;

const SECTION_D = `
-- ============================================================
--  Section D: activities + tasks
-- ============================================================
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
    'aaaaaaaa-0001-0001-0000-000000000001'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000001'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000002'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000002'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000003'::uuid,
    'aaaaaaaa-0001-0001-0000-000000000003'::uuid
  ])[((i - 1) % 6) + 1] AS logged_by,
  (ARRAY['call','email','visit','meeting'])[((i - 1) % 4) + 1] AS type,
  (CURRENT_DATE - ((60 - i) || ' days')::interval)::date AS activity_date,
  (ARRAY['positive','neutral','follow_up_needed','neutral'])[((i - 1) % 4) + 1] AS outcome,
  'Seeded activity #' || i AS notes,
  NOW(), NOW()
FROM generate_series(1, 30) AS i
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, facility_id, contact_id, created_by, assigned_to, title, due_date, priority, status, notes, reminder_sent, created_at, updated_at) VALUES
  ('aaaaaaaa-0007-0000-0000-000000000001','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Follow up on Q2 quote', (CURRENT_DATE - INTERVAL '5 days')::date, 'high',  'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000002','aaaaaaaa-0002-0000-0000-000000000002',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Send pricing to Dr. Mia Kim', (CURRENT_DATE - INTERVAL '2 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000003','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Confirm inventory for next shipment', (CURRENT_DATE - INTERVAL '1 days')::date, 'high', 'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000004','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Renew service agreement',              (CURRENT_DATE - INTERVAL '7 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000005','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Call back about product demo',           (CURRENT_DATE - INTERVAL '3 days')::date, 'high',  'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000006','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Product training session', (CURRENT_DATE + INTERVAL '1 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000007','aaaaaaaa-0002-0000-0000-000000000002',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Submit onboarding docs',    (CURRENT_DATE + INTERVAL '2 days')::date, 'low',   'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000008','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Review pricing update',     (CURRENT_DATE + INTERVAL '3 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000009','aaaaaaaa-0002-0000-0000-000000000004',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Schedule quarterly check-in', (CURRENT_DATE + INTERVAL '4 days')::date, 'low',  'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000a','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Send sample packet',        (CURRENT_DATE + INTERVAL '5 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000b','aaaaaaaa-0002-0000-0000-000000000006',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Coordinate delivery window',(CURRENT_DATE + INTERVAL '6 days')::date, 'high', 'open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000c','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Hand off admin onboarding', (CURRENT_DATE + INTERVAL '4 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000d','1327339c-7668-41d3-a499-7250b50b79de',NULL,'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','df3a36fe-2686-4a14-9a37-e4ad8c71ff0d','Email Ricky sub-rep',       (CURRENT_DATE + INTERVAL '2 days')::date, 'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000e','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Annual business review',     (CURRENT_DATE + INTERVAL '21 days')::date, 'low','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-00000000000f','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Plan lunch-and-learn',      (CURRENT_DATE + INTERVAL '14 days')::date, 'low','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000010','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','Prepare customer satisfaction survey',(CURRENT_DATE + INTERVAL '28 days')::date,'medium','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000011','b2be5041-a915-459f-b651-f171747a9d78',NULL,'fd542a2a-ef6e-4587-8c8c-2bd138c5e953','fd542a2a-ef6e-4587-8c8c-2bd138c5e953','Review commission structure',(CURRENT_DATE + INTERVAL '10 days')::date, 'low','open', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000012','aaaaaaaa-0002-0000-0000-000000000001',NULL,'aaaaaaaa-0001-0001-0000-000000000001','aaaaaaaa-0001-0001-0000-000000000001','Initial facility visit',    (CURRENT_DATE - INTERVAL '20 days')::date, 'medium','completed', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000013','aaaaaaaa-0002-0000-0000-000000000003',NULL,'aaaaaaaa-0001-0001-0000-000000000002','aaaaaaaa-0001-0001-0000-000000000002','Contract signed',           (CURRENT_DATE - INTERVAL '15 days')::date, 'high',  'completed', NULL, false, NOW(), NOW()),
  ('aaaaaaaa-0007-0000-0000-000000000014','aaaaaaaa-0002-0000-0000-000000000005',NULL,'aaaaaaaa-0001-0001-0000-000000000003','aaaaaaaa-0001-0001-0000-000000000003','First order placed',        (CURRENT_DATE - INTERVAL '10 days')::date, 'medium','completed', NULL, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
`;

const SECTION_E_ORDERS = `
-- ============================================================
--  Section E: orders (100) + order_items
-- ============================================================
${buildOrdersSQL()}

INSERT INTO order_items (id, order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal, total_amount, created_at, updated_at)
SELECT
  ('aaaaaaaa-0005-0000-0000-' || lpad(row_number() OVER (ORDER BY o.id)::text, 12, '0'))::uuid,
  o.id,
  '7d9b5546-128b-407b-964a-7660db604472',
  'ossFx Surgical Matrix Test', 'OSSFX',
  1490.00, 1, 0, 0, 1490.00, 1490.00,
  o.created_at, o.updated_at
FROM orders o
WHERE o.id::text LIKE 'aaaaaaaa-0004-%'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);
`;

const SECTION_F = `
-- ============================================================
--  Section F: commissions + payouts
-- ============================================================
INSERT INTO commissions (id, order_id, rep_id, type, order_amount, rate_percent, commission_amount, adjustment, final_amount, status, payout_period, paid_at, created_at, updated_at)
SELECT
  ('aaaaaaaa-0009-0000-0000-' || lpad(row_number() OVER (ORDER BY o.placed_at, o.id)::text, 12, '0'))::uuid,
  o.id,
  f.assigned_rep,
  'direct',
  1490.00,
  CASE f.assigned_rep
    WHEN 'aaaaaaaa-0001-0001-0000-000000000001' THEN 5.00
    WHEN 'aaaaaaaa-0001-0001-0000-000000000002' THEN 4.00
    WHEN 'aaaaaaaa-0001-0001-0000-000000000003' THEN 4.00
    WHEN 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953' THEN 5.00
    WHEN 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d' THEN 3.00
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
`;

const full = SECTION_A + SECTION_B + SECTION_C + SECTION_D + SECTION_E_ORDERS + SECTION_F;
fs.writeFileSync("tmp_seed_migration.sql", full);
console.log("Wrote tmp_seed_migration.sql, bytes:", full.length);
