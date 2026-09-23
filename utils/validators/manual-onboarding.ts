import { z } from "zod";
import { uuidString } from "@/utils/validators/shared";
import { E164_REGEX, EMAIL_REGEX, CREDENTIAL_OPTIONS } from "@/utils/constants/auth";
import { OFFLINE_CONTRACTS } from "@/utils/constants/manual-onboarding";

const trimmed = () => z.string().trim();
const optionalTrimmed = () => z.string().trim().optional().default("");
const CREDENTIAL_VALUES = CREDENTIAL_OPTIONS.map((c) => c.value);
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/* ── Step 1 — Provider ── */
export const providerStepSchema = z.object({
  first_name: trimmed().min(1, "First name is required."),
  last_name: trimmed().min(1, "Last name is required."),
  email: trimmed()
    .toLowerCase()
    .regex(EMAIL_REGEX, "Enter a valid email address."),
  phone: trimmed().regex(E164_REGEX, "A valid mobile number is required."),
  credential: z
    .string()
    .refine((v) => v === "" || CREDENTIAL_VALUES.includes(v), "Invalid credential."),
  npi_number: z.string().regex(/^\d{10}$/, "NPI must be exactly 10 digits."),
});

/* ── Step 2 — Practice (same rules as the invite signup Office step) ── */
export const practiceStepSchema = z.object({
  office_name: trimmed().min(1, "Practice name is required."),
  office_phone: trimmed().regex(E164_REGEX, "Office phone is required."),
  office_address: trimmed().min(1, "Address is required."),
  office_city: trimmed().min(1, "City is required."),
  office_state: trimmed().min(1, "State is required."),
  office_postal_code: trimmed().min(1, "ZIP code is required."),
});

/* ── Step 3 — Enrollment (all optional, mirrors facility_enrollment) ── */
export const enrollmentSchema = z.object({
  facility_ein: optionalTrimmed(),
  facility_npi: optionalTrimmed(),
  facility_ptan: optionalTrimmed(),
  medicare_mac: optionalTrimmed(),
  ap_contact_name: optionalTrimmed(),
  ap_contact_email: optionalTrimmed(),
  dpa_contact: optionalTrimmed(),
  dpa_contact_email: optionalTrimmed(),
  additional_provider_1_name: optionalTrimmed(),
  additional_provider_1_npi: optionalTrimmed(),
  additional_provider_2_name: optionalTrimmed(),
  additional_provider_2_npi: optionalTrimmed(),
  shipping_facility_name: optionalTrimmed(),
  shipping_facility_npi: optionalTrimmed(),
  shipping_facility_ptan: optionalTrimmed(),
  shipping_contact_name: optionalTrimmed(),
  shipping_contact_email: optionalTrimmed(),
  shipping_address: optionalTrimmed(),
  shipping_phone: optionalTrimmed(),
});

/* ── Step 4 — Documents ── */
export const offlineContractSchema = z.object({
  contractType: z.enum(OFFLINE_CONTRACTS.map((c) => c.key) as [string, ...string[]]),
  filePath: trimmed().min(1, "Upload the signed PDF."),
  fileName: trimmed().min(1),
  signerName: trimmed().min(1, "Signer name is required."),
  signerTitle: trimmed().min(1, "Signer title is required."),
  signedOn: z
    .string()
    .regex(ISO_DATE_REGEX, "Signed date is required.")
    .refine((d) => new Date(d).getTime() <= Date.now(), "Signed date cannot be in the future."),
});

export const manualOnboardingSchema = providerStepSchema
  .extend(practiceStepSchema.shape)
  .extend({
    batchId: uuidString("Invalid upload batch."),
    repId: uuidString("Select a sales rep.").nullable(),
    enrollment: enrollmentSchema,
    contracts: z
      .array(offlineContractSchema)
      .length(OFFLINE_CONTRACTS.length, "Both signed contracts are required.")
      .refine(
        (list) => new Set(list.map((c) => c.contractType)).size === OFFLINE_CONTRACTS.length,
        "Upload one BAA and one Product & Services Agreement.",
      ),
  });

export type ManualOnboardingParsed = z.infer<typeof manualOnboardingSchema>;

/** Flattens zod issues to `{ field: message }` for inline display. */
export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
