"use server";

// Wrapper async functions — re-exports are not allowed in "use server" files.
// Each function delegates to the canonical source action.

import {
  getProfile,
  updateProfile as _updateProfile,
} from "@/app/(dashboard)/dashboard/profile/(services)/actions";

import { revalidatePath } from "next/cache";
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
/* My Clinic — clinical_provider only. 1:1 with the profile via facilities.user_id.
/* -------------------------------------------------------------------------- */

export interface IMyClinic {
  id: string;
  name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  facility_type: string;
}

export interface IMyClinicFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<
    "name" | "phone" | "address_line_1" | "address_line_2" | "city" | "state" | "postal_code",
    string
  >>;
}

export async function getMyClinic(): Promise<IMyClinic | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isClinicalProvider(role as UserRole)) return null;

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("facilities")
    .select("id, name, phone, address_line_1, address_line_2, city, state, postal_code, country, facility_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getMyClinic] Error:", JSON.stringify(error));
    return null;
  }
  return (data as IMyClinic) ?? null;
}

export async function updateMyClinic(
  _prev: IMyClinicFormState | null,
  formData: FormData,
): Promise<IMyClinicFormState> {
  try {
    const { updateMyClinicSchema } = await import("@/utils/validators/facilities");

    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);
    if (!isClinicalProvider(role as UserRole)) {
      return { success: false, error: "Only clinical providers can edit their clinic." };
    }

    const raw = {
      name:           formData.get("name") as string,
      phone:          formData.get("phone") as string,
      address_line_1: formData.get("address_line_1") as string,
      address_line_2: (formData.get("address_line_2") as string) ?? "",
      city:           formData.get("city") as string,
      state:          formData.get("state") as string,
      postal_code:    formData.get("postal_code") as string,
    };

    const parsed = updateMyClinicSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IMyClinicFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IMyClinicFormState["fieldErrors"]>;
        if (field) fieldErrors[field] = issue.message;
      }
      return { success: false, error: null, fieldErrors };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("facilities")
      .update({
        name:           parsed.data.name,
        phone:          parsed.data.phone,
        address_line_1: parsed.data.address_line_1,
        // address_line_2 is nullable in DB; null when empty keeps the column clean.
        address_line_2: parsed.data.address_line_2.trim() || null,
        city:           parsed.data.city,
        state:          parsed.data.state,
        postal_code:    parsed.data.postal_code,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("[updateMyClinic] Update error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to update clinic." };
    }

    revalidatePath("/dashboard/settings");
    return { success: true, error: null };
  } catch (err) {
    console.error("[updateMyClinic] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
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

/** Minimum time between successive PIN changes (change OR forgot-PIN reset).
 *  Prevents rapid-rotation if a session gets compromised. Admin-initiated
 *  reset is NOT subject to this cooldown. */
const PIN_CHANGE_COOLDOWN_MS = 10 * 60 * 1000;

export async function verifyAndChangePin(
  currentPin: string,
  newPin: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash, updated_at")
      .eq("user_id", user.id)
      .single();

    // Verify current PIN only when one is already set and caller didn't skip
    if (currentPin !== "SKIP_VERIFY" && creds?.pin_hash) {
      const { data: isValid } = await adminClient.rpc("verify_pin", {
        input_pin:   currentPin,
        stored_hash: creds.pin_hash,
      });
      if (!isValid) {
        return { success: false, error: "Current PIN is incorrect." };
      }
      // Cooldown applies only when the user already had a PIN. First-time set
      // (pin_hash null) should go through unthrottled.
      const cooldown = checkPinCooldown(creds.updated_at);
      if (cooldown) return { success: false, error: cooldown };
    }

    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, error: "PIN must be exactly 4 digits." };
    }

    const { data: newHash, error: hashErr } = await adminClient.rpc("hash_pin", {
      input_pin: newPin,
    });
    if (!newHash || hashErr) {
      return { success: false, error: "Failed to generate PIN hash." };
    }

    const { error: updateError } = await adminClient
      .from("provider_credentials")
      .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Fire-and-forget notification email — never block success on email failure
    void firePinChangedEmail(user.id, "change");

    return { success: true, error: null };
  } catch (err) {
    console.error("[changePin] threw:", err);
    return { success: false, error: "An error occurred." };
  }
}

/** Forgot-PIN recovery — verify account password, then set a new PIN.
 *  Requires the user to re-enter their account password from this session's
 *  signed-in context. Subject to the same 10-minute cooldown as changePin. */
