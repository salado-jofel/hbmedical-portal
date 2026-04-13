/**
 * Maps order_form_1500 DB columns to Cigna CMS-1500 fillable PDF field names.
 * PDF is 612×792 pts; image scale factor = 2.0833 (1275/612).
 */

/** All text fields: { pdfFieldName: dbColumn | null } */
export const TEXT_FIELD_MAP: Record<string, string | null> = {
  // Box 1a — Insured's ID number
  insurance_id: "insured_id_number",
  // Box 2 — Patient name
  pt_name: null, // computed: "last_name, first_name MI"
  // Box 3 — Patient DOB
  birth_mm: null, // computed from patient_dob
  birth_dd: null,
  birth_yy: null,
  // Box 4 — Insured name (computed)
  ins_name: null,
  // Box 5 — Patient address
  pt_street: "patient_address",
  pt_city: "patient_city",
  pt_state: "patient_state",
  pt_zip: "patient_zip",
  pt_AreaCode: null, // computed from patient_phone
  pt_phone: null,    // computed from patient_phone
  // Box 7 — Insured address
  ins_street: "insured_address",
  ins_city: "insured_city",
  ins_state: "insured_state",
  ins_zip: "insured_zip",
  "ins_phone area": null, // computed from insured_phone
  ins_phone: null,        // computed from insured_phone
  // Box 9 — Other insured name
  other_ins_name: "other_insured_name",
  // Box 9a — Other insured policy
  other_ins_policy: "other_insured_policy",
  // Box 9d — Other insured plan name  (PDF field name "41")
  other_ins_plan_name: "other_insured_plan",
  // Box 10d — Accident place (state)
  accident_place: "condition_auto_state",
  // Box 11 — Insured policy group
  ins_policy: "insured_policy_group",
  // Box 11a — Insured DOB
  ins_dob_mm: null, // computed from insured_dob
  ins_dob_dd: null,
  ins_dob_yy: null,
  // Box 11c — Insured plan name
  ins_plan_name: "insured_plan_name",
  // Box 12 — Patient signature
  pt_signature: "patient_signature",
  pt_date: null, // computed from patient_signature_date
  // Box 13 — Insured signature
  ins_signature: "insured_signature",
  // Box 14 — Illness date
  cur_ill_mm: null, // computed from illness_date
  cur_ill_dd: null,
  cur_ill_yy: null,
  // Box 15 — Other date
  sim_ill_mm: null, // computed from other_date
  sim_ill_dd: null,
  sim_ill_yy: null,
  // Box 16 — Unable to work
  work_mm_from: null, // computed from unable_work_from
  work_dd_from: null,
  work_yy_from: null,
  work_mm_end: null, // computed from unable_work_to
  work_dd_end: null,
  work_yy_end: null,
  // Box 17 — Referring provider
  ref_physician: "referring_provider_name",
  "physician number 17a1": "referring_provider_qual",
  "physician number 17a": "referring_provider_npi",
  id_physician: null, // same as referring_provider_npi in 17b
  // Box 18 — Hospitalization dates
  hosp_mm_from: null, // computed from hospitalization_from
  hosp_dd_from: null,
  hosp_yy_from: null,
  hosp_mm_end: null, // computed from hospitalization_to
  hosp_dd_end: null,
  hosp_yy_end: null,
  // Box 19 — Additional claim info
  "96": "additional_claim_info",
  // Box 20 — Outside lab charges
  charge: null, // computed from outside_lab_charges
  // Box 21 — Diagnosis codes
  diagnosis1: "diagnosis_a",
  diagnosis2: "diagnosis_b",
  diagnosis3: "diagnosis_c",
  diagnosis4: "diagnosis_d",
  diagnosis5: "diagnosis_e",
  diagnosis6: "diagnosis_f",
  diagnosis7: "diagnosis_g",
  diagnosis8: "diagnosis_h",
  diagnosis9: "diagnosis_i",
  diagnosis10: "diagnosis_j",
  diagnosis11: "diagnosis_k",
  diagnosis12: "diagnosis_l",
  // Box 22 — Resubmission
  medicaid_resub: "resubmission_code",
  original_ref: "original_ref_number",
  // Box 23 — Prior auth
  prior_auth: "prior_auth_number",
  // Box 25 — Federal tax ID
  tax_id: "federal_tax_id",
  // Box 26 — Patient account number
  pt_account: "patient_account_number",
  // Box 28 — Total charge
  t_charge: null, // computed from total_charge
  // Box 29 — Amount paid
  amt_paid: null, // computed from amount_paid
  // Box 31 — Physician signature
  physician_signature: "physician_signature",
  physician_date: null, // computed from physician_signature_date
  // Box 32 — Service facility
  fac_name: "service_facility_name",
  fac_street: null, // computed from service_facility_address (line 1)
  fac_location: null, // computed from service_facility_address (line 2)
  pin1: "service_facility_npi",
  grp1: null,
  // Box 33 — Billing provider
  doc_name: "billing_provider_name",
  doc_street: null, // computed from billing_provider_address (line 1)
  doc_location: null, // computed from billing_provider_address (line 2)
  "doc_phone area": null, // computed from billing_provider_phone
  doc_phone: null,        // computed from billing_provider_phone
  pin: "billing_provider_npi",
  grp: "billing_provider_tax_id",
};

