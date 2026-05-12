import { z } from "zod";
import {
  CONSULTING_STATUSES,
  FORM_CATEGORIES,
  RECIPIENT_CREDENTIALS,
  VALUE_REPORT_STATUSES,
  type ValueReportStatus,
  type ConsultingStatus,
  type RecipientCredential,
  type FormCategory,
} from "@/utils/constants/value-transfers";

/* ───────────────────────────────────────────────────────────────────────────
 *  Domain types — what the UI / Redux store sees (camelCase).
 *  Each maps 1:1 onto a row in the DB tables defined by
 *  20260511000000_transfer_of_value_reports.sql.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface IValueReport {
  id:               string;
  repId:            string;
  repName?:         string; // joined from profiles when needed
  reportingYear:    number;
  reportingMonth:   number; // 1-12
  territory:        string | null;
  status:           ValueReportStatus;

  // Section 5 — consulting summary
  consultingProposed: boolean;
  consultingRecipient: string | null;
  consultingTopic:     string | null;
  consultingStatus:    ConsultingStatus | null;

  // Section 6 — compliance flags (bool + describe pairs)
  flagRecipientNoReport:        boolean;
  flagRecipientNoReportNote:    string | null;
  flagOwnershipInquiry:         boolean;
  flagOwnershipInquiryNote:     string | null;
  flagMischaracterize:          boolean;
  flagMischaracterizeNote:      string | null;
  flagThirdParty:               boolean;
  flagThirdPartyNote:           string | null;
  flagFundingForReferrals:      boolean;
  flagFundingForReferralsNote:  string | null;
  flagFamilyMember:             boolean;
  flagFamilyMemberNote:         string | null;
  flagOther:                    boolean;
  flagOtherNote:                string | null;

  // Section 7 — certification (set on submit)
  certifiedName:         string | null;
  certifiedSignatureUrl: string | null;
  certifiedAt:           string | null;
  submittedAt:           string | null;
  pdfUrl:                string | null;

  // Admin-side compliance ack
  complianceReviewedBy: string | null;
  complianceReviewedAt: string | null;
  complianceIssues:     string | null;
  complianceNotes:      string | null;

  createdAt: string;
  updatedAt: string;
}

export interface IValueTransferEntry {
  id:                  string;
  reportId:            string;
  transferDate:        string;        // ISO date
  recipientName:       string;
  recipientCredential: RecipientCredential;
  recipientNpi:        string | null;
  recipientAddress:    string | null;
  affiliation:         string | null;
  formCategory:        FormCategory;
  description:         string | null;
  valueAmount:         number;
  isEstimate:          boolean;
  createdAt:           string;
  updatedAt:           string;
}

export interface IGroupMealRecipient {
  name:       string;
  credential: RecipientCredential;
  npi?:       string | null;
}

export interface IValueGroupMealEntry {
  id:                 string;
  reportId:           string;
  groupMealDate:      string;
  totalCost:          number;
  totalAttendees:     number;
  coveredRecipients:  IGroupMealRecipient[];
  notes:              string | null;
  /** Computed: totalCost / totalAttendees, applied per recipient. */
  perPersonAllocation: number;
  createdAt:          string;
  updatedAt:          string;
}

export interface IValueSampleEntry {
  id:                string;
  reportId:          string;
  sampleDate:        string;
  recipientFacility: string;
  productLot:        string;
  quantity:          number;
  purpose:           string | null;
  returnDate:        string | null;
  createdAt:         string;
  updatedAt:         string;
}

/** Rolled-up stats for the report header (Section 3.2). */
export interface IValueReportSummary {
  totalTransfers:    number;
  distinctRecipients: number;
  totalValueUsd:     number;
  hasComplianceFlags: boolean;
}

/* ───────────────────────────────────────────────────────────────────────────
 *  Form-state interfaces (returned from server actions via useActionState).
 * ─────────────────────────────────────────────────────────────────────────── */

export interface IValueReportFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<"reporting_year" | "reporting_month" | "territory", string>>;
  reportId?: string;
}

export interface IValueTransferEntryFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<
    | "transfer_date"
    | "recipient_name"
    | "recipient_credential"
    | "recipient_npi"
    | "form_category"
    | "value_amount",
    string
  >>;
  entryId?: string;
}

export interface IValueGroupMealEntryFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<
    "group_meal_date" | "total_cost" | "total_attendees" | "covered_recipients",
    string
  >>;
  entryId?: string;
}

export interface IValueSampleEntryFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<
    "sample_date" | "recipient_facility" | "product_lot" | "quantity",
    string
  >>;
  entryId?: string;
}

export interface ISubmitReportFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<"certified_name" | "certified_signature_url" | "certifications", string>>;
}

