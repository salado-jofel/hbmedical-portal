import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Core interface                                                             */
/* -------------------------------------------------------------------------- */

export interface IProviderCredentials {
  id: string;
  user_id: string;
  credential: string | null;
  npi_number: string | null;
  ptan_number: string | null;
  medical_license_number: string | null;
  pin_hash: string | null;
  baa_signed_at: string | null;
  terms_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IProviderCredentialsFormState {
  error: string | null;
  success: boolean;
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

export const saveCredentialsSchema = z.object({
  credential: z.string().trim().nullable().optional(),
  npi_number: z.string().trim().nullable().optional(),
  ptan_number: z.string().trim().nullable().optional(),
  medical_license_number: z.string().trim().nullable().optional(),
});

export type SaveCredentialsInput = z.infer<typeof saveCredentialsSchema>;

export const verifyPinSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, "PIN must be 4–6 digits."),
});

export type VerifyPinInput = z.infer<typeof verifyPinSchema>;

/* -------------------------------------------------------------------------- */
/* Raw Supabase response                                                      */
/* -------------------------------------------------------------------------- */

export type RawProviderCredentialRecord = {
  id: string;
  user_id: string;
  credential: string | null;
  npi_number: string | null;
  ptan_number: string | null;
  medical_license_number: string | null;
  pin_hash: string | null;
  baa_signed_at: string | null;
  terms_signed_at: string | null;
  created_at: string;
  updated_at: string;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

export function mapProviderCredential(raw: RawProviderCredentialRecord): IProviderCredentials {
  return {
    id: raw.id,
    user_id: raw.user_id,
    credential: raw.credential,
    npi_number: raw.npi_number,
    ptan_number: raw.ptan_number,
    medical_license_number: raw.medical_license_number,
    pin_hash: raw.pin_hash,
    baa_signed_at: raw.baa_signed_at,
    terms_signed_at: raw.terms_signed_at,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function mapProviderCredentials(rows: RawProviderCredentialRecord[]): IProviderCredentials[] {
  return rows.map(mapProviderCredential);
}
