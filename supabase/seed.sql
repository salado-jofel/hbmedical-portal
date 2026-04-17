-- ============================================================================
--  HB Medical Portal — Dev Seed Data
--
--  Seeds 6 auth users (one per role), 3 facilities, facility memberships,
--  rep hierarchy, and provider credentials so the app can be exercised
--  end-to-end on a fresh dev branch.
--
--  Apply (must be linked to the dev branch first):
--    npx supabase link --project-ref tdqilgjicvlpfvnvgzne
--    npx supabase db query --file supabase/seed.sql --linked
--
--  Password (all users):   test123!
--  Provider PIN:           1111
--
--  Idempotent: cascades delete from auth.users at the top, then re-inserts.
-- ============================================================================

-- Fixed UUIDs — predictable for testing / cleanup
-- ----------------------------------------------------------------------------
--  Admin user           11111111-1111-1111-1111-111111111111
--  Main sales rep       22222222-2222-2222-2222-222222222222
--  Sub rep              33333333-3333-3333-3333-333333333333
--  Clinical provider    44444444-4444-4444-4444-444444444444
--  Clinical staff       55555555-5555-5555-5555-555555555555
--  Support staff        66666666-6666-6666-6666-666666666666
--  Main rep rep_office  77777777-7777-7777-7777-777777777777
--  Provider clinic      88888888-8888-8888-8888-888888888888
--  Sub rep rep_office   99999999-9999-9999-9999-999999999999

BEGIN;

-- ============================================================================
--  0. SAFETY GUARD — refuse to run against the main branch
--     Hardcoded main branch ref: ersdsmuybpfvgvaiwcgl
--
--     NOTE: this guard is belt-and-suspenders. cluster_name on Supabase may or
--     may not contain the project ref — if it does not, this is a no-op.
--     ALWAYS verify supabase/.temp/project-ref before running this file.
-- ============================================================================
DO $guard$
DECLARE
  v_cluster  text := current_setting('cluster_name', true);
  v_db       text := current_database();
  v_server   text := COALESCE(inet_server_addr()::text, '<unknown>');
  v_main_ref constant text := 'ersdsmuybpfvgvaiwcgl';
BEGIN
  RAISE NOTICE '[seed-guard] database=%  cluster_name=%  server_addr=%',
    v_db, COALESCE(v_cluster, '<unset>'), v_server;

  IF v_cluster IS NOT NULL AND v_cluster ILIKE '%' || v_main_ref || '%' THEN
    RAISE EXCEPTION
      'Refusing to seed: cluster_name (%) matches main branch ref (%)',
      v_cluster, v_main_ref;
  END IF;
END
$guard$;

-- ============================================================================
--  1. Cleanup — cascades through profiles → facilities → members → credentials
-- ============================================================================
DELETE FROM auth.users
WHERE email IN (
  'admin@hbmedical.com',
  'rep@hbmedical.com',
  'subrep@hbmedical.com',
  'provider@hbmedical.com',
  'clinicalstaff@hbmedical.com',
  'supportstaff@hbmedical.com'
);

-- Belt-and-suspenders: remove any orphan facilities at our fixed IDs
DELETE FROM public.facilities
WHERE id IN (
  '77777777-7777-7777-7777-777777777777',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999'
);

-- ============================================================================
--  2. auth.users
--     encrypted_password = bcrypt('test123!') via pgcrypto
--     email_confirmed_at = NOW()  (required when "Confirm email" is on)
-- ============================================================================
--  instance_id = '00000000-...'  is REQUIRED on Supabase — both the
--  dashboard Users page and GoTrue login filter rows by this column.
--  NULL instance_id = user is invisible to dashboard + login fails.
--
--  Token columns (confirmation_token, recovery_token, *_change_token, etc.)
--  must be EMPTY STRING ''  not NULL — GoTrue queries them with
--  `WHERE confirmation_token = ''` and rows with NULL fall outside the filter,
--  producing "Database error querying schema" on sign-in.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, email_change,
  phone_change, phone_change_token, reauthentication_token
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"HB","last_name":"Admin"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'rep@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Main","last_name":"Rep"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'subrep@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Sub","last_name":"Rep"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'provider@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Test","last_name":"Provider"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'clinicalstaff@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Clinical","last_name":"Staff"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated',
   'supportstaff@hbmedical.com',
   extensions.crypt('test123!', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Support","last_name":"Staff"}',
   false, false, NOW(), NOW(),
   '', '', '', '', '', '', '', '');

-- ============================================================================
--  3. auth.identities — required for email/password login
-- ============================================================================
INSERT INTO auth.identities (
  id, user_id, provider, provider_id, identity_data, created_at, updated_at
)
SELECT
  extensions.gen_random_uuid(),
  u.id,
  'email',
  u.id::text,
  jsonb_build_object(
    'sub',            u.id::text,
    'email',          u.email,
    'email_verified', true
  ),
  NOW(), NOW()
FROM auth.users u
WHERE u.email IN (
  'admin@hbmedical.com',
  'rep@hbmedical.com',
  'subrep@hbmedical.com',
  'provider@hbmedical.com',
  'clinicalstaff@hbmedical.com',
  'supportstaff@hbmedical.com'
);

