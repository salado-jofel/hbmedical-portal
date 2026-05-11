// Transfer of Value Tracking — constants for the monthly Sunshine Act /
// Open Payments report filed by each sales rep.
//
// See the 14-page client form: "HB Medical | Transfer of Value Tracking Form".

export const VALUE_REPORTS_TABLE = "sales_rep_value_reports" as const;
export const VALUE_TRANSFER_ENTRIES_TABLE = "value_transfer_entries" as const;
export const VALUE_GROUP_MEAL_ENTRIES_TABLE = "value_group_meal_entries" as const;
export const VALUE_SAMPLE_ENTRIES_TABLE = "value_sample_entries" as const;

export const TRANSFERS_OF_VALUE_PATH = "/dashboard/transfers-of-value" as const;

export const VALUE_REPORTS_SUBMIT_TO_EMAIL = "ben@hbmedicalsupplies.io" as const;

/* ── Report status ── */
export const VALUE_REPORT_STATUSES = ["draft", "submitted", "reviewed"] as const;
export type ValueReportStatus = (typeof VALUE_REPORT_STATUSES)[number];

export const VALUE_REPORT_STATUS_LABELS: Record<ValueReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

/* ── Consulting / honoraria status (Section 5) ── */
export const CONSULTING_STATUSES = [
  "referred_to_compliance",
  "contract_pending",
  "contract_executed",
] as const;
export type ConsultingStatus = (typeof CONSULTING_STATUSES)[number];

export const CONSULTING_STATUS_LABELS: Record<ConsultingStatus, string> = {
  referred_to_compliance: "Referred to compliance",
  contract_pending: "Contract pending",
  contract_executed: "Contract executed",
};

/* ── Covered Recipient credentials (Section 2.1) ──
 * Physicians: MD, DO, DDS, DMD, DPM, OD, DC
 * Non-physician practitioners (added 2021): PA, NP, CNS, CRNA, CNM
 * Plus the institutional case (teaching hospital) and an OTHER escape hatch.
 */
export const RECIPIENT_CREDENTIALS = [
  "MD",
  "DO",
  "DDS",
  "DMD",
  "DPM",
  "OD",
  "DC",
  "PA",
  "NP",
  "CNS",
  "CRNA",
  "CNM",
  "TEACHING_HOSPITAL",
  "OTHER",
] as const;
export type RecipientCredential = (typeof RECIPIENT_CREDENTIALS)[number];

export const RECIPIENT_CREDENTIAL_LABELS: Record<RecipientCredential, string> = {
  MD: "MD — Medical Doctor",
  DO: "DO — Doctor of Osteopathic Medicine",
  DDS: "DDS — Dentist",
  DMD: "DMD — Dentist",
  DPM: "DPM — Podiatrist",
  OD: "OD — Optometrist",
  DC: "DC — Chiropractor",
  PA: "PA — Physician Assistant",
  NP: "NP — Nurse Practitioner",
  CNS: "CNS — Clinical Nurse Specialist",
  CRNA: "CRNA — Nurse Anesthetist",
  CNM: "CNM — Nurse Midwife",
  TEACHING_HOSPITAL: "Teaching Hospital",
  OTHER: "Other",
};

/* ── Form / category of transfer (Open Payments CMS taxonomy) ── */
export const FORM_CATEGORIES = [
  "meal",
  "beverage",
  "gift",
  "travel",
  "lodging",
  "honorarium",
  "consulting_fee",
  "education",
  "royalty",
  "entertainment",
  "charitable_contribution",
  "grant",
  "other",
] as const;
export type FormCategory = (typeof FORM_CATEGORIES)[number];

export const FORM_CATEGORY_LABELS: Record<FormCategory, string> = {
  meal: "Meal",
  beverage: "Beverage",
  gift: "Gift",
  travel: "Travel",
  lodging: "Lodging",
  honorarium: "Honorarium",
  consulting_fee: "Consulting Fee",
  education: "Education",
  royalty: "Royalty / License",
  entertainment: "Entertainment",
  charitable_contribution: "Charitable Contribution",
  grant: "Grant",
  other: "Other",
};

