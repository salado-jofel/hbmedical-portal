-- HB Medical Portal — Public Schema
-- Exported via Supabase MCP on 2026-04-09
-- Project: ersdsmuybpfvgvaiwcgl (HB-Portal-Dev)

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  contact_id uuid,
  logged_by uuid NOT NULL,
  type text NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  outcome text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  set_by uuid NOT NULL,
  rate_percent numeric NOT NULL DEFAULT 0,
  override_percent numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  rep_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'direct',
  order_amount numeric NOT NULL DEFAULT 0,
  rate_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  final_amount numeric,
  status text NOT NULL DEFAULT 'pending',
  payout_period text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  title text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  preferred_contact text NOT NULL DEFAULT 'email',
  notes text,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tag text NOT NULL,
  bucket text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  sort_order int4 NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  contact text NOT NULL,
  phone text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assigned_rep uuid,
  facility_type text NOT NULL DEFAULT 'clinic'
);

CREATE TABLE IF NOT EXISTS public.facility_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_type text NOT NULL DEFAULT 'clinical_provider',
  can_sign_orders bool NOT NULL DEFAULT false,
  is_primary bool NOT NULL DEFAULT false,
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_onboarding_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tag text NOT NULL,
  bucket text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  sort_order int4 NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid NOT NULL,
  facility_id uuid,
  role_type text NOT NULL DEFAULT 'clinical_provider',
  expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_email text
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  invoice_number text NOT NULL,
  provider text NOT NULL DEFAULT 'internal',
  provider_invoice_id text,
  status text NOT NULL DEFAULT 'draft',
  amount_due numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  hosted_invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  net30_last_reminder_stage text,
  net30_last_reminder_sent_at timestamptz,
  net30_reminder_count int4 NOT NULL DEFAULT 0,
  net30_reminder_email_error text,
  net30_reminder_lock_id uuid
);