-- ============================================================================
--  4. public.profiles (1:1 with auth.users)
--     status=active, has_completed_setup=true  → skips middleware setup gate
-- ============================================================================
INSERT INTO public.profiles (
  id, email, first_name, last_name, phone, role, status, has_completed_setup,
  created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@hbmedical.com',         'HB',       'Admin',    NULL, 'admin',                'active', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'rep@hbmedical.com',           'Main',     'Rep',      NULL, 'sales_representative', 'active', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'subrep@hbmedical.com',        'Sub',      'Rep',      NULL, 'sales_representative', 'active', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'provider@hbmedical.com',      'Test',     'Provider', NULL, 'clinical_provider',    'active', true, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'clinicalstaff@hbmedical.com', 'Clinical', 'Staff',    NULL, 'clinical_staff',       'active', true, NOW(), NOW()),
  ('66666666-6666-6666-6666-666666666666', 'supportstaff@hbmedical.com',  'Support',  'Staff',    NULL, 'support_staff',        'active', true, NOW(), NOW());

-- ============================================================================
--  5. facilities
--     - Main rep rep_office (owned by main rep, assigned_rep = self)
--     - Provider clinic    (owned by provider, assigned_rep = main rep)
--     - Sub rep rep_office (owned by sub rep, assigned_rep = self)
-- ============================================================================
INSERT INTO public.facilities (
  id, user_id, name, status, contact, phone,
  address_line_1, city, state, postal_code, country,
  assigned_rep, facility_type, created_at, updated_at
) VALUES
  ('77777777-7777-7777-7777-777777777777',
   '22222222-2222-2222-2222-222222222222',
   'HB Medical Rep Office',
   'active', 'Main Rep', '+15550000001',
   '100 Rep Plaza', 'Phoenix', 'AZ', '85001', 'US',
   '22222222-2222-2222-2222-222222222222',
   'rep_office', NOW(), NOW()),

  ('88888888-8888-8888-8888-888888888888',
   '44444444-4444-4444-4444-444444444444',
   'HB Test Wound Care Clinic',
   'active', 'Test Provider', '+15550000002',
   '200 Clinic Way', 'Phoenix', 'AZ', '85002', 'US',
   '22222222-2222-2222-2222-222222222222',
   'clinic', NOW(), NOW()),

  ('99999999-9999-9999-9999-999999999999',
   '33333333-3333-3333-3333-333333333333',
   'HB Sub Rep Office',
   'active', 'Sub Rep', '+15550000003',
   '300 Sub Rep Ln', 'Phoenix', 'AZ', '85003', 'US',
   '33333333-3333-3333-3333-333333333333',
   'rep_office', NOW(), NOW());

-- ============================================================================
--  6. facility_members (clinic-side memberships)
-- ============================================================================
INSERT INTO public.facility_members (
  facility_id, user_id, role_type, can_sign_orders, is_primary,
  invited_by, joined_at, created_at
) VALUES
  -- Provider is primary member of the clinic, can sign orders
  ('88888888-8888-8888-8888-888888888888',
   '44444444-4444-4444-4444-444444444444',
   'clinical_provider', true, true,
   '22222222-2222-2222-2222-222222222222',
   NOW(), NOW()),

  -- Clinical staff joins the same clinic, cannot sign orders
  ('88888888-8888-8888-8888-888888888888',
   '55555555-5555-5555-5555-555555555555',
   'clinical_staff', false, false,
   '44444444-4444-4444-4444-444444444444',
   NOW(), NOW());

-- ============================================================================
--  7. rep_hierarchy (sub rep reports to main rep; admin created the link)
-- ============================================================================
INSERT INTO public.rep_hierarchy (
  parent_rep_id, child_rep_id, created_by, created_at
) VALUES
  ('22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   NOW());

-- ============================================================================
--  8. provider_credentials (PIN hashed via public.hash_pin — matches verify_pin)
-- ============================================================================
INSERT INTO public.provider_credentials (
  user_id, credential, npi_number, ptan_number, medical_license_number,
  pin_hash, baa_signed_at, terms_signed_at, created_at, updated_at
) VALUES
  ('44444444-4444-4444-4444-444444444444',
   'MD',
   '1234567890',
   NULL,
   NULL,
   public.hash_pin('1111'),
   NOW(), NOW(), NOW(), NOW());

COMMIT;

-- ============================================================================
--  Summary (for humans reading `npx supabase db query` output)
-- ============================================================================
SELECT
  p.role,
  p.email,
  p.has_completed_setup AS setup_done,
  f.name AS facility,
  f.facility_type
FROM public.profiles p
LEFT JOIN public.facilities f ON f.user_id = p.id
WHERE p.email IN (
  'admin@hbmedical.com',
  'rep@hbmedical.com',
  'subrep@hbmedical.com',
  'provider@hbmedical.com',
  'clinicalstaff@hbmedical.com',
  'supportstaff@hbmedical.com'
)
ORDER BY p.role, p.email;