/* ── CMS Open Payments mapping (used for the appendix / future export) ── */
export const FORM_CATEGORY_CMS_LABEL: Record<FormCategory, string> = {
  meal: "Food and Beverage",
  beverage: "Food and Beverage",
  gift: "Gift",
  travel: "Travel and Lodging",
  lodging: "Travel and Lodging",
  honorarium: "Honoraria",
  consulting_fee: "Consulting Fee",
  education: "Education",
  royalty: "Royalty or License",
  entertainment: "Entertainment",
  charitable_contribution: "Charitable Contribution",
  grant: "Grant",
  other: "Compensation for services other than consulting / Faculty/Speaker comp",
};

/* ── Section 6 compliance flags ──
 * Each flag has a boolean column and a `_note` describe column on
 * `sales_rep_value_reports`. Order matches the PDF.
 */
export const COMPLIANCE_FLAGS = [
  {
    key: "flag_recipient_no_report",
    noteKey: "flag_recipient_no_report_note",
    question:
      "Did any Covered Recipient request that a transfer of value not be reported?",
  },
  {
    key: "flag_ownership_inquiry",
    noteKey: "flag_ownership_inquiry_note",
    question:
      "Did any Covered Recipient inquire about ownership or investment opportunities in HB Medical?",
  },
  {
    key: "flag_mischaracterize",
    noteKey: "flag_mischaracterize_note",
    question:
      "Did any Covered Recipient request payments characterized as anything other than what they actually were?",
  },
  {
    key: "flag_third_party",
    noteKey: "flag_third_party_note",
    question:
      "Were any items of value provided to a Covered Recipient by a third party (other vendor, hospital, GPO) at the Representative's suggestion?",
  },
  {
    key: "flag_funding_for_referrals",
    noteKey: "flag_funding_for_referrals_note",
    question:
      "Did any Covered Recipient request that HB Medical provide funding to any organization (charity, foundation, society) in exchange for or in connection with the Covered Recipient's referrals?",
  },
  {
    key: "flag_family_member",
    noteKey: "flag_family_member_note",
    question:
      "Were any transfers of value provided to a family member of a Covered Recipient (spouse, dependent child)?",
  },
  {
    key: "flag_other",
    noteKey: "flag_other_note",
    question:
      "Any other circumstance that should be brought to the attention of the compliance team?",
  },
] as const;

export type ComplianceFlagKey = (typeof COMPLIANCE_FLAGS)[number]["key"];
export type ComplianceFlagNoteKey =
  (typeof COMPLIANCE_FLAGS)[number]["noteKey"];

/* ── Section 7 — the five Representative certifications signed at submit. ── */
export const CERTIFICATIONS = [
  "The information provided in this Form is true, complete, and accurate to the best of my knowledge.",
  "All transfers of value made to Covered Recipients during the reporting month are documented in this Form, except those specifically excluded under the rules described in Section 2.4.",
  "I have not knowingly omitted any transfer of value, characterized any transfer of value other than as it actually was, or arranged for any transfer of value to be made indirectly to a Covered Recipient through a third party.",
  "I have complied with all applicable provisions of Article 5 of the Sales Representative Agreement (Healthcare Regulatory Compliance) during the reporting month, including the Anti-Kickback Statute, Stark Law, FDA promotional regulations, and the AdvaMed Code.",
  "I have flagged any circumstances in Section 6 that may require further review.",
] as const;

/* ── Reporting thresholds (2024 — adjusted annually by CMS for inflation) ── */
export const DE_MINIMIS_TRANSFER_USD = 11.05;
export const ANNUAL_AGGREGATE_THRESHOLD_USD = 110.46;

/* ── Month labels for UI dropdowns ── */
export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
