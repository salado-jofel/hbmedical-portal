// IVR Phase 1 · TypeScript surface for the standalone-IVR entity.
// Mirrors the four DB tables shipped in 20260702_*_standalone_ivr*.sql.

export interface IExternalApprover {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StandaloneIvrStatus =
  | "draft"
  | "sent"
  | "approved"
  | "denied"
  | "converted";

export interface IStandaloneIvr {
  id: string;
  status: StandaloneIvrStatus;

  // Metadata is OPTIONAL — all of this info is inside the uploaded PDF
  // (Dr. Ben feedback 2026-07-07). The DB columns were made nullable in
  // migration 20260707000000_standalone_ivrs_metadata_optional.sql.
  // Only facility_id stays required (RLS keys off it).
  patientName: string | null;
  patientDob: string | null; // ISO date YYYY-MM-DD
  physicianName: string | null;
  physicianNpi: string | null;
  facilityId: string;
  productSummary: string | null;

  // Approval routing
  assignedApproverId: string | null;
  approvalToken: string | null;
  approvalExpiresAt: string | null;
  sentAt: string | null;

  // Approval outcome + audit
  approvedAt: string | null;
  deniedAt: string | null;
  denialReason: string | null;
  approverDisplayName: string | null;
  approverIp: string | null;
  approverUserAgent: string | null;

  // Bookkeeping
  uploadedBy: string | null;
  convertedToOrderId: string | null;
  createdAt: string;
  updatedAt: string;

  // Hydrated joins (present when the getter includes them)
  files?: IStandaloneIvrFile[];
  approver?: IExternalApprover | null;
  facilityName?: string | null;

  // ── Rich IVR form fields (2026-08-05) ──
  // Added so the "Build IVR from fax" modal can render the full IVR
  // clinical form (facility / physician / patient / insurance / wound
  // / procedure) at the standalone stage. On convert-to-order the
  // values are copied 1:1 into order_ivr — same column names both
  // sides.
  //
  // Every field is nullable — the fax PDF is the source of truth; the
  // structured columns exist so reports and list scans don't have to
  // re-parse the PDF.
  form?: IStandaloneIvrForm;

  // Bookkeeping for AI pre-fill.
  aiExtracted?: boolean;
  aiExtractedAt?: string | null;
}

/**
 * Structured mirror of every editable field on the rich IVR form. Kept
 * as a nested `form` bag so consumers that only need the top-level
 * metadata (list rows, badges) don't pay the ceremony of ~50 optional
 * properties.
 */
export interface IStandaloneIvrForm {
  // Sales rep + facility overrides.
  salesRepName: string | null;
  placeOfService: string | null;
  specialtySiteName: string | null;
  medicareAdminContractor: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  facilityContact: string | null;
  facilityPhone: string | null;
  facilityFax: string | null;
  facilityNpi: string | null;
  facilityTin: string | null;
  facilityPtan: string | null;

  // Physician (name + NPI live on the parent record).
  physicianPhone: string | null;
  physicianFax: string | null;
  physicianAddress: string | null;
  physicianTin: string | null;

  // Patient (name + DOB live on the parent record).
  patientPhone: string | null;
  patientAddress: string | null;
  okToContactPatient: boolean | null;

  // Primary insurance.
  insuranceProvider: string | null;
  insurancePhone: string | null;
  memberId: string | null;
  groupNumber: string | null;
  planName: string | null;
  planType: string | null;
  subscriberName: string | null;
  subscriberDob: string | null;
  subscriberRelationship: string | null;
  providerParticipatesPrimary: string | null;

  // Coverage / verification.
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  deductibleAmount: number | null;
  deductibleMet: number | null;
  outOfPocketMax: number | null;
  outOfPocketMet: number | null;
  copayAmount: number | null;
  coinsurancePercent: number | null;
  dmeCovered: boolean | null;
  woundCareCovered: boolean | null;
  priorAuthRequired: boolean | null;
  priorAuthNumber: string | null;
  priorAuthStartDate: string | null;
  priorAuthEndDate: string | null;
  unitsAuthorized: number | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  verificationReference: string | null;

  // Secondary insurance.
  secondaryInsuranceProvider: string | null;
  secondaryInsurancePhone: string | null;
  secondarySubscriberName: string | null;
  secondaryPolicyNumber: string | null;
  secondarySubscriberDob: string | null;
  secondaryPlanType: string | null;
  secondaryGroupNumber: string | null;
  secondarySubscriberRelationship: string | null;
  providerParticipatesSecondary: string | null;

  // Wound + procedure.
  woundType: string | null;
  woundSizes: string | null;
  applicationCpts: string | null;
  dateOfProcedure: string | null;
  icd10Codes: string | null;
  productInformation: string | null;
  isPatientAtSnf: boolean | null;
  surgicalGlobalPeriod: boolean | null;
  globalPeriodCpt: string | null;
  priorAuthPermission: boolean | null;

  // Back-office notes (separate from productSummary which is clinician-
  // visible on the parent record).
  formNotes: string | null;
}

export interface IStandaloneIvrFile {
  id: string;
  standaloneIvrId: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export type StandaloneIvrHistoryEvent =
  | "created"
  | "sent"
  | "approved"
  | "denied"
  | "edited"
  | "resubmitted"
  | "converted";

export interface IStandaloneIvrHistoryEntry {
  id: string;
  standaloneIvrId: string;
  event: StandaloneIvrHistoryEvent;
  actorId: string | null;
  actorDisplay: string | null;
  note: string | null;
  createdAt: string;
}

/** Friendly labels for the status badge. */
export const STANDALONE_IVR_STATUS_LABELS: Record<StandaloneIvrStatus, string> = {
  draft: "Draft",
  sent: "Sent for Approval",
  approved: "Approved",
  denied: "Denied",
  converted: "Converted to Order",
};
