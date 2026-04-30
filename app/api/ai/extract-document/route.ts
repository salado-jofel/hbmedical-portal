// ── GOOGLE GEMINI (active for testing — free tier) ────────────────────────
// import { createGoogleGenerativeAI } from "@ai-sdk/google";
// const aiModel = createGoogleGenerativeAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// ── ANTHROPIC CLAUDE (commented out — restore when ready) ─────────────────
import { createAnthropic } from "@ai-sdk/anthropic";
const aiModel = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderPdf, type OrderPdfFormType } from "@/lib/pdf/generate-order-pdfs";
import { NextRequest, NextResponse } from "next/server";
import {
  requireOrderAccess,
  orderAccessErrorStatus,
  OrderAccessError,
} from "@/lib/supabase/order-access";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
import { safeLogError } from "@/lib/logging/safe-log";

// Vercel Pro plan supports up to 300s. The combined extraction (download
// docs → Claude inference → DB writes → mark ai_extracted=true) usually
// finishes inside 30-45s but can spike to 90-120s on a 30-page clinical
// chart. PDF generation is fire-and-forget after the flag flip, so the
// 5-minute ceiling is plenty of headroom.
export const maxDuration = 300;

/* ── Retry + timeout helpers ────────────────────────────────────────────── */

/** Bounded sleep helper. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Download a file from Supabase Storage with one retry on transient errors.
 * The failure mode it guards against is a brief Supabase storage hiccup
 * (5xx or connection reset) that resolves within ~1s — without this, a
 * single transient error blows up the whole extraction pipeline. Two
 * attempts is sufficient for transient noise; persistent failures bubble
 * up after the second try.
 */
