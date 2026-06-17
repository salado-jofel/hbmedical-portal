-- Phase 2 of the DFU/VLU wound-type expansion. Adds the order_form
-- columns needed to render the two new wound-type-specific variants
-- (Fortify-template-style Statement of Medical Necessity forms).
--
-- VLU = Venous Leg Ulcer; DFU = Diabetic Foot Ulcer.
-- Both variants reuse the chronic form's existing patient/wound/etiology
-- columns where the data overlaps; these new columns capture the fields
-- that are specific to each clinical pathway.
--
-- Straight ADD COLUMN + ADD CONSTRAINT per project pattern. No backfill
-- needed since columns are nullable and no rows yet have wound_type
-- = 'dfu' or 'vlu' (Phase 1 just added the buttons).

ALTER TABLE public.order_form
  -- ============================================================
  -- VLU fields (Venous Leg Ulcer — Skin Substitute order)
  -- ============================================================
  -- CEAP Classification: standardized venous severity scale.
  -- C0..C6 plus symptomatic variants C0s..C6s. Nullable text.
  ADD COLUMN ceap_classification text,
  -- Relevant vascular history (CVI, prior DVT, varicosities, recurrence).
  ADD COLUMN relevant_vascular_history text,
  -- Total wound surface area in cm² (often calculated from L×W, but
  -- physicians may override with caliper / planimetry measurement).
  ADD COLUMN wound_surface_area_cm2 numeric,
  -- Periwound + edema status (maceration, hyperpigmentation,
  -- lipodermatosclerosis).
  ADD COLUMN periwound_status text,
  -- Active infection note + treatment status (free text).
  ADD COLUMN signs_active_infection text,
  -- Compression therapy type / class (e.g., "multilayer wrap", "30-40 mmHg").
  ADD COLUMN compression_type_class text,
  -- Initial vs current wound area — tracks healing trajectory (the
  -- "less than 50% reduction in 4 weeks" threshold for medical necessity).
  ADD COLUMN initial_wound_area_cm2 numeric,
  ADD COLUMN current_wound_area_cm2 numeric,
  -- Venous studies findings (duplex ultrasound results, reflux time, etc.).
  ADD COLUMN venous_studies_findings text,
  -- Arterial supply adequate for safe compression?
  ADD COLUMN arterial_supply_adequate_yn boolean,
  ADD COLUMN arterial_supply_basis text,
  -- Treatment plan — skin substitute product details.
  -- skin_substitute_product is free text since not all products in
  -- the order_items list will match a hardcoded enum; HCPCS is
  -- captured separately for billing.
  ADD COLUMN skin_substitute_product text,
  ADD COLUMN skin_substitute_hcpcs text,
  ADD COLUMN anticipated_applications_count integer,
  ADD COLUMN application_interval text,
  -- Long-form clinical rationale / statement of medical necessity.
  ADD COLUMN clinical_rationale_text text,

  -- ============================================================
  -- DFU fields (Diabetic Foot Ulcer — Advanced Procedural order)
  -- ============================================================
  ADD COLUMN referring_provider text,
  -- Diabetes type ("type_1", "type_2").
  ADD COLUMN diabetes_type text,
  -- Wagner Grade (0..5) — standardized DFU classification.
  ADD COLUMN wagner_grade smallint,
  -- University of Texas Stage/Grade — alphanumeric ("1-A", "2-B", ...).
  ADD COLUMN ut_stage_grade text,
  -- Osteomyelitis presence ("none", "suspected", "confirmed").
  ADD COLUMN osteomyelitis_status text,
  -- Basis for osteomyelitis call (imaging / pathology / clinical).
  ADD COLUMN osteomyelitis_basis text,
  -- Depth + structures exposed (tendon, capsule, bone).
  ADD COLUMN depth_structures_exposed text,
  -- Tissue quality breakdown (JSONB: granular_pct, fibrinous_pct,
  -- necrotic_pct, biofilm_present, eschar_present).
  ADD COLUMN tissue_quality_breakdown jsonb,
  -- Infection status category ("none", "local", "deep", "systemic").
  ADD COLUMN infection_status_category text,
  ADD COLUMN infection_cultures text,
  ADD COLUMN current_antibiotics text,
  -- Vascular / perfusion assessment specific to DFU.
  ADD COLUMN tcpo2_value numeric,
  ADD COLUMN pedal_pulses text,
  ADD COLUMN vascular_surgery_referral boolean,
  ADD COLUMN vascular_surgery_details text,
  ADD COLUMN perfusion_summary text,
  -- Conservative care measured response.
  ADD COLUMN measured_response text,
  -- Procedures requested (JSONB array — multi-select with CPT codes).
  ADD COLUMN dfu_procedures jsonb,
  -- Planned procedure metadata.
  ADD COLUMN planned_procedure_date date,
  -- Setting: "or" | "office" | "asc" | "other".
  ADD COLUMN procedure_setting text,
  -- Four narrative justification sections — each is JSONB:
  --   { statements: ['key1', 'key2', ...], case_specific: 'text' }
  -- Modeled this way so adding/removing statement options later
  -- doesn't require a schema migration.
  ADD COLUMN narrative_progression jsonb,
  ADD COLUMN narrative_less_intensive jsonb,
  ADD COLUMN narrative_limb_loss jsonb,
  ADD COLUMN narrative_perfusion jsonb,
  -- Additional free-form narrative.
  ADD COLUMN additional_narrative text,
  -- Physician metadata specific to DFU procedures (surgeon credentials).
  ADD COLUMN physician_specialty text,
  ADD COLUMN physician_state_license text;

-- =================================================================
-- CHECK constraints — bound enum-like fields + positive integers.
-- All allow NULL since clinicians can leave fields blank.
-- =================================================================

ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_ceap_classification_check
    CHECK ((ceap_classification IS NULL)
        OR (ceap_classification = ANY (ARRAY[
              'C0','C1','C2','C3','C4','C5','C6',
              'C0s','C1s','C2s','C3s','C4s','C5s','C6s'
            ]))),
  ADD CONSTRAINT order_form_diabetes_type_check
    CHECK ((diabetes_type IS NULL)
        OR (diabetes_type = ANY (ARRAY['type_1','type_2']))),
  ADD CONSTRAINT order_form_wagner_grade_check
    CHECK ((wagner_grade IS NULL)
        OR (wagner_grade BETWEEN 0 AND 5)),
  ADD CONSTRAINT order_form_osteomyelitis_status_check
    CHECK ((osteomyelitis_status IS NULL)
        OR (osteomyelitis_status = ANY (ARRAY['none','suspected','confirmed']))),
  ADD CONSTRAINT order_form_infection_status_category_check
    CHECK ((infection_status_category IS NULL)
        OR (infection_status_category = ANY (ARRAY['none','local','deep','systemic']))),
  ADD CONSTRAINT order_form_procedure_setting_check
    CHECK ((procedure_setting IS NULL)
        OR (procedure_setting = ANY (ARRAY['or','office','asc','other']))),
  ADD CONSTRAINT order_form_anticipated_applications_count_check
    CHECK ((anticipated_applications_count IS NULL)
        OR (anticipated_applications_count > 0)),
  ADD CONSTRAINT order_form_tcpo2_value_check
    CHECK ((tcpo2_value IS NULL)
        OR (tcpo2_value >= 0));
