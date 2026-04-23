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
  | "checkbox"
  | "ssn"
  | "ein"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  maxLength?: number;
  helpText?: string;
  /** For `type: "file"` — accepted MIME types (passed to <input accept="">). */
  accept?: string;
  /** For `type: "file"` — max allowed upload size in bytes. */
  maxFileBytes?: number;
  /** If true, field is UI-only (no matching AcroForm field). Stamper skips it.
   *  Used for meta radios like `list_choice` that just gate showIf logic. */
  virtual?: boolean;
  /** If set, stamp as an AcroForm "comb" field — text is auto-distributed one
   *  character per cell. Value is the number of cells (= `/MaxLen`). Stripped
   *  of non-digits before stamping. Use for fields like the I-9 SSN that
   *  have visual per-digit cells drawn into the template. */
  comb?: number;
  /** Explicit font size in points for stamping (overrides pdf-lib's default
   *  auto-size, which can pick absurdly-large sizes for tall or multiline
   *  widgets). Use when a Genspark widget's /DA auto-size renders too big. */
  fontSize?: number;
  /** Gate the field by another field's value; returns true to show */
  showIf?: (form: Record<string, unknown>) => boolean;
  /** UI multi-step index (0-based). Omit = step 0. */
  step?: number;
}

export interface ContractDef {
  key: SalesRepContractKey;
  label: string;
  /** Filename under `lib/pdf/templates/` (see `CONTRACT_TEMPLATE_FILES`). */
  templateFile: string;
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
    templateFile: "code-of-conduct.pdf",
    steps: ["Confirm", "Sign"],
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
    templateFile: "conflict-of-interest.pdf",
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
    templateFile: "hep-b-consent.pdf",
    steps: ["Consent", "Sign"],
    fields: [
      { key: "name", label: "Name (Please Print)", type: "text", required: true, step: 0 },
      {
        key: "vaccine_choice",
        label: "Choose one",
        type: "radio",
        required: true,
        step: 0,
        options: [
          { value: "accept", label: "I would like the Hepatitis B Vaccine" },
          { value: "decline", label: "I would like to Refuse the Hepatitis B Vaccine" },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 4. I-9 — Section 1 (employee) + Section 2 (rep self-attests documents
  //     presented; Kelsey Celentano is pre-baked as the authorized employer
  //     rep in the template via tmp-calibrate/bake-i9-v2.mjs).
  // ───────────────────────────────────────────────────────────────
  {
    key: "i9",
    label: "Form I-9 (Employment Eligibility)",
    templateFile: "i9.pdf",
    steps: ["Identity", "Address", "Personal", "Citizenship", "Documents", "Sign"],
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
      { key: "ssn", label: "U.S. Social Security Number", type: "ssn", required: true, step: 2, comb: 9, fontSize: 8 },
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

      // ── Step 4: Documents (Section 2 — rep self-attests) ──────────────
      {
        key: "first_day_of_employment",
        label: "First Day of Employment (mm/dd/yyyy)",
        type: "date",
        required: true,
        step: 4,
      },
      {
        key: "list_choice",
        label: "Which list are you providing documents from?",
        type: "radio",
        required: true,
        virtual: true,
        step: 4,
        options: [
          { value: "A", label: "List A — one document that establishes both identity AND employment authorization" },
          { value: "B_and_C", label: "List B + List C — one identity document AND one employment-authorization document" },
        ],
        helpText:
          "You must provide EITHER one document from List A, OR one document each from Lists B and C.",
      },

      // ── List A path — visible only when list_choice === "A". Each doc's
      //    scan slot sits directly under its field group so the relationship
      //    is visually obvious. ──
      { key: "list_a_doc_1_title",      label: "List A — Document 1 Title",      type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_1_authority",  label: "Doc 1 Issuing Authority", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_1_number",     label: "Doc 1 Document Number", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_1_expiration", label: "Doc 1 Expiration Date (mm/dd/yyyy, or N/A)", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "A" },
      {
        key: "list_a_doc_1_scan",
        label: "Doc 1 Scan",
        type: "file",
        required: true,
        accept: "application/pdf,image/png,image/jpeg",
        maxFileBytes: 5 * 1024 * 1024,
        step: 4,
        showIf: (f) => f.list_choice === "A",
      },

      { key: "list_a_doc_2_title",      label: "List A — Document 2 Title (optional)",      type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_2_authority",  label: "Doc 2 Issuing Authority", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_2_number",     label: "Doc 2 Document Number", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_2_expiration", label: "Doc 2 Expiration Date", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      {
        key: "list_a_doc_2_scan",
        label: "Doc 2 Scan (optional)",
        type: "file",
        accept: "application/pdf,image/png,image/jpeg",
        maxFileBytes: 5 * 1024 * 1024,
        step: 4,
        showIf: (f) => f.list_choice === "A",
      },

      { key: "list_a_doc_3_title",      label: "List A — Document 3 Title (optional)",      type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_3_authority",  label: "Doc 3 Issuing Authority", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_3_number",     label: "Doc 3 Document Number", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      { key: "list_a_doc_3_expiration", label: "Doc 3 Expiration Date", type: "text", step: 4, showIf: (f) => f.list_choice === "A" },
      {
        key: "list_a_doc_3_scan",
        label: "Doc 3 Scan (optional)",
        type: "file",
        accept: "application/pdf,image/png,image/jpeg",
        maxFileBytes: 5 * 1024 * 1024,
        step: 4,
        showIf: (f) => f.list_choice === "A",
      },

      // ── List B + List C path — visible only when list_choice === "B_and_C" ──
      { key: "list_b_title",      label: "List B — Identity Document Title",      type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_b_authority",  label: "List B Issuing Authority", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_b_number",     label: "List B Document Number", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_b_expiration", label: "List B Expiration Date (mm/dd/yyyy, or N/A)", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      {
        key: "list_b_scan",
        label: "List B Document Scan",
        type: "file",
        required: true,
        accept: "application/pdf,image/png,image/jpeg",
        maxFileBytes: 5 * 1024 * 1024,
        step: 4,
        showIf: (f) => f.list_choice === "B_and_C",
      },

      { key: "list_c_title",      label: "List C — Employment-Authorization Document Title",      type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_c_authority",  label: "List C Issuing Authority", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_c_number",     label: "List C Document Number", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      { key: "list_c_expiration", label: "List C Expiration Date (mm/dd/yyyy, or N/A)", type: "text", required: true, step: 4, showIf: (f) => f.list_choice === "B_and_C" },
      {
        key: "list_c_scan",
        label: "List C Document Scan",
        type: "file",
        required: true,
        accept: "application/pdf,image/png,image/jpeg",
        maxFileBytes: 5 * 1024 * 1024,
        step: 4,
        showIf: (f) => f.list_choice === "B_and_C",
      },

      { key: "additional_information", label: "Additional Information (optional)", type: "textarea", step: 4 },
      { key: "alternative_procedure",  label: "Check this box if you completed Section 2 via an alternative procedure authorized by DHS (remote verification).", type: "checkbox", step: 4 },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 5. TB Risk Assessment
  // ───────────────────────────────────────────────────────────────
  {
    key: "tb_risk_assessment",
    label: "TB Risk Assessment",
    templateFile: "tb-risk-assessment.pdf",
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
    templateFile: "w9.pdf",
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

      { key: "exempt_payee_code", label: "Exempt payee code (if any)", type: "text", step: 1, fontSize: 8 },
      { key: "fatca_code", label: "FATCA exemption code (if any)", type: "text", step: 1, fontSize: 8 },

      { key: "address", label: "Address (number, street, apt/suite)", type: "text", required: true, step: 2 },
      { key: "city_state_zip", label: "City, state, ZIP", type: "text", required: true, step: 2 },
      { key: "requester", label: "Requester's name and address (optional)", type: "textarea", step: 2, fontSize: 9 },
      { key: "account_numbers", label: "Account numbers (optional)", type: "text", step: 2 },

      {
        key: "tin_type",
        label: "Type of TIN",
        type: "radio",
        required: true,
        virtual: true, // UI-only; the form visually distinguishes SSN vs EIN
                       // by which row gets filled, so no widget mark is needed.
        step: 3,
        options: [
          { value: "ssn", label: "Social Security Number (SSN)" },
          { value: "ein", label: "Employer Identification Number (EIN)" },
        ],
      },
      { key: "ssn", label: "SSN (XXX-XX-XXXX)", type: "ssn", step: 3, showIf: (f) => f.tin_type === "ssn", comb: 9 },
      { key: "ein", label: "EIN (XX-XXXXXXX)", type: "ein", step: 3, showIf: (f) => f.tin_type === "ein", comb: 9 },
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