async function downloadWithRetry(
  adminClient: ReturnType<typeof createAdminClient>,
  bucket: string,
  filePath: string,
): Promise<Blob> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data, error } = await adminClient.storage
      .from(bucket)
      .download(filePath);
    if (data) return data;
    lastError = error;
    if (attempt === 1) {
      console.warn(
        `[downloadWithRetry] attempt 1 failed for ${filePath}, retrying:`,
        error?.message,
      );
      await sleep(1000);
    }
  }
  throw new Error(
    `Failed to download ${filePath} after 2 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/**
 * Anthropic call timeout — set just below the Vercel maxDuration so we
 * fail with a clean abort error instead of a hard process kill. 240s
 * gives Claude enough time for very large chronic-care docs while still
 * leaving 60s of headroom for DB writes + flag flip.
 */
const CLAUDE_TIMEOUT_MS = 240_000;

/* ── Field sanitizers ── */

const ORDER_FORM_ALLOWED_FIELDS = new Set([
  "wound_visit_number",
  "chief_complaint",
  "has_vasculitis_or_burns",
  "is_receiving_home_health",
  "is_patient_at_snf",
  "icd10_code",
  "followup_days",
  "wound_site",
  "wound_stage",
  "wound_length_cm",
  "wound_width_cm",
  "wound_depth_cm",
  "subjective_symptoms",
  "clinical_notes",
  // Medical conditions
  "condition_decreased_mobility",
  "condition_diabetes",
  "condition_infection",
  "condition_cvd",
  "condition_copd",
  "condition_chf",
  "condition_anemia",
  // Blood thinners
  "use_blood_thinners",
  "blood_thinner_details",
  // Wound details
  "wound_location_side",
  "granulation_tissue_pct",
  "exudate_amount",
  "third_degree_burns",
  "active_vasculitis",
  "active_charcot",
  "skin_condition",
  // Second wound
  "wound2_length_cm",
  "wound2_width_cm",
  "wound2_depth_cm",
  // Treatment
  "treatment_plan",
  /* ── Fortify expansion (added 2026-04-30) ──
     The 5-attestation booleans (`attest_*`) are intentionally NOT in this
     allowlist — those must be physician-affirmed and never AI-prefilled.
     Office-tracking JSONB likewise stays admin-only. */
  "patient_mrn",
  "patient_mbi",
  "insurance_type_label",
  "anticipated_dos_start",
  "anticipated_dos_end",
  "a1c_value",
  "a1c_date",
  "condition_pad",
  "pad_details",
  "condition_venous_insufficiency",
  "condition_neuropathy",
  "condition_immunosuppression",
  "immunosuppression_details",
  "condition_malnutrition",
  "albumin_value",
  "condition_smoking",
  "condition_renal_disease",
  "egfr_value",
  "condition_other",
  "etiology_dfu",
  "etiology_venous_stasis",
  "etiology_pressure_ulcer",
  "pressure_ulcer_stage",
  "etiology_arterial",
  "etiology_surgical",
  "etiology_traumatic",
  "etiology_other",
  "wound_onset_date",
  "wound_duration_text",
  "wound_bed_slough_pct",
  "wound_bed_eschar_pct",
  "pain_level",
  "infection_signs_describe",
  "wound_photo_taken",
  "prior_treatments",
  "advancement_reason",
  "goal_of_therapy",
  "goal_of_therapy_other",
  "adjunct_offloading",
  "adjunct_compression",
  "adjunct_debridement",
  "adjunct_other",
  "specialty_consults",
  "application_frequency",
  "special_modifiers",
  "prior_auth_obtained",
  "lcd_reference",
  "wound_meets_lcd",
  "conservative_tx_period_met",
  "qty_within_lcd_limits",
  "kx_criteria_met",
  "pos_eligible",
  "coverage_concerns",
  "physician_npi",
]);

const ORDER_FORM_FIELD_ALIASES: Record<string, string> = {
  is_receiving_health: "is_receiving_home_health",
  receiving_home_health: "is_receiving_home_health",
  home_health: "is_receiving_home_health",
  is_home_health: "is_receiving_home_health",
  vasculitis_or_burns: "has_vasculitis_or_burns",
  has_vasculitis: "has_vasculitis_or_burns",
  vasculitis: "has_vasculitis_or_burns",
  patient_at_snf: "is_patient_at_snf",
  snf: "is_patient_at_snf",
  icd10: "icd10_code",
  icd_10_code: "icd10_code",
  icd_10: "icd10_code",
  diagnosis_code: "icd10_code",
  followup: "followup_days",
  follow_up_days: "followup_days",
  follow_up: "followup_days",
  visit_number: "wound_visit_number",
  wound_visit: "wound_visit_number",
  wound_length: "wound_length_cm",
  wound_width: "wound_width_cm",
  wound_depth: "wound_depth_cm",
  length_cm: "wound_length_cm",
  width_cm: "wound_width_cm",
  depth_cm: "wound_depth_cm",
  symptoms: "subjective_symptoms",
  notes: "clinical_notes",
  complaint: "chief_complaint",
  // Medical condition aliases
  decreased_mobility: "condition_decreased_mobility",
  diabetes: "condition_diabetes",
  infection: "condition_infection",
  cardiovascular_disease: "condition_cvd",
  copd: "condition_copd",
  chf: "condition_chf",
  anemia: "condition_anemia",
  // Blood thinner aliases
  blood_thinners: "use_blood_thinners",
  on_blood_thinners: "use_blood_thinners",
  blood_thinner_medications: "blood_thinner_details",
  // Wound detail aliases
  wound_side: "wound_location_side",
  laterality: "wound_location_side",
  granulation_pct: "granulation_tissue_pct",
  granulation_percentage: "granulation_tissue_pct",
  exudate: "exudate_amount",
  drainage_amount: "exudate_amount",
  burns_third_degree: "third_degree_burns",
  charcot: "active_charcot",
  periwound_skin: "skin_condition",
  skin_type: "skin_condition",
  // Second wound aliases
  wound2_length: "wound2_length_cm",
  wound2_width: "wound2_width_cm",
  wound2_depth: "wound2_depth_cm",
  // Treatment aliases
  plan: "treatment_plan",
  dressing_plan: "treatment_plan",
  /* ── Fortify expansion aliases ── */
  mrn: "patient_mrn",
  medical_record_number: "patient_mrn",
  medicare_id: "patient_mbi",
  mbi: "patient_mbi",
  beneficiary_id: "patient_mbi",
  insurance_class: "insurance_type_label",
  coverage_type: "insurance_type_label",
  anticipated_service_start: "anticipated_dos_start",
  anticipated_service_end: "anticipated_dos_end",
  service_start: "anticipated_dos_start",
  service_end: "anticipated_dos_end",
  date_of_service_start: "anticipated_dos_start",
  date_of_service_end: "anticipated_dos_end",
  a1c: "a1c_value",
  hba1c: "a1c_value",
  hemoglobin_a1c: "a1c_value",
  albumin: "albumin_value",
  serum_albumin: "albumin_value",
  egfr: "egfr_value",
  pad: "condition_pad",
  peripheral_arterial_disease: "condition_pad",
  vascular_insufficiency: "condition_pad",
  venous_insufficiency: "condition_venous_insufficiency",
  neuropathy: "condition_neuropathy",
  immunosuppressed: "condition_immunosuppression",
  immunosuppression: "condition_immunosuppression",
  malnutrition: "condition_malnutrition",
  smoking: "condition_smoking",
  smoker: "condition_smoking",
  active_smoker: "condition_smoking",
  renal_disease: "condition_renal_disease",
  ckd: "condition_renal_disease",
  diabetic_foot_ulcer: "etiology_dfu",
  dfu: "etiology_dfu",
  venous_stasis: "etiology_venous_stasis",
  venous_stasis_ulcer: "etiology_venous_stasis",
  pressure_ulcer: "etiology_pressure_ulcer",
  arterial_ulcer: "etiology_arterial",
  surgical_wound: "etiology_surgical",
  traumatic_wound: "etiology_traumatic",
  ulcer_stage: "pressure_ulcer_stage",
  pu_stage: "pressure_ulcer_stage",
  onset_date: "wound_onset_date",
  wound_onset: "wound_onset_date",
  duration: "wound_duration_text",
  wound_age: "wound_duration_text",
  slough_pct: "wound_bed_slough_pct",
  slough_percentage: "wound_bed_slough_pct",
  eschar_pct: "wound_bed_eschar_pct",
  eschar_percentage: "wound_bed_eschar_pct",
  pain: "pain_level",
  pain_score: "pain_level",
  pain_scale: "pain_level",
  infection_description: "infection_signs_describe",
  signs_of_infection: "infection_signs_describe",
  prior_treatment: "prior_treatments",
  previous_treatments: "prior_treatments",
  conservative_treatments: "prior_treatments",
  advancement: "advancement_reason",
  reason_for_advancing: "advancement_reason",
  therapy_goal: "goal_of_therapy",
  goal: "goal_of_therapy",
  offloading: "adjunct_offloading",
  compression: "adjunct_compression",
  debridement: "adjunct_debridement",
  consults: "specialty_consults",
  specialist_consults: "specialty_consults",
  consultations: "specialty_consults",
  frequency: "application_frequency",
  application_freq: "application_frequency",
  dressing_frequency: "application_frequency",
  modifiers: "special_modifiers",
  hcpcs_modifiers: "special_modifiers",
  prior_auth: "prior_auth_obtained",
  prior_authorization: "prior_auth_obtained",
  pa_obtained: "prior_auth_obtained",
  lcd: "lcd_reference",
  ncd: "lcd_reference",
  lcd_ref: "lcd_reference",
  npi: "physician_npi",
  ordering_physician_npi: "physician_npi",
};

function sanitizeOrderFormFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_FORM_FIELD_ALIASES[key] ?? key;
    if (ORDER_FORM_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    } else {
      console.warn(
        `[extract-document] Unknown order_form field ignored: ${key}`,
      );
    }
  }
  return sanitized;
}

const ORDER_FORM_1500_ALLOWED_FIELDS = new Set([
  "insurance_type",
  "insured_id_number",
  "patient_last_name",
  "patient_first_name",
  "patient_middle_initial",
  "patient_dob",
  "patient_sex",
  "insured_last_name",
  "insured_first_name",
  "insured_middle_initial",
  "patient_address",
  "patient_city",
  "patient_state",
  "patient_zip",
  "patient_phone",
  "patient_relationship",
  "insured_address",
  "insured_city",
  "insured_state",
  "insured_zip",
  "insured_phone",
  "insured_policy_group",
  "insured_dob",
  "insured_sex",
  "insured_employer",
  "insured_plan_name",
  "another_health_benefit",
  "accept_assignment",
  "federal_tax_id",
  "patient_account_number",
  "billing_provider_name",
  "billing_provider_address",
  "billing_provider_phone",
  "billing_provider_npi",
  // Diagnosis codes (box 21 on CMS-1500) — populated from order_form.icd10_code + clinical context
  "diagnosis_a",
  "diagnosis_b",
  "diagnosis_c",
  "diagnosis_d",
  "diagnosis_e",
  "diagnosis_f",
  "diagnosis_g",
  "diagnosis_h",
  "diagnosis_i",
  "diagnosis_j",
  "diagnosis_k",
  "diagnosis_l",
]);

const ORDER_FORM_1500_ALIASES: Record<string, string> = {
  patient_date_of_birth: "patient_dob",
  date_of_birth: "patient_dob",
  dob: "patient_dob",
  gender: "patient_sex",
  sex: "patient_sex",
  insurance: "insurance_type",
  plan_type: "insurance_type",
  member_id: "insured_id_number",
  policy_number: "insured_id_number",
  subscriber_id: "insured_id_number",
  group_number: "insured_policy_group",
  group_no: "insured_policy_group",
  plan_name: "insured_plan_name",
  employer: "insured_employer",
  relationship: "patient_relationship",
  patient_rel: "patient_relationship",
};

const INSURANCE_TYPE_NORMALIZE: Record<string, string> = {
  medicare: "medicare",
  medicaid: "medicaid",
  tricare: "tricare",
  champva: "champva",
  group_health_plan: "group_health_plan",
  group: "group_health_plan",
  "group health plan": "group_health_plan",
  feca_blk_lung: "feca_blk_lung",
  feca: "feca_blk_lung",
  "black lung": "feca_blk_lung",
  other: "other",
};

function sanitizeForm1500Fields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_FORM_1500_ALIASES[key] ?? key;
    if (ORDER_FORM_1500_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    } else {
      console.warn(
        `[extract-document] Unknown order_form_1500 field ignored: ${key}`,
      );
    }
  }
  // Normalize insurance_type to the exact values allowed by the DB check constraint
  if (typeof sanitized.insurance_type === "string") {
    const normalized = INSURANCE_TYPE_NORMALIZE[sanitized.insurance_type.toLowerCase().trim()];
    sanitized.insurance_type = normalized ?? null;
  }
  return sanitized;
}

const ORDER_IVR_ALLOWED_FIELDS = new Set([
  // Primary insurance
  "insurance_provider",
  "insurance_phone",
  "member_id",
  "group_number",
  "plan_name",
  "plan_type",
  "subscriber_name",
  "subscriber_dob",
  "subscriber_relationship",
  "coverage_start_date",
  "coverage_end_date",
  // Patient context (facesheet-extractable)
  "patient_phone",
  "patient_address",
  // Secondary insurance
  "secondary_insurance_provider",
  "secondary_insurance_phone",
  "secondary_subscriber_name",
  "secondary_policy_number",
  "secondary_subscriber_dob",
  "secondary_plan_type",
  "secondary_group_number",
  "secondary_subscriber_relationship",
]);

const ORDER_IVR_ALIASES: Record<string, string> = {
  insured_plan_name: "plan_name",
  insured_id_number: "member_id",
  insured_policy_group: "group_number",
  insurance_name: "insurance_provider",
  insured_dob: "subscriber_dob",
  patient_relationship: "subscriber_relationship",
};

function sanitizeIvrFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // Combine insured_first_name + insured_last_name → subscriber_name (single text column)
  const firstName = raw.insured_first_name as string | undefined;
  const lastName = raw.insured_last_name as string | undefined;
  const working: Record<string, unknown> = { ...raw };
  if (firstName || lastName) {
    const full = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (full) working.subscriber_name = full;
  }
  delete working.insured_first_name;
  delete working.insured_last_name;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(working)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_IVR_ALIASES[key] ?? key;
    if (ORDER_IVR_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    }
  }
  return sanitized;
}

/* ── PDF generation helper ── */

const PDF_FORM_TYPES: OrderPdfFormType[] = ["order_form", "ivr", "hcfa_1500"];

async function generateAllPdfsInParallel(orderId: string): Promise<void> {
  const results = await Promise.allSettled(
    PDF_FORM_TYPES.map((formType) => generateOrderPdf(orderId, formType)),
  );
  results.forEach((r, i) => {
    const formType = PDF_FORM_TYPES[i];
    if (r.status === "rejected") {
      console.error(`[extract] ${formType} PDF rejected:`, r.reason);
    } else if (!r.value.success) {
      console.error(`[extract] ${formType} PDF failed:`, r.value.error);
    } else {
      console.log(`[extract] ${formType} PDF ok:`, r.value.filePath);
    }
  });
}

/* ── Combined prompt ── */

function buildCombinedPrompt(): string {
  return `You are a medical data extraction specialist.
You have received TWO medical documents:
- Document 1 is the PATIENT FACESHEET — extract patient demographics and insurance data.
- Document 2 is the CLINICAL DOCUMENTATION — extract wound assessment and clinical data.

Extract ALL fields from both documents into a single JSON response.
Return ONLY a valid JSON object. Use null for string/number fields not found.
Use false for boolean fields not mentioned. No text outside the JSON.

{
  "patient_last_name": string | null,
  "patient_first_name": string | null,
  "patient_middle_initial": string | null,
  "patient_dob": "YYYY-MM-DD" | null,
  "patient_sex": "male" | "female" | "other" | null,
  "patient_address": string | null,
  "patient_city": string | null,
  "patient_state": string | null,
  "patient_zip": string | null,
  "patient_phone": string | null,
  "insurance_type": "medicare" | "medicaid" | "tricare" | "champva" | "group_health_plan" | "other" | null,
  "insured_id_number": string | null,
  "insured_last_name": string | null,
  "insured_first_name": string | null,
  "patient_relationship": "self" | "spouse" | "child" | "other" | null,
  "insured_address": string | null,
  "insured_city": string | null,
  "insured_state": string | null,
  "insured_zip": string | null,
  "insured_phone": string | null,
  "insured_policy_group": string | null,
  "insured_dob": "YYYY-MM-DD" | null,
  "insured_sex": "male" | "female" | "other" | null,
  "insured_employer": string | null,
  "insurance_name": string | null,
  "insurance_phone": string | null,
  "insured_plan_name": string | null,
  "plan_type": "HMO" | "PPO" | "Medicare" | "Medicaid" | "Other" | null,
  "coverage_start_date": "YYYY-MM-DD" | null,
  "coverage_end_date": "YYYY-MM-DD" | null,
  "secondary_insurance_provider": string | null,
  "secondary_insurance_phone": string | null,
  "secondary_subscriber_name": string | null,
  "secondary_policy_number": string | null,
  "secondary_subscriber_dob": "YYYY-MM-DD" | null,
  "secondary_plan_type": string | null,
  "secondary_group_number": string | null,
  "secondary_subscriber_relationship": "self" | "spouse" | "child" | "other" | null,
  "chief_complaint": string | null,
  "wound_visit_number": number | null,
  "wound_site": string | null,
  "wound_stage": string | null,
  "wound_length_cm": number | null,
  "wound_width_cm": number | null,
  "wound_depth_cm": number | null,
  "has_vasculitis_or_burns": boolean,
  "is_receiving_home_health": boolean,
  "is_patient_at_snf": boolean,
  "icd10_code": string | null,
  "followup_days": 7 | 14 | 21 | 30 | null,
  "subjective_symptoms": string[],
  "clinical_notes": string | null,
  "condition_decreased_mobility": boolean,
  "condition_diabetes": boolean,
  "condition_infection": boolean,
  "condition_cvd": boolean,
  "condition_copd": boolean,
  "condition_chf": boolean,
  "condition_anemia": boolean,
  "use_blood_thinners": boolean,
  "blood_thinner_details": string | null,
  "wound_location_side": "RT" | "LT" | "bilateral" | null,
  "granulation_tissue_pct": number | null,
  "exudate_amount": "none" | "minimal" | "moderate" | "heavy" | null,
  "third_degree_burns": boolean,
  "active_vasculitis": boolean,
  "active_charcot": boolean,
  "skin_condition": "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null,
  "wound2_length_cm": number | null,
  "wound2_width_cm": number | null,
  "wound2_depth_cm": number | null,
  "treatment_plan": string | null,

  "patient_mrn": string | null,
  "patient_mbi": string | null,
  "insurance_type_label": "medicare_part_b" | "medicare_dme" | "medicare_advantage" | "commercial" | "medicaid" | "other" | null,
  "anticipated_dos_start": "YYYY-MM-DD" | null,
  "anticipated_dos_end": "YYYY-MM-DD" | null,
  "a1c_value": number | null,
  "a1c_date": "YYYY-MM-DD" | null,
  "condition_pad": boolean,
  "pad_details": string | null,
  "condition_venous_insufficiency": boolean,
  "condition_neuropathy": boolean,
  "condition_immunosuppression": boolean,
  "immunosuppression_details": string | null,
  "condition_malnutrition": boolean,
  "albumin_value": number | null,
  "condition_smoking": boolean,
  "condition_renal_disease": boolean,
  "egfr_value": number | null,
  "condition_other": string | null,
  "etiology_dfu": boolean,
  "etiology_venous_stasis": boolean,
  "etiology_pressure_ulcer": boolean,
  "pressure_ulcer_stage": "I" | "II" | "III" | "IV" | "Unstageable" | "DTI" | null,
  "etiology_arterial": boolean,
  "etiology_surgical": boolean,
  "etiology_traumatic": boolean,
  "etiology_other": string | null,
  "wound_onset_date": "YYYY-MM-DD" | null,
  "wound_duration_text": string | null,
  "wound_bed_slough_pct": number | null,
  "wound_bed_eschar_pct": number | null,
  "pain_level": number | null,
  "infection_signs_describe": string | null,
  "wound_photo_taken": boolean,
  "prior_treatments": Array<{ "treatment": string, "dates_used": string, "outcome": string }>,
  "advancement_reason": string | null,
  "goal_of_therapy": "complete_healing" | "wound_bed_prep" | "palliative" | "infection_control" | "other" | null,
  "goal_of_therapy_other": string | null,
  "adjunct_offloading": boolean,
  "adjunct_compression": boolean,
  "adjunct_debridement": boolean,
  "adjunct_other": string | null,
  "specialty_consults": string | null,
  "application_frequency": string | null,
  "special_modifiers": string | null,
  "prior_auth_obtained": boolean,
  "lcd_reference": string | null,
  "wound_meets_lcd": boolean | null,
  "conservative_tx_period_met": boolean | null,
  "qty_within_lcd_limits": boolean | null,
  "kx_criteria_met": "yes" | "no" | "na" | null,
  "pos_eligible": boolean | null,
  "coverage_concerns": string | null,
  "physician_npi": string | null
}

FACESHEET fields (patient_last_name … secondary_subscriber_relationship):
- Extract ONLY from Document 1 (facesheet).
- "insurance_name" = primary insurance COMPANY name (e.g. "BlueCross BlueShield").
- "insurance_phone" = primary insurance customer service phone (NOT the patient's phone).
- "insured_plan_name" = specific plan name (e.g. "PPO Gold 500"). Not the company name.
- "plan_type" = primary plan network type: HMO, PPO, Medicare, Medicaid, or Other.
- Populate secondary_* fields only if a second policy is explicitly shown.

CLINICAL fields (chief_complaint … treatment_plan):
- Extract ONLY from Document 2 (clinical documentation).
- Use EXACT field names including all underscores.
- condition_* fields: true if the patient's history mentions that condition.
- use_blood_thinners: true if any blood thinner is listed in the medication list.
- wound_location_side: "RT" for right, "LT" for left, "bilateral" if both sides.
- subjective_symptoms: only use values from ["Pain", "Numbness", "Fever", "Chills", "Nausea"].
- diagnosis codes (icd10_code): use the primary ICD-10 code from clinical docs (e.g. "L97.319").

FORTIFY EXTENSION fields (patient_mrn … physician_npi):
- "patient_mrn" = the clinic's medical record number printed on the chart (NOT the same as Medicare MBI).
- "patient_mbi" = the 11-character Medicare Beneficiary Identifier; extract from the facesheet.
- "insurance_type_label" — pick from the enum based on the insurance section.
- "etiology_*" booleans CAN co-exist (e.g. a diabetic foot ulcer that is also venous). Set every applicable etiology to true.
- "pressure_ulcer_stage" — only if etiology_pressure_ulcer is true. Use Roman numerals or "Unstageable" / "DTI".
- "a1c_value", "albumin_value", "egfr_value" — extract from labs section if present, else null.
- "prior_treatments" — array of { treatment, dates_used, outcome }. Look for a "Prior treatments tried" / "Conservative measures" / "Treatment history" section. Empty array if none found. ONE OBJECT PER TREATMENT TRIED — do not concatenate.
- "advancement_reason" — explanation of why prior treatments were inadequate, if stated.
- "wound_onset_date" — best-effort YYYY-MM-DD; if doc only says "3 weeks ago", leave null and put text in "wound_duration_text".
- "pain_level" — 0 to 10 integer if a pain scale is documented.
- "wound_photo_taken" — true ONLY if a photo is explicitly referenced.
- "goal_of_therapy" — pick from the enum if a treatment goal is stated; otherwise null.
- "lcd_reference", coverage flags, "physician_npi" — only set if explicitly present in the docs.
- DO NOT extract or infer any "attest_*" fields. Those are physician attestations and must be checked manually in-app.
- DO NOT extract any "office_tracking" fields. Those are admin-only fields filled after the order is received.`.trim();
}

/* ── Combined extraction handler ── */

interface CombinedDoc {
  documentType: string;
  filePath: string;
  bucket?: string;
}

async function handleCombinedExtraction(
  baseUrl: string,
  orderId: string,
  documentsArray: CombinedDoc[],
): Promise<NextResponse> {
  const adminClient = createAdminClient();

  const extractable = documentsArray.filter((d) =>
    ["facesheet", "clinical_docs"].includes(d.documentType),
  );
  if (extractable.length === 0) {
    return NextResponse.json({ success: true, skipped: true });
  }

  // If only one doc provided, route to the single-doc logic by calling the route again
  // (this handles edge cases like partial uploads gracefully)
  if (extractable.length === 1) {
    const d = extractable[0];
    const res = await fetch(`${baseUrl}/api/ai/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        documentType: d.documentType,
        filePath: d.filePath,
        bucket: d.bucket ?? "hbmedical-bucket-private",
      }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  /* ── STEP 1: Fetch context ── */
  const { data: orderCtx, error: orderCtxErr } = await adminClient
    .from("orders")
    .select(
      `*, facility:facilities!orders_facility_id_fkey(id, name, phone, contact, address_line_1, city, state, postal_code, assigned_rep), patient:patients!orders_patient_id_fkey(first_name, last_name, date_of_birth)`,
    )
    .eq("id", orderId)
    .single();

  if (orderCtxErr || !orderCtx) {
    console.error("[extract-combined] Failed to fetch order:", orderCtxErr?.message);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Manual-input orders must never receive AI extraction — all forms stay blank.
  if ((orderCtx as { manual_input?: boolean }).manual_input) {
    console.log("[extract-combined] Skipping — order.manual_input is true:", orderId);
    return NextResponse.json({ skipped: "manual_input" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facility = orderCtx.facility as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = orderCtx.patient as any;

  const { data: creator } = await adminClient
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", orderCtx.created_by)
    .maybeSingle();

  let assignedProvider: { first_name: string | null; last_name: string | null; phone: string | null } | null = null;
  if (orderCtx.assigned_provider_id) {
    const { data: ap } = await adminClient
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", orderCtx.assigned_provider_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignedProvider = ap as any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const physician = (assignedProvider || creator) as any;
  const physicianName: string | null = physician
    ? `${physician.first_name ?? ""} ${physician.last_name ?? ""}`.trim() || null
    : null;
  const patientName: string | null = patient
    ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || null
    : null;

  const { data: enrollmentRaw } = await adminClient
    .from("facility_enrollment")
    .select("*")
    .eq("facility_id", orderCtx.facility_id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enr = enrollmentRaw as any;

  const physicianId = orderCtx.assigned_provider_id || orderCtx.created_by;
  const { data: creds } = await adminClient
    .from("provider_credentials")
    .select("npi_number, ptan_number")
    .eq("user_id", physicianId)
    .maybeSingle();

  let repName: string | null = null;
  if (facility?.assigned_rep) {
    const { data: rep } = await adminClient
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", facility.assigned_rep)
      .maybeSingle();
    if (rep) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = rep as any;
      repName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || null;
    }
  }

  const addr: string | null = enr
    ? [enr.billing_address, enr.billing_city, enr.billing_state, enr.billing_zip].filter(Boolean).join(", ") || null
    : facility
      ? [facility.address_line_1, facility.city, facility.state, facility.postal_code].filter(Boolean).join(", ") || null
      : null;

  /* ── STEP 2: Download all files in parallel (with 1-retry on transient errors) ── */
  const fileContents = await Promise.all(
    extractable.map(async (d) => {
      const fileData = await downloadWithRetry(
        adminClient,
        d.bucket ?? "hbmedical-bucket-private",
        d.filePath,
      );
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const lower = d.filePath.toLowerCase();
      const mimeType = lower.endsWith(".pdf")
        ? "application/pdf"
        : lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".heic")
            ? "image/heic"
            : "image/jpeg";
      return { documentType: d.documentType, base64, mimeType };
    }),
  );

  const facesheetFile = fileContents.find((f) => f.documentType === "facesheet");
  const clinicalFile = fileContents.find((f) => f.documentType === "clinical_docs");

  /* ── STEP 3: Single combined AI call ── */
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/heic" };
  const contentBlocks: ContentBlock[] = [];

  if (facesheetFile) {
    contentBlocks.push({ type: "text", text: "Document 1 — Patient Facesheet:" });
    contentBlocks.push({
      type: "file",
      data: facesheetFile.base64,
      mediaType: facesheetFile.mimeType as "application/pdf" | "image/png" | "image/jpeg" | "image/heic",
    });
  }
  if (clinicalFile) {
    contentBlocks.push({ type: "text", text: "Document 2 — Clinical Documentation:" });
    contentBlocks.push({
      type: "file",
      data: clinicalFile.base64,
      mediaType: clinicalFile.mimeType as "application/pdf" | "image/png" | "image/jpeg" | "image/heic",
    });
  }
  contentBlocks.push({ type: "text", text: buildCombinedPrompt() });

  const { text } = await generateText({
    model: aiModel("claude-haiku-4-5-20251001"),
    messages: [{ role: "user", content: contentBlocks }],
    abortSignal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
  });

  /* ── STEP 4: Parse JSON ── */
  let extractedFields: Record<string, unknown> = {};
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
    const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[2] ?? text;
    extractedFields = JSON.parse(jsonStr.trim());
  } catch {
    safeLogError("extract-combined", "JSON parse failed", { orderId, textLength: text.length });
    return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
  }

  /* ── STEP 5: Sanitize all field types from combined response ── */
  const aiIvr = sanitizeIvrFields(extractedFields);
  const ai1500 = sanitizeForm1500Fields(extractedFields);
  const aiOf = sanitizeOrderFormFields(extractedFields);

  // Derive a single best-effort patient full name from AI-extracted first/last
  // (lives on order_form_1500). Steps 6/8 below run BEFORE Step 9 creates the
  // patient row, so the existing-patient `patientName` is null for new orders.
  // Without this, order_form.patient_name + order_ivr.patient_name end up null
  // on every freshly-AI-extracted order, even though the patient record itself
  // gets created and the order header (`patient_full_name` join) shows the name.
  const aiPatientName: string | null = (() => {
    const fn = ai1500.patient_first_name as string | null | undefined;
    const ln = ai1500.patient_last_name as string | null | undefined;
    const composed = `${fn ?? ""} ${ln ?? ""}`.trim();
    return composed || null;
  })();
  const icd10 = aiOf.icd10_code as string | null | undefined;

  /* ── STEP 6: Upsert order_ivr ── */
  {
    const ivrPayload = {
      order_id: orderId,
      ai_extracted: true,
      ai_extracted_at: new Date().toISOString(),
      ...aiIvr,
      facility_name:    (aiIvr.facility_name as string | null)    || facility?.name      || null,
      facility_npi:     (aiIvr.facility_npi as string | null)     || enr?.facility_npi   || null,
      facility_tin:     (aiIvr.facility_tin as string | null)     || enr?.facility_tin   || null,
      facility_ptan:    (aiIvr.facility_ptan as string | null)    || enr?.facility_ptan  || null,
      facility_fax:     (aiIvr.facility_fax as string | null)     || enr?.billing_fax    || null,
      facility_address: (aiIvr.facility_address as string | null) || addr                || null,
      facility_phone:   (aiIvr.facility_phone as string | null)   || enr?.billing_phone  || facility?.phone || null,
      facility_contact: (aiIvr.facility_contact as string | null) || enr?.ap_contact_name || facility?.contact || null,
      physician_name:   (aiIvr.physician_name as string | null)   || physicianName       || null,
      physician_npi:    (aiIvr.physician_npi as string | null)    || creds?.npi_number   || null,
      physician_tin:    (aiIvr.physician_tin as string | null)    || enr?.facility_tin   || null,
      physician_fax:    (aiIvr.physician_fax as string | null)    || enr?.billing_fax    || null,
      physician_address: (aiIvr.physician_address as string | null) || addr              || null,
      physician_phone:  (aiIvr.physician_phone as string | null)  || physician?.phone    || null,
      patient_name:     (aiIvr.patient_name as string | null)     || aiPatientName       || patientName         || null,
      patient_dob:      (aiIvr.patient_dob as string | null)      || patient?.date_of_birth || null,
      sales_rep_name:   repName                                                            || null,
    };

    const { error: ivrErr } = await adminClient
      .from("order_ivr")
      .upsert(ivrPayload, { onConflict: "order_id" });
    if (ivrErr) safeLogError("extract-combined", ivrErr, { phase: "order_ivr insert", orderId });
  }

  /* ── STEP 7: Upsert order_form_1500 ── */
  {
    const form1500Payload = {
      order_id: orderId,
      ...ai1500,
      ...(icd10 ? { diagnosis_a: icd10 } : {}),
      service_facility_name:    (ai1500.service_facility_name as string | null)    || facility?.name        || null,
      service_facility_address: (ai1500.service_facility_address as string | null) || addr                  || null,
      service_facility_npi:     (ai1500.service_facility_npi as string | null)     || enr?.facility_npi     || null,
      billing_provider_name:    (ai1500.billing_provider_name as string | null)    || facility?.name        || null,
      billing_provider_address: (ai1500.billing_provider_address as string | null) || addr                  || null,
      billing_provider_phone:   (ai1500.billing_provider_phone as string | null)   || enr?.billing_phone    || facility?.phone || null,
      billing_provider_npi:     (ai1500.billing_provider_npi as string | null)     || enr?.facility_npi     || null,
      billing_provider_tax_id:  (ai1500.billing_provider_tax_id as string | null)  || enr?.facility_tin     || null,
      federal_tax_id:           (ai1500.federal_tax_id as string | null)           || enr?.facility_tin     || null,
      referring_provider_name:  (ai1500.referring_provider_name as string | null)  || physicianName         || null,
      referring_provider_npi:   (ai1500.referring_provider_npi as string | null)   || creds?.npi_number     || null,
    };

    const { error: f15Err } = await adminClient
      .from("order_form_1500")
      .upsert(form1500Payload, { onConflict: "order_id" });
    if (f15Err) safeLogError("extract-combined", f15Err, { phase: "order_form_1500 insert", orderId });
  }

  /* ── STEP 8: Upsert order_form ── */
  const orderFormPayload = {
    order_id: orderId,
    ...aiOf,
    patient_name:        (aiOf.patient_name as string | null)  || aiPatientName || patientName || null,
    patient_date:        (orderCtx as Record<string, unknown>).date_of_service || null,
    physician_signature: physicianName                                         || null,
    // Mirror order_ivr / order_form_1500: prefer the AI-extracted NPI when
    // present, fall back to the assigned provider's stored credential so the
    // signature block + Fortify physician-attestation row aren't blank.
    physician_npi:       (aiOf.physician_npi as string | null) || creds?.npi_number || null,
    ai_extracted:        true,
    ai_extracted_at:     new Date().toISOString(),
  };

  const { error: ofErr } = await adminClient
    .from("order_form")
    .upsert(orderFormPayload, { onConflict: "order_id" });
  if (ofErr) safeLogError("extract-combined", ofErr, { phase: "order_form insert", orderId });

  /* ── STEP 9: Auto-create patient from facesheet data ── */
  const firstName = (ai1500.patient_first_name as string | undefined);
  const lastName  = (ai1500.patient_last_name  as string | undefined);
  const dob       = (ai1500.patient_dob        as string | undefined);

  if (firstName && lastName && !orderCtx.patient_id) {
    const { data: existingPatient } = await adminClient
      .from("patients")
      .select("id")
      .eq("facility_id", orderCtx.facility_id)
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .maybeSingle();

    let patientId: string | undefined;
    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error: patientErr } = await adminClient
        .from("patients")
        .insert({
          facility_id:   orderCtx.facility_id,
          first_name:    firstName.trim(),
          last_name:     lastName.trim(),
          date_of_birth: dob ?? null,
          is_active:     true,
        })
        .select("id")
        .single();
      if (patientErr) console.error("[extract-combined] patient create failed:", patientErr.message);
      else patientId = newPatient?.id;
    }
    if (patientId) {
      await adminClient.from("orders").update({ patient_id: patientId }).eq("id", orderId);
    }
  }

  /* ── STEP 10: Mark order AI-extracted ──
     CRITICAL ORDERING: this flag must flip BEFORE PDF generation kicks off.
     The client polls `orders.ai_extracted` to know when the form is ready
     to populate. PDFs are downstream artifacts the user doesn't need
     immediately — they get auto-regenerated on save anyway. Setting the
     flag first means the user sees their pre-filled form within ~30-45s
     of upload (Claude + DB writes), instead of waiting another 15-30s for
     PDFs to render. This was the root cause of the "AI extraction timed
     out" complaints — PDFs blocking the response was pushing total time
     past the Vercel 60s wall, and the flag never got set when it was. */
  await adminClient
    .from("orders")
    .update({ ai_extracted: true, ai_extracted_at: new Date().toISOString() })
    .eq("id", orderId);
  console.log("[extract-combined] orders.ai_extracted=true for:", orderId);

  /* ── STEP 11: Generate all 3 PDFs (fire-and-forget) ──
     We DON'T await this — it can take 15-30s and isn't on the critical
     path. The next save (any field edit, sign, etc.) regenerates the
     same PDFs anyway. If this fails for any reason, the order is still
     usable and saving will recover. */
  console.log("[extract-combined] kicking off PDF generation (background) for:", orderId);
  generateAllPdfsInParallel(orderId).catch((err) => {
    console.error("[extract-combined] background PDF gen failed:", err);
  });

  /* ── STEP 12: History log ── */
  adminClient
    .from("order_history")
    .insert({
      order_id:     orderId,
      performed_by: null,
      action:       "AI extracted patient and clinical data from uploaded documents",
      old_status:   null,
      new_status:   null,
      notes:        null,
    })
    .then(({ error }) => {
      if (error) console.error("[extract-combined] history error:", error.message);
    });

  return NextResponse.json({ success: true, combined: true });
}

/* ── Route handler ── */

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  try {
    const body = await req.json();
    const {
      orderId,
      documents: documentsArray,
      documentType,
      filePath,
      bucket,
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // ── Authorization gate ──
    // AI extraction reads order documents (facesheets, clinical docs — both
    // PHI-bearing) and writes structured data back to PHI tables. The route
    // must verify the caller is authenticated and has access to this order.
    // Without this check, anyone with a valid orderId could trigger paid AI
    // calls and exfiltrate PHI through the structured response.
    try {
      await requireOrderAccess(orderId);
    } catch (err) {
      if (err instanceof OrderAccessError) {
        return NextResponse.json(
          { error: err.message },
          { status: orderAccessErrorStatus(err) },
        );
      }
      console.error("[extract] access check failed:", err);
      return NextResponse.json(
        { error: "Access check failed." },
        { status: 500 },
      );
    }

    // Audit — AI extraction reads PHI documents (facesheet, clinical
    // notes) and writes structured fields back. Log every call.
    void logPhiAccess({
      action: "ai.extract",
      resource: "order_documents",
      orderId,
      metadata: {
        path: Array.isArray(documentsArray) ? "combined" : "legacy",
        documentType: documentType ?? null,
        documents: Array.isArray(documentsArray)
          ? documentsArray.map((d: any) => ({ type: d.documentType, hasPath: !!d.filePath }))
          : undefined,
      },
    });

    // ── Combined path: documents[] array with facesheet + clinical_docs ──
    if (Array.isArray(documentsArray) && documentsArray.length > 0) {
      return handleCombinedExtraction(baseUrl, orderId, documentsArray);
    }

    // ── Legacy single-doc path ──
    if (!documentType || !filePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["facesheet", "clinical_docs"].includes(documentType)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const adminClient = createAdminClient();

    /* ── STEP 1: Fetch ALL context before anything else ── */

    // Order + facility + patient (these FKs point to their own tables — safe to join)
    const { data: orderCtx, error: orderCtxErr } = await adminClient
      .from("orders")
      .select(
        `
        *,
        facility:facilities!orders_facility_id_fkey(id, name, phone, contact, address_line_1, city, state, postal_code, assigned_rep),
        patient:patients!orders_patient_id_fkey(first_name, last_name, date_of_birth)
      `,
      )
      .eq("id", orderId)
      .single();

    if (orderCtxErr || !orderCtx) {
      console.error("[extract] Failed to fetch order:", orderCtxErr?.message);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Manual-input orders must never receive AI extraction — all forms stay blank.
    if ((orderCtx as { manual_input?: boolean }).manual_input) {
      console.log("[extract] Skipping — order.manual_input is true:", orderId);
      return NextResponse.json({ skipped: "manual_input" });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facility = orderCtx.facility as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patient = orderCtx.patient as any;

    // Creator profile (orders.created_by → auth.users, so query profiles separately)
    const { data: creator } = await adminClient
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", orderCtx.created_by)
      .maybeSingle();

    // Assigned provider profile (may be null)
    let assignedProvider: {
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
    } | null = null;
    if (orderCtx.assigned_provider_id) {
      const { data: ap } = await adminClient
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", orderCtx.assigned_provider_id)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignedProvider = ap as any;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const physician = (assignedProvider || creator) as any;
    const physicianName: string | null = physician
      ? `${physician.first_name ?? ""} ${physician.last_name ?? ""}`.trim() ||
        null
      : null;
    const patientName: string | null = patient
      ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || null
      : null;

    // Facility enrollment
    const { data: enrollmentRaw } = await adminClient
      .from("facility_enrollment")
      .select("*")
      .eq("facility_id", orderCtx.facility_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enr = enrollmentRaw as any;

    // Provider credentials
    const physicianId = orderCtx.assigned_provider_id || orderCtx.created_by;
    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("npi_number, ptan_number")
      .eq("user_id", physicianId)
      .maybeSingle();

    // Sales rep name (facility.assigned_rep → profiles)
    let repName: string | null = null;
    if (facility?.assigned_rep) {
      const { data: rep } = await adminClient
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", facility.assigned_rep)
        .maybeSingle();
      if (rep) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = rep as any;
        repName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || null;
      }
    }

    // Billing address: enrollment first, facility fallback
    const addr: string | null = enr
      ? [
          enr.billing_address,
          enr.billing_city,
          enr.billing_state,
          enr.billing_zip,
        ]
          .filter(Boolean)
          .join(", ") || null
      : facility
        ? [
            facility.address_line_1,
            facility.city,
            facility.state,
            facility.postal_code,
          ]
            .filter(Boolean)
            .join(", ") || null
        : null;

    console.log(
      "[extract] Context — facility:",
      facility?.name ?? null,
      "| enrollment:",
      !!enr,
      "| enr.facility_npi:",
      enr?.facility_npi ?? null,
      "| physician:",
      physicianName,
      "| patient:",
      patientName,
      "| rep:",
      repName,
      "| creds.npi:",
      creds?.npi_number ?? null,
    );

    /* ── STEP 2: Download file (with 1-retry on transient storage errors) ── */
    let fileData: Blob;
    try {
      fileData = await downloadWithRetry(
        adminClient,
        bucket ?? "hbmedical-bucket-private",
        filePath,
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to download file." },
        { status: 500 },
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const lowerPath = filePath.toLowerCase();
    const mimeType = lowerPath.endsWith(".pdf")
      ? "application/pdf"
      : lowerPath.endsWith(".png")
        ? "image/png"
        : lowerPath.endsWith(".heic")
          ? "image/heic"
          : "image/jpeg";

    /* ── STEP 3: Fetch existing order_form clinical context (facesheet only) ── */
    let orderFormCtx: Record<string, unknown> | null = null;
    if (documentType === "facesheet") {
      const { data: existingForm } = await adminClient
        .from("order_form")
        .select(
          "icd10_code, chief_complaint, wound_site, wound_stage, " +
            "condition_diabetes, condition_cvd, condition_copd, condition_chf, " +
            "condition_anemia, condition_decreased_mobility, condition_infection",
        )
        .eq("order_id", orderId)
        .maybeSingle();
      orderFormCtx =
        existingForm &&
        typeof existingForm === "object" &&
        !("error" in existingForm)
          ? (existingForm as Record<string, unknown>)
          : null;
    }

    /* ── STEP 4: Call AI model ── */
    const prompt =
      documentType === "facesheet"
        ? buildFacesheetPrompt(orderFormCtx)
        : CLINICAL_DOCS_PROMPT;

    const { text } = await generateText({
      model: aiModel("claude-haiku-4-5-20251001"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: base64,
              mediaType: mimeType as
                | "application/pdf"
                | "image/png"
                | "image/jpeg"
                | "image/heic",
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    });

    /* ── STEP 5: Parse JSON response ── */
    let extractedFields: Record<string, unknown> = {};
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[2] ?? text;
      extractedFields = JSON.parse(jsonStr.trim());
    } catch {
      safeLogError("extract", "JSON parse failed", { orderId, textLength: text.length });
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 },
      );
    }

    /* ── STEP 6: Sanitize AI fields per document type ── */
    const aiIvr =
      documentType === "facesheet" ? sanitizeIvrFields(extractedFields) : {};
    const ai1500 =
      documentType === "facesheet"
        ? sanitizeForm1500Fields(extractedFields)
        : {};
    const aiOf =
      documentType === "clinical_docs"
        ? sanitizeOrderFormFields(extractedFields)
        : {};
    const icd10 = aiOf.icd10_code as string | null | undefined;

    // See note in the combined route — derive a best-effort patient name from
    // AI-extracted first/last so order_form.patient_name + order_ivr.patient_name
    // populate even on the very first extraction (before the patient row exists).
    const aiPatientName: string | null = (() => {
      const fn = ai1500.patient_first_name as string | null | undefined;
      const ln = ai1500.patient_last_name as string | null | undefined;
      const composed = `${fn ?? ""} ${ln ?? ""}`.trim();
      return composed || null;
    })();

    /* ── STEP 7: Upsert order_ivr ── */
    {
      const ivrPayload = {
        order_id: orderId,
        ai_extracted: true,
        ai_extracted_at: new Date().toISOString(),
        ...aiIvr,
        facility_name:
          (aiIvr.facility_name as string | null) || facility?.name || null,
        facility_npi:
          (aiIvr.facility_npi as string | null) || enr?.facility_npi || null,
        facility_tin:
          (aiIvr.facility_tin as string | null) || enr?.facility_tin || null,
        facility_ptan:
          (aiIvr.facility_ptan as string | null) || enr?.facility_ptan || null,
        facility_fax:
          (aiIvr.facility_fax as string | null) || enr?.billing_fax || null,
        facility_address:
          (aiIvr.facility_address as string | null) || addr || null,
        facility_phone:
          (aiIvr.facility_phone as string | null) ||
          enr?.billing_phone ||
          facility?.phone ||
          null,
        facility_contact:
          (aiIvr.facility_contact as string | null) ||
          enr?.ap_contact_name ||
          facility?.contact ||
          null,
        physician_name:
          (aiIvr.physician_name as string | null) || physicianName || null,
        physician_npi:
          (aiIvr.physician_npi as string | null) || creds?.npi_number || null,
        physician_tin:
          (aiIvr.physician_tin as string | null) || enr?.facility_tin || null,
        physician_fax:
          (aiIvr.physician_fax as string | null) || enr?.billing_fax || null,
        physician_address:
          (aiIvr.physician_address as string | null) || addr || null,
        physician_phone:
          (aiIvr.physician_phone as string | null) || physician?.phone || null,
        patient_name:
          (aiIvr.patient_name as string | null) || aiPatientName || patientName || null,
        patient_dob:
          (aiIvr.patient_dob as string | null) || patient?.date_of_birth || null,
        sales_rep_name: repName || null,
      };

      const { error: ivrErr } = await adminClient
        .from("order_ivr")
        .upsert(ivrPayload, { onConflict: "order_id" });
      if (ivrErr) {
        safeLogError("extract", ivrErr, { phase: "order_ivr insert", orderId });
      }
    }

    /* ── STEP 8: Upsert order_form_1500 ── */
    {
      const form1500Payload = {
        order_id: orderId,
        ...ai1500,
        ...(icd10 ? { diagnosis_a: icd10 } : {}),
        service_facility_name:
          (ai1500.service_facility_name as string | null) ||
          facility?.name ||
          null,
        service_facility_address:
          (ai1500.service_facility_address as string | null) || addr || null,
        service_facility_npi:
          (ai1500.service_facility_npi as string | null) ||
          enr?.facility_npi ||
          null,
        billing_provider_name:
          (ai1500.billing_provider_name as string | null) ||
          facility?.name ||
          null,
        billing_provider_address:
          (ai1500.billing_provider_address as string | null) || addr || null,
        billing_provider_phone:
          (ai1500.billing_provider_phone as string | null) ||
          enr?.billing_phone ||
          facility?.phone ||
          null,
        billing_provider_npi:
          (ai1500.billing_provider_npi as string | null) ||
          enr?.facility_npi ||
          null,
        billing_provider_tax_id:
          (ai1500.billing_provider_tax_id as string | null) ||
          enr?.facility_tin ||
          null,
        federal_tax_id:
          (ai1500.federal_tax_id as string | null) || enr?.facility_tin || null,
        referring_provider_name:
          (ai1500.referring_provider_name as string | null) ||
          physicianName ||
          null,
        referring_provider_npi:
          (ai1500.referring_provider_npi as string | null) ||
          creds?.npi_number ||
          null,
      };

      const { error: f15Err } = await adminClient
        .from("order_form_1500")
        .upsert(form1500Payload, { onConflict: "order_id" });
      if (f15Err) {
        console.error(
          "[extract] order_form_1500 FAILED:",
          JSON.stringify(f15Err),
        );
      }
    }

    /* ── STEP 9: Upsert order_form — AI clinical fields + physician/patient context ── */
    const orderFormPayload = {
      order_id: orderId,
      ...aiOf,
      patient_name: (aiOf.patient_name as string | null) || aiPatientName || patientName || null,
      patient_date: (orderCtx as any).date_of_service || null,
      physician_signature: physicianName || null,
      physician_npi: (aiOf.physician_npi as string | null) || creds?.npi_number || null,
      ai_extracted: true,
      ai_extracted_at: new Date().toISOString(),
    };

    const { error: ofErr } = await adminClient
      .from("order_form")
      .upsert(orderFormPayload, { onConflict: "order_id" });
    if (ofErr) {
      safeLogError("extract", ofErr, { phase: "order_form insert", orderId });
    } else {
      console.log(
        "[extract] order_form saved — patient_name:",
        orderFormPayload.patient_name,
        "| physician_signature:",
        orderFormPayload.physician_signature,
      );
    }

    /* ── STEP 10: Auto-create patient record from facesheet ── */
    if (documentType === "facesheet") {
      const firstName = ai1500.patient_first_name as string | undefined;
      const lastName = ai1500.patient_last_name as string | undefined;
      const dob = ai1500.patient_dob as string | undefined;

      if (firstName && lastName && !orderCtx.patient_id) {
        const { data: existingPatient } = await adminClient
          .from("patients")
          .select("id")
          .eq("facility_id", orderCtx.facility_id)
          .ilike("first_name", firstName.trim())
          .ilike("last_name", lastName.trim())
          .maybeSingle();

        let patientId: string | undefined;
        if (existingPatient) {
          patientId = existingPatient.id;
        } else {
          const { data: newPatient, error: patientErr } = await adminClient
            .from("patients")
            .insert({
              facility_id: orderCtx.facility_id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              date_of_birth: dob ?? null,
              is_active: true,
            })
            .select("id")
            .single();
          if (patientErr)
            console.error(
              "[extract] patient create failed:",
              patientErr.message,
            );
          else patientId = newPatient?.id;
        }
        if (patientId) {
          await adminClient
            .from("orders")
            .update({ patient_id: patientId })
            .eq("id", orderId);
        }
      }
    }

    /* ── STEP 11: Mark order AI-extracted (flag flip BEFORE PDFs) ──
       Same ordering rationale as the combined path — see comment there.
       Polling target flips as soon as data is in DB; PDFs render in the
       background without blocking the response. */
    await adminClient
      .from("orders")
      .update({ ai_extracted: true, ai_extracted_at: new Date().toISOString() })
      .eq("id", orderId);
    console.log("[extract] orders.ai_extracted=true for:", orderId);

    /* ── STEP 12: Generate PDFs (fire-and-forget background work) ── */
    console.log("[extract] kicking off PDF generation (background) for:", orderId);
    generateAllPdfsInParallel(orderId).catch((err) => {
      console.error("[extract] background PDF gen failed:", err);
    });

    /* ── STEP 13: History log (fire-and-forget) ── */
    adminClient
      .from("order_history")
      .insert({
        order_id: orderId,
        performed_by: null,
        action:
          documentType === "facesheet"
            ? "AI extracted patient data from facesheet"
            : "AI extracted clinical data from doctor's notes",
        old_status: null,
        new_status: null,
        notes: null,
      })
      .then(({ error }) => {
        if (error) console.error("[extract] history error:", error.message);
      });

    return NextResponse.json({ success: true, documentType, extractedFields });
  } catch (err) {
    console.error("[extract-document API]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ── Prompts ── */

/* buildFacesheetPrompt
   Injects existing order_form clinical data as text context so the AI can
   populate CMS-1500 diagnosis codes even when clinical docs were not yet
   uploaded at the time the facesheet is processed (or vice-versa). */
function buildFacesheetPrompt(
  orderFormCtx: Record<string, unknown> | null,
): string {
  const clinicalSection = orderFormCtx
    ? `

== CLINICAL CONTEXT ==
The following data was already extracted from this patient's clinical documentation.
Use it to populate diagnosis code fields on the CMS-1500. Do NOT use it to override
patient demographics or insurance fields — extract those from the facesheet image.

${JSON.stringify(orderFormCtx, null, 2)}

Mapping rules:
- icd10_code → diagnosis_a (copy the value exactly, e.g. "L97.319")
- If the patient has documented comorbidities (diabetes, CVD, COPD, CHF, anemia, infection)
  add the standard ICD-10 code for each true condition as diagnosis_b, diagnosis_c, etc.
  Common codes: diabetes=E11.9, CVD=I25.10, COPD=J44.1, CHF=I50.9, anemia=D64.9
- Leave diagnosis fields null if no clinical context is provided.
`
    : "";

  return `You are a medical data extraction specialist.
Extract patient and insurance information from this patient facesheet document.${clinicalSection}

Return ONLY a valid JSON object. Use null for any field not found. No text outside the JSON.

{
  "patient_last_name": string | null,
  "patient_first_name": string | null,
  "patient_middle_initial": string | null,
  "patient_dob": "YYYY-MM-DD" | null,
  "patient_sex": "male" | "female" | "other" | null,
  "patient_address": string | null,
  "patient_city": string | null,
  "patient_state": string | null,
  "patient_zip": string | null,
  "patient_phone": string | null,
  "insurance_type": "medicare" | "medicaid" | "tricare" | "champva" | "group_health_plan" | "other" | null,
  "insured_id_number": string | null,
  "insured_last_name": string | null,
  "insured_first_name": string | null,
  "patient_relationship": "self" | "spouse" | "child" | "other" | null,
  "insured_address": string | null,
  "insured_city": string | null,
  "insured_state": string | null,
  "insured_zip": string | null,
  "insured_phone": string | null,
  "insured_policy_group": string | null,
  "insured_dob": "YYYY-MM-DD" | null,
  "insured_sex": "male" | "female" | "other" | null,
  "insured_employer": string | null,
  "insurance_name": string | null,
  "insurance_phone": string | null,
  "insured_plan_name": string | null,
  "plan_type": "HMO" | "PPO" | "Medicare" | "Medicaid" | "Other" | null,
  "coverage_start_date": "YYYY-MM-DD" | null,
  "coverage_end_date": "YYYY-MM-DD" | null,
  "secondary_insurance_provider": string | null,
  "secondary_insurance_phone": string | null,
  "secondary_subscriber_name": string | null,
  "secondary_policy_number": string | null,
  "secondary_subscriber_dob": "YYYY-MM-DD" | null,
  "secondary_plan_type": string | null,
  "secondary_group_number": string | null,
  "secondary_subscriber_relationship": "self" | "spouse" | "child" | "other" | null,
  "diagnosis_a": string | null,
  "diagnosis_b": string | null,
  "diagnosis_c": string | null,
  "diagnosis_d": string | null,
  "diagnosis_e": string | null,
  "diagnosis_f": string | null
}

IMPORTANT:
- Extract demographics and insurance data from the facesheet IMAGE only.
- "insurance_name" is the PRIMARY insurance COMPANY name (e.g. "BlueCross BlueShield").
- "insurance_phone" is the PRIMARY insurance company's customer service phone (NOT the patient's phone).
- "insured_plan_name" is the specific plan name (e.g. "PPO Gold 500"). Do NOT put the company name here.
- "plan_type" is the PRIMARY plan network type: HMO, PPO, Medicare, Medicaid, or Other.
- "coverage_start_date" / "coverage_end_date" are the PRIMARY insurance effective dates (YYYY-MM-DD).
- Populate secondary insurance fields only if a second/secondary policy is explicitly shown.
- "secondary_insurance_provider" is the secondary insurance company name.
- "secondary_plan_type" is the plan type for the secondary policy.
- For diagnosis_a–f: use ICD-10 format (e.g. "L97.319"). Only populate if clinical context
  is provided above — do not invent codes from the facesheet alone.`.trim();
}

const CLINICAL_DOCS_PROMPT = `
You are a medical data extraction specialist.
Extract clinical information from this doctor's note, wound assessment, or clinical documentation.

IMPORTANT: Return ONLY a valid JSON object.
Use EXACTLY these field names (no abbreviations).
Use null for string/number fields not found.
Use false for boolean fields not mentioned.
No text outside the JSON.

{
  "chief_complaint": string | null,
  "wound_visit_number": number | null,
  "wound_site": string | null,
  "wound_stage": string | null,
  "wound_length_cm": number | null,
  "wound_width_cm": number | null,
  "wound_depth_cm": number | null,
  "has_vasculitis_or_burns": boolean,
  "is_receiving_home_health": boolean,
  "is_patient_at_snf": boolean,
  "icd10_code": string | null,
  "followup_days": 7 | 14 | 21 | 30 | null,
  "subjective_symptoms": string[],
  "clinical_notes": string | null,

  "condition_decreased_mobility": boolean,
  "condition_diabetes": boolean,
  "condition_infection": boolean,
  "condition_cvd": boolean,
  "condition_copd": boolean,
  "condition_chf": boolean,
  "condition_anemia": boolean,

  "use_blood_thinners": boolean,
  "blood_thinner_details": string | null,

  "wound_location_side": "RT" | "LT" | "bilateral" | null,
  "granulation_tissue_pct": number | null,
  "exudate_amount": "none" | "minimal" | "moderate" | "heavy" | null,
  "third_degree_burns": boolean,
  "active_vasculitis": boolean,
  "active_charcot": boolean,
  "skin_condition": "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null,

  "wound2_length_cm": number | null,
  "wound2_width_cm": number | null,
  "wound2_depth_cm": number | null,

  "treatment_plan": string | null,

  "patient_mrn": string | null,
  "patient_mbi": string | null,
  "insurance_type_label": "medicare_part_b" | "medicare_dme" | "medicare_advantage" | "commercial" | "medicaid" | "other" | null,
  "anticipated_dos_start": "YYYY-MM-DD" | null,
  "anticipated_dos_end": "YYYY-MM-DD" | null,
  "a1c_value": number | null,
  "a1c_date": "YYYY-MM-DD" | null,
  "condition_pad": boolean,
  "pad_details": string | null,
  "condition_venous_insufficiency": boolean,
  "condition_neuropathy": boolean,
  "condition_immunosuppression": boolean,
  "immunosuppression_details": string | null,
  "condition_malnutrition": boolean,
  "albumin_value": number | null,
  "condition_smoking": boolean,
  "condition_renal_disease": boolean,
  "egfr_value": number | null,
  "condition_other": string | null,
  "etiology_dfu": boolean,
  "etiology_venous_stasis": boolean,
  "etiology_pressure_ulcer": boolean,
  "pressure_ulcer_stage": "I" | "II" | "III" | "IV" | "Unstageable" | "DTI" | null,
  "etiology_arterial": boolean,
  "etiology_surgical": boolean,
  "etiology_traumatic": boolean,
  "etiology_other": string | null,
  "wound_onset_date": "YYYY-MM-DD" | null,
  "wound_duration_text": string | null,
  "wound_bed_slough_pct": number | null,
  "wound_bed_eschar_pct": number | null,
  "pain_level": number | null,
  "infection_signs_describe": string | null,
  "wound_photo_taken": boolean,
  "prior_treatments": Array<{ "treatment": string, "dates_used": string, "outcome": string }>,
  "advancement_reason": string | null,
  "goal_of_therapy": "complete_healing" | "wound_bed_prep" | "palliative" | "infection_control" | "other" | null,
  "goal_of_therapy_other": string | null,
  "adjunct_offloading": boolean,
  "adjunct_compression": boolean,
  "adjunct_debridement": boolean,
  "adjunct_other": string | null,
  "specialty_consults": string | null,
  "application_frequency": string | null,
  "special_modifiers": string | null,
  "prior_auth_obtained": boolean,
  "lcd_reference": string | null,
  "wound_meets_lcd": boolean | null,
  "conservative_tx_period_met": boolean | null,
  "qty_within_lcd_limits": boolean | null,
  "kx_criteria_met": "yes" | "no" | "na" | null,
  "pos_eligible": boolean | null,
  "coverage_concerns": string | null,
  "physician_npi": string | null
}

CRITICAL: Use the EXACT field names above including all underscores. For example:
  "is_receiving_home_health" NOT "is_receiving_health"
  "has_vasculitis_or_burns" NOT "has_vasculitis"
  "icd10_code" NOT "icd10" or "icd_10"
  "subjective_symptoms" NOT "symptoms"

For subjective_symptoms only use values from: ["Pain", "Numbness", "Fever", "Chills", "Nausea"]

Field guidance:
- condition_* fields: set true if the patient's history/medical records mention that condition
- use_blood_thinners: true if any blood thinner is listed in the medication list
- blood_thinner_details: list specific medications found (e.g. "ASA, Plavix, Eliquis")
- wound_location_side: "RT" for right, "LT" for left, "bilateral" if both sides
- granulation_tissue_pct: percentage (0-100) of wound bed covered by granulation tissue
- exudate_amount: overall drainage level from the wound
- third_degree_burns / active_vasculitis / active_charcot: true only if explicitly documented as active
- skin_condition: condition of the periwound/surrounding skin
- wound2_* fields: measurements for a second wound only if a second wound is documented
- treatment_plan: full treatment plan including dressing type, frequency, and wound care orders
`.trim();
