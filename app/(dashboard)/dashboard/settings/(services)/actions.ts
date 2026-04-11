"use server";

// Wrapper async functions — re-exports are not allowed in "use server" files.
// Each function delegates to the canonical source action.

import {
  getProfile,
  updateProfile as _updateProfile,
} from "@/app/(dashboard)/dashboard/profile/(services)/actions";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { AccountStatus } from "@/utils/interfaces/accounts";
import type { IClinicAccount } from "@/utils/interfaces/settings";

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
} from "@/app/(dashboard)/dashboard/onboarding/(services)/invite-actions";

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

export async function verifyAndChangePin(
  currentPin: string,
  newPin: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    console.log("[changePin] user:", user.id);

    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .single();

    console.log("[changePin] has pin_hash:", !!creds?.pin_hash);

    // Verify current PIN only when one is already set and caller didn't skip
    if (currentPin !== "SKIP_VERIFY" && creds?.pin_hash) {
      console.log("[changePin] verifying current PIN...");
      const { data: isValid } = await adminClient.rpc("verify_pin", {
        input_pin:   currentPin,
        stored_hash: creds.pin_hash,
      });
      console.log("[changePin] current PIN valid:", isValid);
      if (!isValid) {
        return { success: false, error: "Current PIN is incorrect." };
      }
    }

    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, error: "PIN must be exactly 4 digits." };
    }

    console.log("[changePin] hashing new PIN...");
    const { data: newHash, error: hashErr } = await adminClient.rpc("hash_pin", {
      input_pin: newPin,
    });

    console.log("[changePin] hash result:", !!newHash, hashErr?.message ?? null);

    if (!newHash || hashErr) {
      return { success: false, error: "Failed to generate PIN hash." };
    }

    console.log("[changePin] updating DB...");
    const { error: updateError } = await adminClient
      .from("provider_credentials")
      .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    console.log("[changePin] update error:", updateError?.message ?? null);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[changePin] threw:", err);
    return { success: false, error: "An error occurred." };
  }
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

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                  */
/* -------------------------------------------------------------------------- */

export type FacilityEnrollmentData = {
  facility_id: string;
  facility_ein: string | null;
  facility_npi: string | null;
  facility_tin: string | null;
  facility_ptan: string | null;
  ap_contact_name: string | null;
  ap_contact_email: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_phone: string | null;
  billing_fax: string | null;
  dpa_contact: string | null;
  dpa_contact_email: string | null;
  additional_provider_1_name: string | null;
  additional_provider_1_npi: string | null;
  additional_provider_2_name: string | null;
  additional_provider_2_npi: string | null;
  shipping_facility_name: string | null;
  shipping_facility_npi: string | null;
  shipping_facility_tin: string | null;
  shipping_facility_ptan: string | null;
  shipping_contact_name: string | null;
  shipping_contact_email: string | null;
  shipping_address: string | null;
  shipping_days_times: string | null;
  shipping_phone: string | null;
  shipping_fax: string | null;
  shipping2_facility_name: string | null;
  shipping2_facility_npi: string | null;
  shipping2_facility_tin: string | null;
  shipping2_facility_ptan: string | null;
  shipping2_contact_name: string | null;
  shipping2_contact_email: string | null;
  shipping2_address: string | null;
  shipping2_days_times: string | null;
  shipping2_phone: string | null;
  shipping2_fax: string | null;
  claims_contact_name: string | null;
  claims_contact_phone: string | null;
  claims_contact_email: string | null;
  claims_third_party: string | null;
};

export async function getMyEnrollment(): Promise<FacilityEnrollmentData | null> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const { data: facility } = await supabase
      .from("facilities")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!facility) return null;

    const { data, error } = await supabase
      .from("facility_enrollment")
      .select("*")
      .eq("facility_id", facility.id)
      .maybeSingle();

    if (error) {
      console.error("[getMyEnrollment]", JSON.stringify(error));
      return null;
    }

    return data as FacilityEnrollmentData | null;
  } catch (err) {
    console.error("[getMyEnrollment] Unexpected:", err);
    return null;
  }
}

export async function saveEnrollmentData(
  payload: Omit<FacilityEnrollmentData, "facility_id">,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const user = await getCurrentUserOrThrow(supabase);

    const { data: facility } = await supabase
      .from("facilities")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!facility) return { success: false, error: "Facility not found." };

    const { error } = await adminClient
      .from("facility_enrollment")
      .upsert(
        { facility_id: facility.id, ...payload, completed_at: new Date().toISOString() },
        { onConflict: "facility_id" },
      );

    if (error) {
      console.error("[saveEnrollmentData]", JSON.stringify(error));
      return { success: false, error: "Failed to save enrollment data." };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[saveEnrollmentData] Unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
