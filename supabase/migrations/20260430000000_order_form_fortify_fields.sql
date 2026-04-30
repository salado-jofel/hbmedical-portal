-- =============================================================================
-- Order Form expansion — Fortify-style ADR documentation fields.
--
-- Layers ~50 new columns onto `order_form` so the existing form can capture
-- the full intake / wound-care assessment / coverage-self-check / physician
-- attestation set used by ADR (Additional Documentation Request) defense.
--
-- Existing layout is preserved — the on-screen form keeps the same 19
-- sections; new fields slot inside the section they belong to.
--
-- Groups added:
--   1. Patient + order metadata: MRN, MBI, insurance type, anticipated DOS
--   2. Comorbidities + labs: A1C, albumin, eGFR, PAD, neuropathy, smoking, etc.
--   3. Wound etiology checkboxes + onset
--   4. Wound-bed (slough %, eschar %), pain 0-10, infection describe, photo flag
--   5. Prior treatments (JSONB array) + advancement reason
--   6. Goal of therapy + adjuncts + specialty consults
--   7. Product modifiers + prior-auth flag + application frequency
--   8. LCD coverage self-check (LCD ref + 5 attestation booleans + concerns)
--   9. Physician NPI + 5-point physician attestation booleans
--  10. Office tracking JSONB (admin-only — method of receipt, BAA flag,
--      reviewer, gaps log, fulfillment release)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Patient + order metadata (Section 2 — PATIENT ROW)
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS patient_mrn          text,
  ADD COLUMN IF NOT EXISTS patient_mbi          text,
  ADD COLUMN IF NOT EXISTS insurance_type_label text,
  ADD COLUMN IF NOT EXISTS anticipated_dos_start date,
  ADD COLUMN IF NOT EXISTS anticipated_dos_end   date;

COMMENT ON COLUMN public.order_form.patient_mrn IS
  'Patient medical record number from the clinic chart (not the same as patients.id).';
COMMENT ON COLUMN public.order_form.patient_mbi IS
  'Medicare Beneficiary Identifier (MBI). Stored separately from member_id on order_ivr.';
COMMENT ON COLUMN public.order_form.insurance_type_label IS
  'medicare_part_b | medicare_dme | medicare_advantage | commercial | medicaid | other';

-- -----------------------------------------------------------------------------
-- 2. Comorbidities + labs (Section 7 — MEDICAL CONDITIONS)
--
-- Existing booleans (diabetes, cvd, copd, chf, anemia, decreased mobility,
-- infection) are kept untouched. Below adds the wound-care-specific ones plus
-- quantified labs.
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS a1c_value                  numeric(4,2),
  ADD COLUMN IF NOT EXISTS a1c_date                   date,
  ADD COLUMN IF NOT EXISTS condition_pad              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pad_details                text,
  ADD COLUMN IF NOT EXISTS condition_venous_insufficiency boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition_neuropathy       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition_immunosuppression boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS immunosuppression_details  text,
  ADD COLUMN IF NOT EXISTS condition_malnutrition     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS albumin_value              numeric(4,2),
  ADD COLUMN IF NOT EXISTS condition_smoking          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition_renal_disease    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS egfr_value                 numeric(5,1),
  ADD COLUMN IF NOT EXISTS condition_other            text;

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_a1c_value_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_a1c_value_check
    CHECK (a1c_value IS NULL OR (a1c_value >= 3.0 AND a1c_value <= 20.0));

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_albumin_value_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_albumin_value_check
    CHECK (albumin_value IS NULL OR (albumin_value >= 0.5 AND albumin_value <= 6.0));

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_egfr_value_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_egfr_value_check
    CHECK (egfr_value IS NULL OR (egfr_value >= 0 AND egfr_value <= 200));

-- -----------------------------------------------------------------------------
-- 3. Wound etiology + onset (Section 8 — WOUND TYPE)
--
-- The existing `wound_type` column on the parent `orders` table stays as the
-- chronic / post_surgical switch that drives the form variant. These flags
-- capture the more granular Fortify-style etiology breakdown (DFU / venous /
-- pressure / arterial / surgical / traumatic / other), which can co-exist
-- (e.g. a diabetic foot ulcer that is also venous).
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS etiology_dfu           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiology_venous_stasis boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiology_pressure_ulcer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pressure_ulcer_stage   text,
  ADD COLUMN IF NOT EXISTS etiology_arterial      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiology_surgical      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiology_traumatic     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiology_other         text,
  ADD COLUMN IF NOT EXISTS wound_onset_date       date,
  ADD COLUMN IF NOT EXISTS wound_duration_text    text;

COMMENT ON COLUMN public.order_form.pressure_ulcer_stage IS
  'I | II | III | IV | Unstageable | Suspected DTI — only meaningful when etiology_pressure_ulcer is true.';
COMMENT ON COLUMN public.order_form.wound_duration_text IS
  'Free-text wound duration (e.g. "6 weeks"). Auto-computed from wound_onset_date in UI but stored to allow manual override.';

