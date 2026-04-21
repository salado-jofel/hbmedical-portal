import { z } from "zod";

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

export const generateInviteTokenSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  facility_id: z.string().uuid("Invalid account.").nullable().optional(),
  role_type: z.enum([
    "clinical_provider",
    "clinical_staff",
    "sales_representative",
  ]),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
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
