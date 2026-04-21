/* ──────────────────────────────────────────────────────────────────────────
 *  Per-document configuration for the 6 sales-rep onboarding contracts.
 *
 *  Each entry defines:
 *    - `fields` — schema used to render the UI form + validate submissions.
 *                 Each field's `key` maps DIRECTLY to the AcroForm field name
 *                 in the source PDF (configured when Genspark converted the
 *                 templates). For radios, `options[].value` must match the
 *                 AcroForm export value exactly.
 *    - `steps`  — optional multi-step grouping for the sign modal.
 *
 *  The server-side stamper (lib/pdf/sign-sales-rep-contract.ts) uses these
 *  keys to call form.getTextField(key).setText(value) /
 *  form.getRadioGroup(key).select(value) — no coordinate drawing involved.
 * ──────────────────────────────────────────────────────────────────────── */

export type SalesRepContractKey =
  | "code_of_conduct"
  | "conflict_of_interest"
  | "hep_b_consent"
  | "i9"
  | "tb_risk_assessment"
  | "w9";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "date"
  | "radio"
  | "ssn"
  | "ein";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  maxLength?: number;
  helpText?: string;
  /** Gate the field by another field's value; returns true to show */
  showIf?: (form: Record<string, unknown>) => boolean;
  /** UI multi-step index (0-based). Omit = step 0. */
  step?: number;
}

export interface ContractDef {
  key: SalesRepContractKey;
  label: string;
  storagePath: string;
  steps: string[];
  fields: FieldDef[];
}

/* ──────────────────────────────────────────────────────────────────────── */