-- -----------------------------------------------------------------------------
-- 4. Wound-bed + pain + infection + photo (Section 10-11 — MEASUREMENTS block)
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS wound_bed_slough_pct     numeric(5,2),
  ADD COLUMN IF NOT EXISTS wound_bed_eschar_pct     numeric(5,2),
  ADD COLUMN IF NOT EXISTS pain_level               integer,
  ADD COLUMN IF NOT EXISTS infection_signs_describe text,
  ADD COLUMN IF NOT EXISTS wound_photo_taken        boolean DEFAULT false;

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_wound_bed_slough_pct_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_wound_bed_slough_pct_check
    CHECK (wound_bed_slough_pct IS NULL
        OR (wound_bed_slough_pct >= 0 AND wound_bed_slough_pct <= 100));

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_wound_bed_eschar_pct_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_wound_bed_eschar_pct_check
    CHECK (wound_bed_eschar_pct IS NULL
        OR (wound_bed_eschar_pct >= 0 AND wound_bed_eschar_pct <= 100));

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_pain_level_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_pain_level_check
    CHECK (pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10));

-- -----------------------------------------------------------------------------
-- 5. Prior treatments + advancement reason (NESTED inside Section 15 TREATMENT
--    PLAN — rendered as a small table with add/remove rows)
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS prior_treatments    jsonb   DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS advancement_reason  text;

COMMENT ON COLUMN public.order_form.prior_treatments IS
  'Array of { treatment, dates_used, outcome } — captures conservative-treatment history required by most surgical-dressing LCDs.';

-- -----------------------------------------------------------------------------
-- 6. Treatment plan structure (Section 15 — TREATMENT PLAN)
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS goal_of_therapy        text,
  ADD COLUMN IF NOT EXISTS goal_of_therapy_other  text,
  ADD COLUMN IF NOT EXISTS adjunct_offloading     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjunct_compression    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjunct_debridement    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjunct_other          text,
  ADD COLUMN IF NOT EXISTS specialty_consults     text;

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_goal_of_therapy_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_goal_of_therapy_check
    CHECK (goal_of_therapy IS NULL OR goal_of_therapy IN (
      'complete_healing',
      'wound_bed_prep',
      'palliative',
      'infection_control',
      'other'
    ));

-- -----------------------------------------------------------------------------
-- 7. Product modifiers + prior-auth flag + frequency
--    (Section 17 — PRODUCT DISPENSED, top-level on the order form)
--
-- Note: HCPCS modifiers also live on order_form_1500 / order_items. Per spec
-- decision (#7), KX/GA modifiers are duplicated here so the Order Form PDF
-- shows them at-a-glance to the physician at sign time.
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS application_frequency text,
  ADD COLUMN IF NOT EXISTS special_modifiers     text,
  ADD COLUMN IF NOT EXISTS prior_auth_obtained   boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- 8. Coverage self-check (NEW MICRO-BLOCK between Section 18 FOLLOW UP and
--    Section 19 SIGNATURE — admin-editable; clinician sees but cannot edit)
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS lcd_reference              text,
  ADD COLUMN IF NOT EXISTS wound_meets_lcd            boolean,
  ADD COLUMN IF NOT EXISTS conservative_tx_period_met boolean,
  ADD COLUMN IF NOT EXISTS qty_within_lcd_limits      boolean,
  ADD COLUMN IF NOT EXISTS kx_criteria_met            text,
  ADD COLUMN IF NOT EXISTS pos_eligible               boolean,
  ADD COLUMN IF NOT EXISTS coverage_concerns          text;

ALTER TABLE public.order_form
  DROP CONSTRAINT IF EXISTS order_form_kx_criteria_met_check;
ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_kx_criteria_met_check
    CHECK (kx_criteria_met IS NULL OR kx_criteria_met IN ('yes', 'no', 'na'));

-- -----------------------------------------------------------------------------
-- 9. Physician NPI + 5-point attestation (Section 19 — SIGNATURE)
--
-- These five booleans gate the on-screen Sign button. The attestation
-- corresponds verbatim to the Fortify physician-order certification:
--   1. Examined patient personally
--   2. Product is medically necessary for this wound
--   3. Conservative treatments tried and inadequate
--   4. Frequency/quantity reflect physician clinical judgment
--   5. Documentation supports the applicable LCD/NCD
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS physician_npi                       text,
  ADD COLUMN IF NOT EXISTS attest_examined_patient             boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS attest_medically_necessary          boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS attest_conservative_tx_inadequate   boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS attest_freq_qty_clinical_judgment   boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS attest_lcd_supported                boolean DEFAULT false NOT NULL;

-- -----------------------------------------------------------------------------
-- 10. Office tracking (admin-only collapsible panel below Section 19)
--
-- Stored as JSONB so we can iterate the shape without further migrations.
-- Expected keys:
--   method_of_receipt        text
--   baa_in_place             boolean
--   reviewed_by              text
--   documentation_complete   boolean
--   gaps_identified          text
--   gaps_communicated_at     date
--   gaps_resolved_at         date
--   released_to_fulfillment  boolean
--   released_to_fulfillment_at date
--   filed_in_repository      boolean
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS office_tracking jsonb DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.order_form.office_tracking IS
  'Admin-only office-use tracking (receipt method, BAA flag, reviewer, gaps log, fulfillment release). Never rendered on the patient-facing PDF.';

COMMIT;
