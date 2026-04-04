"use server";

// Wrapper async functions — re-exports are not allowed in "use server" files.
// Each function delegates to the canonical source action.

import {
  getProfile,
  updateProfile as _updateProfile,
} from "@/app/(dashboard)/dashboard/profile/(services)/actions";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { AccountStatus } from "@/utils/interfaces/accounts";

import {
  getMyCredentials as _getMyCredentials,
  saveCredentials as _saveCredentials,
  deleteCredentials as _deleteCredentials,
} from "@/app/(dashboard)/dashboard/(services)/provider-credentials/actions";

import {
  getFacilityMembers as _getFacilityMembers,
  removeFacilityMember as _removeFacilityMember,
  updateMemberRole as _updateMemberRole,
} from "@/app/(dashboard)/dashboard/(services)/facility-members/actions";

import {
  generateInviteToken,
} from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";

import type { Profile, IProfileFormState, IChangePasswordFormState } from "@/utils/interfaces/profiles";
import type {
  IProviderCredentials,
  IProviderCredentialsFormState,
} from "@/utils/interfaces/provider-credentials";
import type {
  IFacilityMember,
  IFacilityMemberFormState,
} from "@/utils/interfaces/facility-members";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function getMyProfile(): Promise<Profile | null> {
  return getProfile();
}

export async function updateProfile(
  _prev: IProfileFormState | null,
  formData: FormData,
): Promise<IProfileFormState> {
  return _updateProfile(_prev, formData);
}

/* -------------------------------------------------------------------------- */
/* changePassword                                                             */
/* -------------------------------------------------------------------------- */

export async function changePassword(
  _prev: IChangePasswordFormState | null,
  formData: FormData,
): Promise<IChangePasswordFormState> {
  const newPassword     = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return {
      error: null,
      success: false,
      fieldErrors: { new_password: "Password must be at least 8 characters." },
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      error: null,
      success: false,
      fieldErrors: { confirm_password: "Passwords do not match." },
    };
  }

  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error("[changePassword] Error:", JSON.stringify(error));
    return { error: error.message || "Failed to change password.", success: false };
  }

  return { success: true, error: null };
}

/* -------------------------------------------------------------------------- */
/* Provider credentials                                                       */
/* -------------------------------------------------------------------------- */

export async function getMyCredentials(): Promise<IProviderCredentials | null> {
  return _getMyCredentials();
}

export async function saveCredentials(
  _prevState: IProviderCredentialsFormState | null,
  formData: FormData,
): Promise<IProviderCredentialsFormState> {
  return _saveCredentials(_prevState, formData);
}

export async function deleteCredentials(): Promise<void> {
  return _deleteCredentials();
}

/* -------------------------------------------------------------------------- */
/* Facility members                                                           */
/* -------------------------------------------------------------------------- */

export async function getFacilityMembers(
  facilityId?: string,
): Promise<IFacilityMember[]> {
  return _getFacilityMembers(facilityId);
}

export async function removeFacilityMember(memberId: string): Promise<void> {
  return _removeFacilityMember(memberId);
}

export async function updateMemberRole(
  memberId: string,
  _prevState: IFacilityMemberFormState | null,
  formData: FormData,
): Promise<IFacilityMemberFormState> {
  return _updateMemberRole(memberId, _prevState, formData);
}

/* -------------------------------------------------------------------------- */
/* Onboarding — member invite token                                           */
/* -------------------------------------------------------------------------- */

export async function generateMemberInviteToken(
  _prevState: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  return generateInviteToken(_prevState, formData);
}

/* -------------------------------------------------------------------------- */
/* Team — Rep: clinic accounts                                                 */
/* -------------------------------------------------------------------------- */

export interface IClinicAccount {
  id: string;
  name: string;
  status: AccountStatus;
  primaryDoctor: string;
  doctorEmail: string;
  memberCount: number;
}

export async function getMyClinicAccounts(): Promise<IClinicAccount[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) return [];

    const { data, error } = await supabase
      .from("facilities")
      .select(`
        id,
        name,
        status,
        owner:profiles!facilities_user_id_fkey (
          first_name,
          last_name,
          email
        ),
        facility_members (
          id
        )
      `)
      .eq("facility_type", "clinic")
      .eq("assigned_rep", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("[getMyClinicAccounts]", JSON.stringify(error));
      return [];
    }

    return (data ?? []).map((f) => {
      const owner = Array.isArray(f.owner) ? f.owner[0] : f.owner;
      return {
        id: f.id,
        name: f.name,
        status: (f.status as AccountStatus) ?? "inactive",
        primaryDoctor: owner ? `${owner.first_name} ${owner.last_name}` : "Unknown",
        doctorEmail: owner?.email ?? "",
        memberCount: Array.isArray(f.facility_members) ? f.facility_members.length : 0,
      };
    });
  } catch (err) {
    console.error("[getMyClinicAccounts] Unexpected:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Team — Rep: sub-reps                                                        */
/* -------------------------------------------------------------------------- */

export async function getMySubReps(): Promise<ISubRep[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) return [];

    const { data, error } = await supabase
      .from("rep_hierarchy")
      .select(`
        child_rep_id,
        child:profiles!rep_hierarchy_child_rep_id_fkey (
          id,
          first_name,
          last_name,
          email,
          status,
          has_completed_setup,
          created_at
        )
      `)
      .eq("parent_rep_id", user.id);

    if (error) {
      console.error("[getMySubReps]", JSON.stringify(error));
      return [];
    }

    return (data ?? [])
      .filter((row) => row.child)
      .map((row) => {
        const child = Array.isArray(row.child) ? row.child[0] : row.child;
        return {
          id: child.id,
          first_name: child.first_name,
          last_name: child.last_name,
          email: child.email,
          status: child.status as ISubRep["status"],
          has_completed_setup: child.has_completed_setup ?? false,
          created_at: child.created_at,
        };
      });
  } catch (err) {
    console.error("[getMySubReps] Unexpected:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Team — Provider: clinic members (delegates to getFacilityMembers)          */
/* -------------------------------------------------------------------------- */

export async function getMyClinicMembers(): Promise<IFacilityMember[]> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role as UserRole)) return [];

    return _getFacilityMembers(undefined, { excludeUserId: user.id });
  } catch (err) {
    console.error("[getMyClinicMembers] Unexpected:", err);
    return [];
  }
}
