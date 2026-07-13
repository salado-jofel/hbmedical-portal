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
