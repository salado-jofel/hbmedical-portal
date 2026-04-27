"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import {
  updateMemberRoleSchema,
  mapFacilityMember,
  mapFacilityMembers,
  type IFacilityMember,
  type IFacilityMemberFormState,
  type RawFacilityMemberRecord,
} from "@/utils/interfaces/facility-members";

const FACILITY_MEMBERS_TABLE = "facility_members";
const FACILITY_MEMBER_SELECT = `
  id,
  facility_id,
  user_id,
  role_type,
  can_sign_orders,
  is_primary,
  invited_by,
  joined_at,
  created_at,
  member_profile:profiles!facility_members_user_id_fkey (
    id,
    first_name,
    last_name,
    email,
    phone,
    role
  )
`;

/* -------------------------------------------------------------------------- */
/* getFacilityMembers                                                         */
/* -------------------------------------------------------------------------- */

export async function getFacilityMembers(
  facilityId?: string,
  options?: { excludeUserId?: string },
): Promise<IFacilityMember[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  let targetFacilityId = facilityId;

  // If no facilityId provided, look up the caller's own facility
  if (!targetFacilityId) {
    const { data: facility } = await supabase
      .from("facilities")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!facility) return [];
    targetFacilityId = facility.id;
  }

  let query = supabase
    .from(FACILITY_MEMBERS_TABLE)
    .select(FACILITY_MEMBER_SELECT)
    .eq("facility_id", targetFacilityId);

  if (options?.excludeUserId) {
    query = query.neq("user_id", options.excludeUserId);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    console.error("[getFacilityMembers] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch facility members.");
  }

  return mapFacilityMembers((data ?? []) as unknown as RawFacilityMemberRecord[]);
}

/* -------------------------------------------------------------------------- */
/* updateMemberRole                                                           */
/* -------------------------------------------------------------------------- */

export async function updateMemberRole(
  memberId: string,
  _prevState: IFacilityMemberFormState | null,
  formData: FormData,
): Promise<IFacilityMemberFormState> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const raw = { role_type: formData.get("role_type") as string };
    const parsed = updateMemberRoleSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid role.", success: false };
    }

    const { error } = await supabase
      .from(FACILITY_MEMBERS_TABLE)
      .update({ role_type: parsed.data.role_type })
      .eq("id", memberId);

    if (error) {
      console.error("[updateMemberRole] Error:", JSON.stringify(error));
      return { error: error.message ?? error.code ?? "Failed to update member role.", success: false };
    }

    revalidatePath("/dashboard/settings");
    return { error: null, success: true };
  } catch (err) {
    console.error("[updateMemberRole] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* removeFacilityMember                                                       */
/* -------------------------------------------------------------------------- */

export async function removeFacilityMember(memberId: string): Promise<void> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { error } = await supabase
    .from(FACILITY_MEMBERS_TABLE)
    .delete()
    .eq("id", memberId);

  if (error) {
    console.error("[removeFacilityMember] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to remove member.");
  }

  revalidatePath("/dashboard/settings");
}

/* -------------------------------------------------------------------------- */
/* addFacilityMember — called internally after invite signup                 */
/* -------------------------------------------------------------------------- */

export async function addFacilityMember(
  facilityId: string,
  userId: string,
  roleType: string,
  options?: { isPrimary?: boolean; invitedBy?: string | null },
): Promise<void> {
  // Authorization gate. This action is exposed via Next's RPC because the
  // file is marked "use server", so any signed-in user could hit it directly
  // and inject themselves into a facility. Allowed callers:
  //   - admin / support_staff making a manual addition (signed in)
  //   - the invite-signup flow (caller is unauthenticated — the new user
  //     just got created by createUser() but no session is established yet)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile?.role as string | null | undefined) ?? null;
    if (role !== "admin" && role !== "support_staff") {
      throw new Error("You are not authorized to add facility members.");
    }
  }

  const supabaseAdmin = createAdminClient();
  const payload = {
    facility_id: facilityId,
    user_id: userId,
    role_type: roleType,
    can_sign_orders: roleType === "clinical_provider",
    is_primary: options?.isPrimary ?? false,
    invited_by: options?.invitedBy ?? null,
  };

  const { error } = await supabaseAdmin
    .from(FACILITY_MEMBERS_TABLE)
    .insert(payload);

  if (error) {
    console.error("[addFacilityMember] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to add facility member.");
  }
}