export interface ISubmitReportResult extends ISubmitReportFormState {
  report?: IValueReport;
}

/* ───────────────────────────────────────────────────────────────────────────
 *  Zod schemas — validate FormData / JSON before hitting the DB.
 * ─────────────────────────────────────────────────────────────────────────── */

export const createValueReportSchema = z.object({
  reporting_year: z.coerce.number().int().min(2020).max(2100),
  reporting_month: z.coerce.number().int().min(1).max(12),
  territory: z.string().trim().max(120).optional().nullable(),
});

export const valueTransferEntrySchema = z.object({
  transfer_date: z.string().min(1, "Transfer date is required."),
  recipient_name: z.string().trim().min(1, "Recipient name is required.").max(240),
  recipient_credential: z.enum(RECIPIENT_CREDENTIALS),
  recipient_npi: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "NPI must be 10 digits.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  recipient_address: z.string().trim().max(500).optional().nullable(),
  affiliation: z.string().trim().max(240).optional().nullable(),
  form_category: z.enum(FORM_CATEGORIES),
  description: z.string().trim().max(1000).optional().nullable(),
  value_amount: z.coerce.number().min(0, "Value must be ≥ 0."),
  is_estimate: z.coerce.boolean().optional().default(false),
});

export const groupMealRecipientSchema = z.object({
  name: z.string().trim().min(1).max(240),
  credential: z.enum(RECIPIENT_CREDENTIALS),
  npi: z.string().trim().optional().nullable(),
});

