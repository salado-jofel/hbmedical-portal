// Fax Intake · TypeScript surface for the intake_documents entity.
// Mirrors the DB shape shipped in 20260709000000_intake_documents.sql.

export type IntakeSource = "fax";

export type IntakeStatus =
  | "pending"
  | "converted_ivr"
  | "converted_order"
  | "dismissed";

export type IntakeClassification = "ivr" | "order" | "unknown";

export type IntakeConvertedType = "standalone_ivr" | "order";

export interface IIntakeDocument {
  id: string;
  source: IntakeSource;
  provider: string; // 'documo'
  externalId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  receivedAt: string;
  pageCount: number | null;

  bucket: string;
  filePath: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;

  status: IntakeStatus;
  classifiedAs: IntakeClassification | null;

  convertedToType: IntakeConvertedType | null;
  convertedToId: string | null;
  convertedAt: string | null;
  convertedBy: string | null;

  dismissedAt: string | null;
  dismissedBy: string | null;
  dismissReason: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Friendly labels for the status pill. */
export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  pending: "Pending",
  converted_ivr: "Built as IVR",
  converted_order: "Built as Order",
  dismissed: "Dismissed",
};