export const SALES_REP_CONTRACTS: readonly ContractDef[] = [
  // ───────────────────────────────────────────────────────────────
  // 1. Code of Conduct
  // ───────────────────────────────────────────────────────────────
  {
    key: "code_of_conduct",
    label: "Code of Conduct",
    storagePath: "sales-rep-contracts-readonly/code-of-conduct.pdf",
    steps: ["Review & Sign"],
    fields: [
      { key: "staff_member", label: "Staff Member (printed name)", type: "text", required: true, step: 0 },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 2. Conflict of Interest
  // ───────────────────────────────────────────────────────────────
  {
    key: "conflict_of_interest",
    label: "Conflict of Interest",
    storagePath: "sales-rep-contracts-readonly/conflict-of-interest.pdf",
    steps: ["Identity", "Disclosures", "Sign"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true, step: 0 },
      { key: "contact_address", label: "Contact Address", type: "text", required: true, step: 0, placeholder: "Street, City, State, ZIP" },
      { key: "section_i", label: "I. Financial Interests (for myself and my immediate family)", type: "textarea", step: 1, placeholder: "Leave blank if none to disclose." },
      { key: "section_ii", label: "II. Officers, Directorships and Salaried Employments", type: "textarea", step: 1, placeholder: "Leave blank if none to disclose." },
      { key: "section_iii", label: "III. Businesses to which services were furnished", type: "textarea", step: 1, placeholder: "Leave blank if none to disclose." },
      { key: "section_iv", label: "IV. Compensation for Expenses", type: "textarea", step: 1, placeholder: "Leave blank if none to disclose." },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 3. Hep B Consent
  // ───────────────────────────────────────────────────────────────
  {
    key: "hep_b_consent",
    label: "Hepatitis B Vaccination Consent / Waiver",
    storagePath: "sales-rep-contracts-readonly/hep-b-consent.pdf",
    steps: ["Choose & Sign"],
    fields: [
      { key: "name", label: "Name (Please Print)", type: "text", required: true, step: 0 },
      {
        key: "vaccine_choice",
        label: "Your choice",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "accept", label: "I would like the Hepatitis B Vaccine" },
          { value: "decline", label: "I decline the Hepatitis B Vaccine (sign waiver)" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 4. I-9 — Section 1 only (employee self-attestation)
  // ───────────────────────────────────────────────────────────────
  {
    key: "i9",
    label: "Form I-9 (Employment Eligibility)",
    storagePath: "sales-rep-contracts-readonly/i9.pdf",
    steps: ["Identity", "Address", "Personal", "Citizenship", "Sign"],
    fields: [
      { key: "last_name", label: "Last Name (Family Name)", type: "text", required: true, step: 0 },
      { key: "first_name", label: "First Name (Given Name)", type: "text", required: true, step: 0 },
      { key: "middle_initial", label: "Middle Initial", type: "text", maxLength: 2, step: 0 },
      { key: "other_last_names", label: "Other Last Names Used (or N/A)", type: "text", step: 0 },

      { key: "address_street", label: "Address (Street Number and Name)", type: "text", required: true, step: 1 },
      { key: "address_apt", label: "Apt. Number", type: "text", step: 1 },
      { key: "address_city", label: "City or Town", type: "text", required: true, step: 1 },
      { key: "address_state", label: "State", type: "text", required: true, maxLength: 2, step: 1 },
      { key: "address_zip", label: "ZIP Code", type: "text", required: true, step: 1 },

      { key: "dob", label: "Date of Birth (mm/dd/yyyy)", type: "date", required: true, step: 2 },
      { key: "ssn", label: "U.S. Social Security Number", type: "ssn", required: true, step: 2 },
      { key: "email", label: "Email Address", type: "email", required: true, step: 2 },
      { key: "phone", label: "Telephone Number", type: "tel", required: true, step: 2 },

      {
        key: "citizenship",
        label: "I am (check one):",
        type: "radio",
        required: true,
        step: 3,
        options: [
          { value: "citizen", label: "A citizen of the United States" },
          { value: "national", label: "A noncitizen national of the United States" },
          { value: "lpr", label: "A lawful permanent resident" },
          { value: "authorized", label: "A noncitizen authorized to work" },
        ],
      },
      {
        key: "uscis_number",
        label: "USCIS/Alien Registration Number",
        type: "text",
        step: 3,
        showIf: (f) => f.citizenship === "lpr" || f.citizenship === "authorized",
      },
      {
        key: "work_until",
        label: "Work Authorization Expiration Date (mm/dd/yyyy)",
        type: "date",
        step: 3,
        showIf: (f) => f.citizenship === "authorized",
      },
      {
        key: "i94_number",
        label: "Form I-94 Admission Number (alt. to USCIS #)",
        type: "text",
        step: 3,
        showIf: (f) => f.citizenship === "authorized",
      },
      {
        key: "passport_number",
        label: "Foreign Passport Number (alt. to USCIS #)",
        type: "text",
        step: 3,
        showIf: (f) => f.citizenship === "authorized",
      },
      {
        key: "passport_country",
        label: "Country of Issuance",
        type: "text",
        step: 3,
        showIf: (f) => f.citizenship === "authorized",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 5. TB Risk Assessment
  // ───────────────────────────────────────────────────────────────
  {
    key: "tb_risk_assessment",
    label: "TB Risk Assessment",
    storagePath: "sales-rep-contracts-readonly/tb-risk-assessment.pdf",
    steps: ["Risk Questions", "Sign"],
    fields: [
      {
        key: "group_1",
        label: "Temporary or permanent residence of ≥1 month in a country with a high TB rate?",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "Yes", label: "Yes" },
          { value: "NO", label: "No" },
        ],
      },
      {
        key: "Current or planned immunosuppression",
        label: "Current or planned immunosuppression?",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "Yes", label: "Yes" },
          { value: "NO", label: "No" },
        ],
      },
      {
        key: "group_3",
        label: "Close contact with someone who has had infectious TB since the last TB test?",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "Yes", label: "Yes" },
          { value: "NO", label: "No" },
        ],
      },
      { key: "name", label: "Name (printed)", type: "text", required: true, step: 1 },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 6. W-9
  // ───────────────────────────────────────────────────────────────
  {
    key: "w9",
    label: "W-9 Taxpayer ID Certification",
    storagePath: "sales-rep-contracts-readonly/w9.pdf",
    steps: ["Name & Classification", "Exemptions", "Address", "TIN", "Sign"],
    fields: [
      { key: "name", label: "Name (as shown on your income tax return)", type: "text", required: true, step: 0 },
      { key: "business_name", label: "Business name / disregarded entity (if different)", type: "text", step: 0 },
      {
        key: "classification",
        label: "Federal tax classification",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "individual", label: "Individual / sole proprietor" },
          { value: "c_corp", label: "C Corporation" },
          { value: "s_corp", label: "S Corporation" },
          { value: "partnership", label: "Partnership" },
          { value: "trust_estate", label: "Trust / estate" },
          { value: "llc", label: "Limited liability company (LLC)" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "llc_tax_class",
        label: "LLC tax classification (C, S, or P)",
        type: "text",
        maxLength: 1,
        step: 0,
        showIf: (f) => f.classification === "llc",
      },
      {
        key: "other_class",
        label: "Describe other classification",
        type: "text",
        step: 0,
        showIf: (f) => f.classification === "other",
      },

      { key: "exempt_payee_code", label: "Exempt payee code (if any)", type: "text", step: 1 },
      { key: "fatca_code", label: "FATCA exemption code (if any)", type: "text", step: 1 },

      { key: "address", label: "Address (number, street, apt/suite)", type: "text", required: true, step: 2 },
      { key: "city_state_zip", label: "City, state, ZIP", type: "text", required: true, step: 2 },
      { key: "requester", label: "Requester's name and address (optional)", type: "textarea", step: 2 },
      { key: "account_numbers", label: "Account numbers (optional)", type: "text", step: 2 },

      {
        key: "tin_type",
        label: "Type of TIN",
        type: "radio",
        required: true,
        step: 3,
        options: [
          { value: "ssn", label: "Social Security Number (SSN)" },
          { value: "ein", label: "Employer Identification Number (EIN)" },
        ],
      },
      { key: "ssn", label: "SSN (XXX-XX-XXXX)", type: "ssn", step: 3, showIf: (f) => f.tin_type === "ssn" },
      { key: "ein", label: "EIN (XX-XXXXXXX)", type: "ein", step: 3, showIf: (f) => f.tin_type === "ein" },
    ],
  },
] as const;

/* ── Helpers ── */

export function getContractDef(key: SalesRepContractKey): ContractDef | undefined {
  return SALES_REP_CONTRACTS.find((c) => c.key === key);
}

export function salesRepContractSignedPath(
  inviteToken: string,
  key: SalesRepContractKey,
): string {
  return `sales-rep-contracts-signed/${inviteToken}/${key}.pdf`;
}