export const valueGroupMealEntrySchema = z.object({
  group_meal_date: z.string().min(1, "Date is required."),
  total_cost: z.coerce.number().min(0, "Total cost must be ≥ 0."),
  total_attendees: z.coerce.number().int().min(1, "Must have at least 1 attendee."),
  covered_recipients: z.array(groupMealRecipientSchema).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const valueSampleEntrySchema = z.object({
  sample_date: z.string().min(1, "Date is required."),
  recipient_facility: z.string().trim().min(1, "Recipient/facility is required.").max(240),
  product_lot: z.string().trim().min(1, "Product/lot is required.").max(240),
  quantity: z.coerce.number().int().min(1, "Quantity must be ≥ 1."),
  purpose: z.string().trim().max(500).optional().nullable(),
  return_date: z.string().optional().nullable(),
});

export const submitReportSchema = z.object({
  certified_name: z.string().trim().min(1, "Type your full name to certify."),
  certified_signature_url: z.string().trim().min(1, "Signature is required."),
});

/* ───────────────────────────────────────────────────────────────────────────
 *  Mappers — snake_case DB row → camelCase domain type.
 * ─────────────────────────────────────────────────────────────────────────── */

type DbValueReport = Record<string, unknown> & {
  id: string;
  rep_id: string;
  reporting_year: number;
  reporting_month: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export function mapValueReport(row: DbValueReport): IValueReport {
  const repProfile = (row as { rep?: { first_name?: string | null; last_name?: string | null } }).rep;
  const repName = repProfile
    ? `${repProfile.first_name ?? ""} ${repProfile.last_name ?? ""}`.trim() || undefined
    : undefined;

  return {
    id:             row.id,
    repId:          row.rep_id,
    repName,
    reportingYear:  row.reporting_year,
    reportingMonth: row.reporting_month,
    territory:      (row.territory as string | null) ?? null,
    status:         (VALUE_REPORT_STATUSES as readonly string[]).includes(row.status)
                      ? (row.status as ValueReportStatus)
                      : "draft",

    consultingProposed:  Boolean(row.consulting_proposed),
    consultingRecipient: (row.consulting_recipient as string | null) ?? null,
    consultingTopic:     (row.consulting_topic as string | null) ?? null,
    consultingStatus:    ((row.consulting_status as ConsultingStatus | null) ?? null),

    flagRecipientNoReport:       Boolean(row.flag_recipient_no_report),
    flagRecipientNoReportNote:   (row.flag_recipient_no_report_note as string | null) ?? null,
    flagOwnershipInquiry:        Boolean(row.flag_ownership_inquiry),
    flagOwnershipInquiryNote:    (row.flag_ownership_inquiry_note as string | null) ?? null,
    flagMischaracterize:         Boolean(row.flag_mischaracterize),
    flagMischaracterizeNote:     (row.flag_mischaracterize_note as string | null) ?? null,
    flagThirdParty:              Boolean(row.flag_third_party),
    flagThirdPartyNote:          (row.flag_third_party_note as string | null) ?? null,
    flagFundingForReferrals:     Boolean(row.flag_funding_for_referrals),
    flagFundingForReferralsNote: (row.flag_funding_for_referrals_note as string | null) ?? null,
    flagFamilyMember:            Boolean(row.flag_family_member),
    flagFamilyMemberNote:        (row.flag_family_member_note as string | null) ?? null,
    flagOther:                   Boolean(row.flag_other),
    flagOtherNote:               (row.flag_other_note as string | null) ?? null,

    certifiedName:         (row.certified_name as string | null) ?? null,
    certifiedSignatureUrl: (row.certified_signature_url as string | null) ?? null,
    certifiedAt:           (row.certified_at as string | null) ?? null,
    submittedAt:           (row.submitted_at as string | null) ?? null,
    pdfUrl:                (row.pdf_url as string | null) ?? null,

    complianceReviewedBy: (row.compliance_reviewed_by as string | null) ?? null,
    complianceReviewedAt: (row.compliance_reviewed_at as string | null) ?? null,
    complianceIssues:     (row.compliance_issues as string | null) ?? null,
    complianceNotes:      (row.compliance_notes as string | null) ?? null,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapValueTransferEntry(row: Record<string, unknown>): IValueTransferEntry {
  return {
    id:                  row.id as string,
    reportId:            row.report_id as string,
    transferDate:        row.transfer_date as string,
    recipientName:       row.recipient_name as string,
    recipientCredential: row.recipient_credential as RecipientCredential,
    recipientNpi:        (row.recipient_npi as string | null) ?? null,
    recipientAddress:    (row.recipient_address as string | null) ?? null,
    affiliation:         (row.affiliation as string | null) ?? null,
    formCategory:        row.form_category as FormCategory,
    description:         (row.description as string | null) ?? null,
    valueAmount:         Number(row.value_amount ?? 0),
    isEstimate:          Boolean(row.is_estimate),
    createdAt:           row.created_at as string,
    updatedAt:           row.updated_at as string,
  };
}

export function mapValueGroupMealEntry(row: Record<string, unknown>): IValueGroupMealEntry {
  const totalCost = Number(row.total_cost ?? 0);
  const totalAttendees = Number(row.total_attendees ?? 1) || 1;
  const recipients = Array.isArray(row.covered_recipients)
    ? (row.covered_recipients as unknown[]).filter(
        (r): r is IGroupMealRecipient =>
          !!r && typeof r === "object" && "name" in r && "credential" in r,
      )
    : [];

  return {
    id:                 row.id as string,
    reportId:           row.report_id as string,
    groupMealDate:      row.group_meal_date as string,
    totalCost,
    totalAttendees,
    coveredRecipients:  recipients,
    notes:              (row.notes as string | null) ?? null,
    perPersonAllocation: totalCost / totalAttendees,
    createdAt:          row.created_at as string,
    updatedAt:          row.updated_at as string,
  };
}

export function mapValueSampleEntry(row: Record<string, unknown>): IValueSampleEntry {
  return {
    id:                row.id as string,
    reportId:          row.report_id as string,
    sampleDate:        row.sample_date as string,
    recipientFacility: row.recipient_facility as string,
    productLot:        row.product_lot as string,
    quantity:          Number(row.quantity ?? 0),
    purpose:           (row.purpose as string | null) ?? null,
    returnDate:        (row.return_date as string | null) ?? null,
    createdAt:         row.created_at as string,
    updatedAt:         row.updated_at as string,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 *  Summary helper — rolls up Section 3.2 numbers from the loaded entries.
 * ─────────────────────────────────────────────────────────────────────────── */

export function summarizeValueReport(
  report: IValueReport,
  transfers: IValueTransferEntry[],
  groupMeals: IValueGroupMealEntry[],
): IValueReportSummary {
  const groupMealTotal = groupMeals.reduce((sum, gm) => sum + gm.totalCost, 0);
  const transferTotal = transfers.reduce((sum, t) => sum + t.valueAmount, 0);
  const recipientKeys = new Set<string>();
  for (const t of transfers) {
    recipientKeys.add(`${t.recipientName}|${t.recipientNpi ?? ""}`);
  }
  for (const gm of groupMeals) {
    for (const r of gm.coveredRecipients) {
      recipientKeys.add(`${r.name}|${r.npi ?? ""}`);
    }
  }

  const hasComplianceFlags =
    report.flagRecipientNoReport ||
    report.flagOwnershipInquiry ||
    report.flagMischaracterize ||
    report.flagThirdParty ||
    report.flagFundingForReferrals ||
    report.flagFamilyMember ||
    report.flagOther;

  return {
    totalTransfers:     transfers.length + groupMeals.length,
    distinctRecipients: recipientKeys.size,
    totalValueUsd:      transferTotal + groupMealTotal,
    hasComplianceFlags,
  };
}
