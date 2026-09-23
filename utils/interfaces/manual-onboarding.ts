import type { OfflineContractKey } from "@/utils/constants/manual-onboarding";

/** One wet-signed contract the admin/rep scanned and uploaded. `filePath` is
 *  the private-bucket path returned by `prepareOfflineContractUpload`. */
export interface OfflineContractInput {
  contractType: OfflineContractKey;
  filePath: string;
  fileName: string;
  /** Printed signer name as it appears on the paper document. */
  signerName: string;
  /** Printed signer title (e.g. "Medical Director"). */
  signerTitle: string;
  /** Date written on the paper document, ISO yyyy-mm-dd. */
  signedOn: string;
}

/** Enrollment form fields — identical to the invite signup Enroll step. All optional. */
export interface ManualEnrollmentInput {
  facility_ein: string;
  facility_npi: string;
  facility_ptan: string;
  medicare_mac: string;
  ap_contact_name: string;
  ap_contact_email: string;
  dpa_contact: string;
  dpa_contact_email: string;
  additional_provider_1_name: string;
  additional_provider_1_npi: string;
  additional_provider_2_name: string;
  additional_provider_2_npi: string;
  shipping_facility_name: string;
  shipping_facility_npi: string;
  shipping_facility_ptan: string;
  shipping_contact_name: string;
  shipping_contact_email: string;
  shipping_address: string;
  shipping_phone: string;
}

/** Payload for `manualOnboardProvider`. Mirrors the invite signup form data,
 *  minus password + PIN (the provider sets those on first login). */
export interface ManualOnboardingPayload {
  /** Client-generated UUID that groups the two contract uploads. */
  batchId: string;
  /** Admin only — the sales rep to assign. Ignored (server uses auth.uid()) for reps. */
  repId: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  credential: string;
  npi_number: string;
  office_name: string;
  office_phone: string;
  office_address: string;
  office_city: string;
  office_state: string;
  office_postal_code: string;
  enrollment: ManualEnrollmentInput;
  contracts: OfflineContractInput[];
}

export interface ManualOnboardingResult {
  success: boolean;
  error: string | null;
  fieldErrors?: Record<string, string>;
  providerEmail?: string;
  facilityName?: string;
}

export interface PrepareOfflineUploadResult {
  success: boolean;
  bucket?: string;
  filePath?: string;
  uploadToken?: string;
  error?: string;
}

export const EMPTY_ENROLLMENT: ManualEnrollmentInput = {
  facility_ein: "",
  facility_npi: "",
  facility_ptan: "",
  medicare_mac: "",
  ap_contact_name: "",
  ap_contact_email: "",
  dpa_contact: "",
  dpa_contact_email: "",
  additional_provider_1_name: "",
  additional_provider_1_npi: "",
  additional_provider_2_name: "",
  additional_provider_2_npi: "",
  shipping_facility_name: "",
  shipping_facility_npi: "",
  shipping_facility_ptan: "",
  shipping_contact_name: "",
  shipping_contact_email: "",
  shipping_address: "",
  shipping_phone: "",
};

/* ── Client-side wizard state ── */

/** Draft of one contract slot in the Documents step. `filePath` is set once
 *  the PDF has been uploaded to storage (prepare + signed upload). */
export interface OfflineContractDraft {
  fileName: string;
  filePath: string;
  signerName: string;
  signerTitle: string;
  signedOn: string;
  uploading: boolean;
}

export type ManualOnboardingForm = Omit<
  ManualOnboardingPayload,
  "contracts" | "batchId"
> & {
  contracts: Record<OfflineContractKey, OfflineContractDraft>;
};

export type ManualFormPatch =
  | Partial<ManualOnboardingForm>
  | ((current: ManualOnboardingForm) => Partial<ManualOnboardingForm>);

export const EMPTY_CONTRACT_DRAFT: OfflineContractDraft = {
  fileName: "",
  filePath: "",
  signerName: "",
  signerTitle: "",
  signedOn: "",
  uploading: false,
};

export const EMPTY_MANUAL_ONBOARDING_FORM: ManualOnboardingForm = {
  repId: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  credential: "",
  npi_number: "",
  office_name: "",
  office_phone: "",
  office_address: "",
  office_city: "",
  office_state: "",
  office_postal_code: "",
  enrollment: EMPTY_ENROLLMENT,
  contracts: {
    baa: EMPTY_CONTRACT_DRAFT,
    product_services: EMPTY_CONTRACT_DRAFT,
  },
};
