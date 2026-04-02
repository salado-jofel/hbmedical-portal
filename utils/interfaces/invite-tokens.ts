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
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IInviteTokenFormState {
  error: string | null;
  success: boolean;
  token?: string;
}

/* -------------------------------------------------------------------------- */
/* Zod schema                                                                 */
/* -------------------------------------------------------------------------- */

export const generateInviteTokenSchema = z.object({
  facility_id: z.string().uuid("Invalid account.").nullable().optional(),
  role_type: z.enum(["clinical_provider", "clinical_staff"]),
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
    created_by_profile: raw.created_by_profile ?? null,
    facility: raw.facility ?? null,
  };
}

export function mapInviteTokens(rows: RawInviteTokenRecord[]): IInviteToken[] {
  return rows.map(mapInviteToken);
}
