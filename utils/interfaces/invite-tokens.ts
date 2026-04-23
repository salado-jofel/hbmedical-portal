import { z } from "zod";
import { uuidString } from "@/utils/validators/shared";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const inviteTokenRoleSchema = z.enum([
  "clinical_provider",
  "clinical_staff",
  "sales_representative",
]);
export type InviteTokenRole = z.infer<typeof inviteTokenRoleSchema>;

/* -------------------------------------------------------------------------- */
/* Core interface                                                             */
/* -------------------------------------------------------------------------- */

export interface IInviteToken {
  id: string;
  token: string;
  created_by: string;
  facility_id: string | null;
  role_type: InviteTokenRole;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  invited_email: string | null;
  /** Sales-rep commission rate locked at invite time. Null for non-rep roles. */
  commission_rate: number | null;
  /** Commission override (for inviter) locked at invite time. Null for non-rep roles. */
  commission_override: number | null;
  // Joined
  created_by_profile: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  facility: {
    id: string;
    name: string;
  } | null;
  // Used-by profile enrichment (for status label)
  used_by_name: string | null;
  used_by_has_completed_setup: boolean;
  used_by_facility_name: string | null;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IInviteTokenFormState {
  error: string | null;
  success: boolean;
  token?: string;
  invitedEmail?: string;
  fieldErrors?: {
    email?: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Zod schema                                                                 */
/* -------------------------------------------------------------------------- */

const commissionPctField = z.coerce
  .number()
  .min(0, "Must be ≥ 0%.")
  .max(100, "Must be ≤ 100%.")
  .nullable()
  .optional();

export const generateInviteTokenSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  facility_id: uuidString("Invalid account.").nullable().optional(),
  role_type: z.enum([
    "clinical_provider",
    "clinical_staff",
    "sales_representative",
  ]),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
  /** Commission rate (%) the invited rep earns on their own sales.
   *  Required when `role_type === "sales_representative"`. */
  commission_rate: commissionPctField,
  /** Commission override (%) the inviter earns on this rep's sales.
   *  Required when `role_type === "sales_representative"`. */
  commission_override: commissionPctField,
});

export type GenerateInviteTokenInput = z.infer<typeof generateInviteTokenSchema>;

/* -------------------------------------------------------------------------- */
/* Raw Supabase response                                                      */
/* -------------------------------------------------------------------------- */

export type RawInviteTokenRecord = {
  id: string;
  token: string;
  created_by: string;
  facility_id: string | null;
  role_type: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  invited_email: string | null;
  /** Sales-rep commission rate locked at invite time. Null for non-rep roles. */
  commission_rate: number | null;
  /** Commission override (for inviter) locked at invite time. Null for non-rep roles. */
  commission_override: number | null;
  created_by_profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  used_by_profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    has_completed_setup: boolean;
    created_facility: {
      id: string;
      name: string;
    } | null;
  } | null;
  facility: {
    id: string;
    name: string;
  } | null;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

export function mapInviteToken(raw: RawInviteTokenRecord): IInviteToken {
  const usedByProfile = raw.used_by_profile ?? null;
  const createdFacility = usedByProfile
    ? (Array.isArray(usedByProfile.created_facility)
        ? (usedByProfile.created_facility[0] ?? null)
        : usedByProfile.created_facility ?? null)
    : null;

  const rawAny = raw as unknown as Record<string, unknown>;
  const commissionRate = rawAny.commission_rate;
  const commissionOverride = rawAny.commission_override;

  return {
    id: raw.id,
    token: raw.token,
    created_by: raw.created_by,
    facility_id: raw.facility_id,
    role_type: inviteTokenRoleSchema.catch("clinical_staff").parse(raw.role_type),
    used_by: raw.used_by,
    used_at: raw.used_at,
    expires_at: raw.expires_at,
    created_at: raw.created_at,
    invited_email: raw.invited_email ?? null,
    commission_rate:
      commissionRate == null ? null : Number(commissionRate),
    commission_override:
      commissionOverride == null ? null : Number(commissionOverride),
    created_by_profile: raw.created_by_profile ?? null,
    facility: raw.facility ?? null,
    used_by_name: usedByProfile
      ? `${usedByProfile.first_name} ${usedByProfile.last_name}`
      : null,
    used_by_has_completed_setup: usedByProfile?.has_completed_setup ?? false,
    used_by_facility_name: createdFacility?.name ?? null,
  };
}

export function mapInviteTokens(rows: RawInviteTokenRecord[]): IInviteToken[] {
  return rows.map(mapInviteToken);
}
