"use server";

// Wrapper async functions — re-exports are not allowed in "use server" files.
// Each function delegates to the canonical source action.

import {
  getProfile,
  updateProfile as _updateProfile,
} from "@/app/(dashboard)/dashboard/profile/(services)/actions";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";

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
