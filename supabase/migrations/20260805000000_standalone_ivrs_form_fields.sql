-- Fax → IVR "rich form" P1
--
-- Adds every clinical / insurance / patient / physician / facility field
-- that the order_ivr side of the app captures onto standalone_ivrs, so
-- the "Build IVR from fax" modal can render the same PDF-mimicking IVR
-- form the order tab does, backed by the standalone record. On convert-
-- to-order the values will be copied one-to-one into order_ivr (same
-- column names → dumb copy, no aliasing needed).
--
-- All columns nullable. Nothing here is required to save — the fax
-- itself carries the source-of-truth data; these columns exist so
-- reports, list scans, and downstream order copy don't have to re-parse
-- the PDF.

ALTER TABLE public.standalone_ivrs
  -- Sales rep + facility overrides (physical clinic/hospital location
  -- the IVR is being submitted for — separate from facility_id which
  -- is the RLS scope key).
  ADD COLUMN IF NOT EXISTS sales_rep_name              text,
  ADD COLUMN IF NOT EXISTS place_of_service            text,
  ADD COLUMN IF NOT EXISTS specialty_site_name         text,
  ADD COLUMN IF NOT EXISTS medicare_admin_contractor   text,
  ADD COLUMN IF NOT EXISTS facility_name               text,
  ADD COLUMN IF NOT EXISTS facility_address            text,
  ADD COLUMN IF NOT EXISTS facility_contact            text,
  ADD COLUMN IF NOT EXISTS facility_phone              text,
  ADD COLUMN IF NOT EXISTS facility_fax                text,
  ADD COLUMN IF NOT EXISTS facility_npi                text,
  ADD COLUMN IF NOT EXISTS facility_tin                text,
  ADD COLUMN IF NOT EXISTS facility_ptan               text,

  -- Physician (name + NPI already exist on this table).
  ADD COLUMN IF NOT EXISTS physician_phone             text,
  ADD COLUMN IF NOT EXISTS physician_fax               text,
  ADD COLUMN IF NOT EXISTS physician_address           text,
  ADD COLUMN IF NOT EXISTS physician_tin               text,

  -- Patient (name + DOB already exist on this table).
  ADD COLUMN IF NOT EXISTS patient_phone               text,
  ADD COLUMN IF NOT EXISTS patient_address             text,
  ADD COLUMN IF NOT EXISTS ok_to_contact_patient       boolean,

  -- Primary insurance.
  ADD COLUMN IF NOT EXISTS insurance_provider          text,
  ADD COLUMN IF NOT EXISTS insurance_phone             text,
  ADD COLUMN IF NOT EXISTS member_id                   text,
  ADD COLUMN IF NOT EXISTS group_number                text,
  ADD COLUMN IF NOT EXISTS plan_name                   text,
  ADD COLUMN IF NOT EXISTS plan_type                   text,
  ADD COLUMN IF NOT EXISTS subscriber_name             text,
  ADD COLUMN IF NOT EXISTS subscriber_dob              date,
  ADD COLUMN IF NOT EXISTS subscriber_relationship     text,
  ADD COLUMN IF NOT EXISTS provider_participates_primary text,

  -- Coverage / verification (chronic IVR only shows these back-office
  -- fields; standalone stores them uniformly so nothing is lost in
  -- transit to order_ivr).
  ADD COLUMN IF NOT EXISTS coverage_start_date         date,
  ADD COLUMN IF NOT EXISTS coverage_end_date           date,
  ADD COLUMN IF NOT EXISTS deductible_amount           numeric(10,2),
  ADD COLUMN IF NOT EXISTS deductible_met              numeric(10,2),
  ADD COLUMN IF NOT EXISTS out_of_pocket_max           numeric(10,2),
  ADD COLUMN IF NOT EXISTS out_of_pocket_met           numeric(10,2),
  ADD COLUMN IF NOT EXISTS copay_amount                numeric(10,2),
  ADD COLUMN IF NOT EXISTS coinsurance_percent         numeric(5,2),
  ADD COLUMN IF NOT EXISTS dme_covered                 boolean,
  ADD COLUMN IF NOT EXISTS wound_care_covered          boolean,
  ADD COLUMN IF NOT EXISTS prior_auth_required         boolean,
  ADD COLUMN IF NOT EXISTS prior_auth_number           text,
  ADD COLUMN IF NOT EXISTS prior_auth_start_date       date,
  ADD COLUMN IF NOT EXISTS prior_auth_end_date         date,
  ADD COLUMN IF NOT EXISTS units_authorized            integer,
  ADD COLUMN IF NOT EXISTS verified_by                 text,
  ADD COLUMN IF NOT EXISTS verified_date               date,
  ADD COLUMN IF NOT EXISTS verification_reference      text,

  -- Secondary insurance.
  ADD COLUMN IF NOT EXISTS secondary_insurance_provider      text,
  ADD COLUMN IF NOT EXISTS secondary_insurance_phone         text,
  ADD COLUMN IF NOT EXISTS secondary_subscriber_name         text,
  ADD COLUMN IF NOT EXISTS secondary_policy_number           text,
  ADD COLUMN IF NOT EXISTS secondary_subscriber_dob          date,
  ADD COLUMN IF NOT EXISTS secondary_plan_type               text,
  ADD COLUMN IF NOT EXISTS secondary_group_number            text,
  ADD COLUMN IF NOT EXISTS secondary_subscriber_relationship text,
  ADD COLUMN IF NOT EXISTS provider_participates_secondary   text,

  -- Wound + procedure. wound_type here is the free-text IVR override
  -- (matches order_ivr.wound_type comment) — a broader list than the
  -- orders.wound_type CHECK enum.
  ADD COLUMN IF NOT EXISTS wound_type                  text,
  ADD COLUMN IF NOT EXISTS wound_sizes                 text,
  ADD COLUMN IF NOT EXISTS application_cpts            text,
  ADD COLUMN IF NOT EXISTS date_of_procedure           date,
  ADD COLUMN IF NOT EXISTS icd10_codes                 text,
  ADD COLUMN IF NOT EXISTS product_information         text,
  ADD COLUMN IF NOT EXISTS is_patient_at_snf           boolean,
  ADD COLUMN IF NOT EXISTS surgical_global_period      boolean,
  ADD COLUMN IF NOT EXISTS global_period_cpt           text,
  ADD COLUMN IF NOT EXISTS prior_auth_permission       boolean,

  -- Back-office notes (kept separate from product_summary which is a
  -- clinician-visible one-liner).
  ADD COLUMN IF NOT EXISTS form_notes                  text,

  -- Bookkeeping so we can tell whether the AI pre-fill ran.
  ADD COLUMN IF NOT EXISTS ai_extracted                boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS ai_extracted_at             timestamptz;