/** Checkbox fields: each entry maps a db column to PDF field name + checked value */
export interface CheckboxEntry {
  field: string;    // PDF field name
  value: string;    // which option value checks this box
}

/** Insurance type (Box 1): db column = insurance_type, values = pdf field names */
export const INSURANCE_TYPE_FIELDS: Record<string, string> = {
  medicare:           "insurance_type",
  medicaid:           "insurance_type",
  tricare:            "insurance_type",
  champva:            "insurance_type",
  group_health_plan:  "insurance_type",
  feca_blk_lung:      "insurance_type",
  other:              "insurance_type",
};

/** Box 3 sex */
export const PATIENT_SEX_FIELDS = { M: "sex", F: "sex" } as const;

/** Box 6 patient relationship to insured */
export const RELATIONSHIP_FIELDS = {
  self:   "rel_to_ins",
  spouse: "rel_to_ins",
  child:  "rel_to_ins",
  other:  "rel_to_ins",
} as const;

/** Box 10a–c */
export const CONDITION_FIELDS = {
  employment:     "employment",
  auto_accident:  "pt_auto_accident",
  other_accident: "other_accident",
} as const;

/** Box 11a insured sex */
export const INSURED_SEX_FIELDS = { M: "ins_sex", F: "ins_sex" } as const;

/** Box 11d another health benefit plan */
export const BENEFIT_PLAN_FIELD = "ins_benefit_plan";

/** Box 20 outside lab */
export const OUTSIDE_LAB_FIELD = "lab";

/** Box 25 SSN/EIN */
export const TAX_ID_TYPE_FIELD = "ssn"; // SSN widget name; EIN is separate widget same field

/** Box 27 accept assignment */
export const ACCEPT_ASSIGNMENT_FIELD = "assignment";

/** Service line field name templates — replace N with 1-6 */
export const SL_FIELD_TEMPLATES = {
  mm_from: "sv{N}_mm_from",
  dd_from: "sv{N}_dd_from",
  yy_from: "sv{N}_yy_from",
  mm_end:  "sv{N}_mm_end",
  dd_end:  "sv{N}_dd_end",
  yy_end:  "sv{N}_yy_end",
  place:   "place{N}",
  type:    "type{N}",
  cpt:     "cpt{N}",
  mod1:    "mod{N}",
  mod2:    "mod{N}a",
  mod3:    "mod{N}b",
  mod4:    "mod{N}c",
  diag:    "diag{N}",
  charges: "ch{N}",
  days:    "day{N}",
  epsdt:   "epsdt{N}",
  id_qual: "local{N}a",
  npi:     "local{N}",
} as const;

/** Resolve service line field name for a given line index (1-based) */
export function slField(template: string, lineNum: number): string {
  return template.replace("{N}", String(lineNum));
}

/** Split a date string (YYYY-MM-DD) into {mm, dd, yy} */
export function splitDate(date: string | null | undefined): { mm: string; dd: string; yy: string } {
  if (!date) return { mm: "", dd: "", yy: "" };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { mm: "", dd: "", yy: "" };
  return {
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
    yy: String(d.getUTCFullYear()),
  };
}

/** Split a 10-digit phone into { area, number } */
export function splitPhone(phone: string | null | undefined): { area: string; number: string } {
  if (!phone) return { area: "", number: "" };
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return { area: digits.slice(0, 3), number: digits.slice(3) };
  if (digits.length === 7) return { area: "", number: digits };
  return { area: "", number: phone };
}

/** Split an address string into two lines at the first comma or newline */
export function splitAddress(addr: string | null | undefined): { line1: string; line2: string } {
  if (!addr) return { line1: "", line2: "" };
  const idx = addr.search(/[,\n]/);
  if (idx === -1) return { line1: addr.trim(), line2: "" };
  return { line1: addr.slice(0, idx).trim(), line2: addr.slice(idx + 1).trim() };
}