export async function resetPinWithPassword(
  password: string,
  newPin: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    if (!password?.trim()) {
      return { success: false, error: "Password is required." };
    }
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, error: "PIN must be exactly 4 digits." };
    }
    if (!user.email) {
      return { success: false, error: "Account email is missing — contact support." };
    }

    // Re-authenticate via a throwaway Supabase client (persistSession:false).
    // We only want to verify the password; we must not touch the active session.
    const { createClient: createSupabaseJsClient } = await import("@supabase/supabase-js");
    const throwaway = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signInData, error: signInError } =
      await throwaway.auth.signInWithPassword({ email: user.email, password });
    if (signInError || !signInData?.user) {
      return { success: false, error: "Incorrect password." };
    }

    // Cooldown check (10-min throttle)
    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("updated_at")
      .eq("user_id", user.id)
      .single();
    const cooldown = checkPinCooldown(creds?.updated_at ?? null);
    if (cooldown) return { success: false, error: cooldown };

    const { data: newHash, error: hashErr } = await adminClient.rpc("hash_pin", {
      input_pin: newPin,
    });
    if (!newHash || hashErr) {
      return { success: false, error: "Failed to generate PIN hash." };
    }

    const { error: updateError } = await adminClient
      .from("provider_credentials")
      .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (updateError) {
      return { success: false, error: updateError.message };
    }

    void firePinChangedEmail(user.id, "reset");

    return { success: true, error: null };
  } catch (err) {
    console.error("[resetPinWithPassword] threw:", err);
    return { success: false, error: "An error occurred." };
  }
}

/** Admin-only: wipe a provider's PIN. Used when a user has forgotten both
 *  their PIN AND password. User will be prompted to set a new PIN on next
 *  signing attempt (`SKIP_VERIFY` path in `verifyAndChangePin`). NOT subject
 *  to the cooldown. */
export async function adminResetProviderPin(
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const role = await getUserRole(supabase);
    if (role !== "admin") {
      return { success: false, error: "Admins only." };
    }
    if (!userId) return { success: false, error: "User id is required." };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("provider_credentials")
      .update({ pin_hash: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) return { success: false, error: error.message };

    void firePinChangedEmail(userId, "admin");
    return { success: true, error: null };
  } catch (err) {
    console.error("[adminResetProviderPin] threw:", err);
    return { success: false, error: "An error occurred." };
  }
}

/* ── PIN helpers ── */

function checkPinCooldown(lastUpdatedIso: string | null): string | null {
  if (!lastUpdatedIso) return null;
  const last = new Date(lastUpdatedIso).getTime();
  const elapsed = Date.now() - last;
  if (elapsed >= PIN_CHANGE_COOLDOWN_MS) return null;
  const remainMin = Math.ceil((PIN_CHANGE_COOLDOWN_MS - elapsed) / 60000);
  return `Your PIN was changed recently. Please wait ${remainMin} minute${remainMin === 1 ? "" : "s"} before changing it again.`;
}

async function firePinChangedEmail(
  userId: string,
  method: "change" | "reset" | "admin",
): Promise<void> {
  try {
    const { headers: requestHeaders } = await import("next/headers");
    const h = await requestHeaders();
    const ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    const userAgent = h.get("user-agent") || null;

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, first_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) return;

    const { sendPinChangedNotificationEmail } = await import(
      "@/lib/emails/send-pin-changed-notification"
    );
    await sendPinChangedNotificationEmail({
      to: profile.email,
      firstName: profile.first_name || "there",
      changedAtIso: new Date().toISOString(),
      ipAddress,
      userAgent,
      method,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://meridianportal.io",
    });
  } catch (err) {
    console.error("[firePinChangedEmail]", err);
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

/** Look up the sales rep currently assigned to the signed-in clinical
 *  provider's clinic (via `facilities.assigned_rep`). Returns null if the
 *  provider wasn't invited by a rep (admin-invited flow). */
export interface IAssignedRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

export async function getMyAssignedRep(): Promise<IAssignedRep | null> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);
    if (!isClinicalProvider(role as UserRole)) return null;

    const admin = createAdminClient();
    const { data: facility } = await admin
      .from("facilities")
      .select("assigned_rep")
      .eq("user_id", user.id)
      .eq("facility_type", "clinic")
      .maybeSingle();
    const repId = facility?.assigned_rep;
    if (!repId) return null;

    const { data: rep } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, status")
      .eq("id", repId)
      .maybeSingle();
    if (!rep) return null;
    return {
      id: rep.id,
      first_name: rep.first_name ?? "",
      last_name: rep.last_name ?? "",
      email: rep.email ?? "",
      status: rep.status ?? "active",
    };
  } catch (err) {
    console.error("[getMyAssignedRep]", err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                  */
/* -------------------------------------------------------------------------- */

// Only lists fields the app still reads/writes. Dropped columns
// (facility_tin, *_fax, shipping_days_times, shipping2_*, claims_*) still
// exist on the facility_enrollment table but are no longer accessed by code.
export type FacilityEnrollmentData = {
  facility_id: string;
  facility_ein: string | null;
  facility_npi: string | null;
  facility_ptan: string | null;
  medicare_mac: string | null;
  ap_contact_name: string | null;
  ap_contact_email: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_phone: string | null;
  dpa_contact: string | null;
  dpa_contact_email: string | null;
  additional_provider_1_name: string | null;
  additional_provider_1_npi: string | null;
  additional_provider_2_name: string | null;
  additional_provider_2_npi: string | null;
  shipping_facility_name: string | null;
  shipping_facility_npi: string | null;
  shipping_facility_ptan: string | null;
  shipping_contact_name: string | null;
  shipping_contact_email: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
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
