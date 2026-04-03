import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Core interface                                                             */
/* -------------------------------------------------------------------------- */

export interface IFacilityMemberProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string; // profiles.role column — correct name
}

export interface IFacilityMember {
  id: string;
  facility_id: string;
  user_id: string;
  role_type: string;
  can_sign_orders: boolean;
  is_primary: boolean;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
  // Joined
  member_profile: IFacilityMemberProfile | null;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IFacilityMemberFormState {
  error: string | null;
  success: boolean;
}

/* -------------------------------------------------------------------------- */
/* Zod schema                                                                 */
/* -------------------------------------------------------------------------- */

export const updateMemberRoleSchema = z.object({
  role_type: z.enum(["clinical_provider", "clinical_staff"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/* -------------------------------------------------------------------------- */
/* Raw Supabase response                                                      */
/* -------------------------------------------------------------------------- */

export type RawFacilityMemberRecord = {
  id: string;
  facility_id: string;
  user_id: string;
  role_type: string;
  can_sign_orders: boolean;
  is_primary: boolean;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
  member_profile: IFacilityMemberProfile | null;
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

export function mapFacilityMember(raw: RawFacilityMemberRecord): IFacilityMember {
  return {
    id: raw.id,
    facility_id: raw.facility_id,
    user_id: raw.user_id,
    role_type: raw.role_type,
    can_sign_orders: raw.can_sign_orders,
    is_primary: raw.is_primary,
    invited_by: raw.invited_by,
    joined_at: raw.joined_at,
    created_at: raw.created_at,
    member_profile: raw.member_profile ?? null,
  };
}

export function mapFacilityMembers(rows: RawFacilityMemberRecord[]): IFacilityMember[] {
  return rows.map(mapFacilityMember);
}