CREATE TABLE IF NOT EXISTS public.marketing_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tag text NOT NULL,
  bucket text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  sort_order int4 NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  order_number text NOT NULL,
  old_status text,
  new_status text,
  is_read bool NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  document_type text NOT NULL,
  bucket text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size int8,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_form (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  wound_visit_number int4,
  chief_complaint text,
  has_vasculitis_or_burns bool DEFAULT false,
  is_receiving_home_health bool DEFAULT false,
  is_patient_at_snf bool DEFAULT false,
  icd10_code text,
  followup_days int4,
  wound_site text,
  wound_stage text,
  wound_length_cm numeric,
  wound_width_cm numeric,
  wound_depth_cm numeric,
  subjective_symptoms text[] DEFAULT '{}',
  clinical_notes text,
  ai_extracted bool NOT NULL DEFAULT false,
  ai_extracted_at timestamptz,
  is_locked bool NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  physician_signed_at timestamptz,
  physician_signed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_form_1500 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  insurance_type text,
  insured_id_number text,
  patient_last_name text,
  patient_first_name text,
  patient_middle_initial text,
  patient_dob date,
  patient_sex text,
  insured_last_name text,
  insured_first_name text,
  insured_middle_initial text,
  patient_address text,
  patient_city text,
  patient_state text,
  patient_zip text,
  patient_phone text,
  patient_relationship text,
  insured_address text,
  insured_city text,
  insured_state text,
  insured_zip text,
  insured_phone text,
  other_insured_name text,
  other_insured_policy text,
  other_insured_dob date,
  other_insured_sex text,
  other_insured_employer text,
  other_insured_plan text,
  condition_employment bool DEFAULT false,
  condition_auto_accident bool DEFAULT false,
  condition_auto_state text,
  condition_other_accident bool DEFAULT false,
  insured_policy_group text,
  insured_dob date,
  insured_sex text,
  insured_employer text,
  insured_plan_name text,
  another_health_benefit bool DEFAULT false,
  patient_signature text,
  patient_signature_date date,
  insured_signature text,
  illness_date date,
  illness_qualifier text,
  other_date date,
  other_date_qualifier text,
  unable_work_from date,
  unable_work_to date,
  referring_provider_name text,
  referring_provider_npi text,
  referring_provider_qual text,
  hospitalization_from date,
  hospitalization_to date,
  additional_claim_info text,
  outside_lab bool DEFAULT false,
  outside_lab_charges numeric,
  diagnosis_a text,
  diagnosis_b text,
  diagnosis_c text,
  diagnosis_d text,
  diagnosis_e text,
  diagnosis_f text,
  diagnosis_g text,
  diagnosis_h text,
  diagnosis_i text,
  diagnosis_j text,
  diagnosis_k text,
  diagnosis_l text,
  resubmission_code text,
  original_ref_number text,
  prior_auth_number text,
  service_lines jsonb DEFAULT '[]',
  federal_tax_id text,
  tax_id_ssn bool DEFAULT false,
  patient_account_number text,
  accept_assignment bool DEFAULT false,
  total_charge numeric,
  amount_paid numeric,
  rsvd_nucc text,
  physician_signature text,
  physician_signature_date date,
  service_facility_name text,
  service_facility_address text,
  service_facility_npi text,
  billing_provider_name text,
  billing_provider_address text,
  billing_provider_phone text,
  billing_provider_npi text,
  billing_provider_tax_id text,
  nucc_use text,
  insurance_name text,
  insurance_address text,
  insurance_address2 text,
  insurance_city_state_zip text,
  claim_codes text,
  icd_indicator text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  performed_by uuid,
  action text NOT NULL,
  old_status text,
  new_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  product_sku text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity int4 NOT NULL DEFAULT 1,
  shipping_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  subtotal numeric,
  total_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_ivr (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  insurance_provider text,
  insurance_phone text,
  member_id text,
  group_number text,
  plan_name text,
  plan_type text,
  subscriber_name text,
  subscriber_dob date,
  subscriber_relationship text,
  coverage_start_date date,
  coverage_end_date date,
  deductible_amount numeric,
  deductible_met numeric,
  out_of_pocket_max numeric,
  out_of_pocket_met numeric,
  copay_amount numeric,
  coinsurance_percent numeric,
  dme_covered bool DEFAULT false,
  wound_care_covered bool DEFAULT false,
  prior_auth_required bool DEFAULT false,
  prior_auth_number text,
  prior_auth_start_date date,
  prior_auth_end_date date,
  units_authorized int4,
  verified_by text,
  verified_date date,
  verification_reference text,
  notes text,
  ai_extracted bool DEFAULT false,
  ai_extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  facility_id uuid NOT NULL,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'pending',
  invoice_status text NOT NULL DEFAULT 'not_applicable',
  fulfillment_status text NOT NULL DEFAULT 'pending',
  delivery_status text NOT NULL DEFAULT 'not_shipped',
  tracking_number text,
  notes text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  order_status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  signed_by uuid,
  signed_at timestamptz,
  wound_type text,
  date_of_service date,
  patient_id uuid,
  assigned_provider_id uuid,
  ai_extracted bool DEFAULT false,
  ai_extracted_at timestamptz,
  symptoms text[] DEFAULT '{}',
  wound_visit_number int4,
  chief_complaint text,
  has_vasculitis_or_burns bool,
  is_receiving_home_health bool,
  is_patient_at_snf bool,
  icd10_code text,
  followup_days int4,
  order_form_locked bool NOT NULL DEFAULT false,
  admin_notes text
);

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  patient_ref text,
  notes text,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  provider text NOT NULL,
  payment_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stripe_charge_id text,
  receipt_url text
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  period text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  paid_at timestamptz,
  paid_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  unit_price numeric NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  sort_order int4 NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  has_completed_setup bool NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential text,
  npi_number text,
  ptan_number text,
  medical_license_number text,
  pin_hash text,
  baa_signed_at timestamptz,
  terms_signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rep_hierarchy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_rep_id uuid NOT NULL,
  child_rep_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  carrier text,
  service_level text,
  tracking_number text,
  tracking_url text,
  shipstation_order_id text,
  shipstation_shipment_id text,
  status text NOT NULL DEFAULT 'pending',
  shipped_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text NOT NULL,
  event_type text NOT NULL,
  object_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facility_id uuid,
  contact_id uuid,
  created_by uuid NOT NULL,
  assigned_to uuid NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  notes text,
  reminder_sent bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tag text NOT NULL,
  bucket text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  sort_order int4 NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
