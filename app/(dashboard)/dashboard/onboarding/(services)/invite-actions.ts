"use server";

import { revalidatePath } from "next/cache";
import { clinicStaffInviteSchema } from "@/utils/validators/onboarding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import {
  generateInviteTokenSchema,
  type IInviteTokenFormState,
} from "@/utils/interfaces/invite-tokens";
import { INVITE_TOKENS_TABLE, getBaseUrl } from "./_onboarding-shared";

/* -------------------------------------------------------------------------- */
/* getRepFacilityId — walks rep_hierarchy upward to find an owned facility    */
/* -------------------------------------------------------------------------- */

async function getRepFacilityId(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  // Check if this rep directly owns a facility
  const { data: ownedFacility } = await supabase
    .from("facilities")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownedFacility?.id) return ownedFacility.id;

  // Walk up the hierarchy to the parent rep and check theirs
  const { data: hierarchy } = await supabase
    .from("rep_hierarchy")
    .select("parent_rep_id")
    .eq("child_rep_id", userId)
    .limit(1)
    .maybeSingle();

  if (!hierarchy?.parent_rep_id) return null;

  return getRepFacilityId(hierarchy.parent_rep_id, supabase);
}

/* -------------------------------------------------------------------------- */
/* generateInviteToken                                                        */
/* -------------------------------------------------------------------------- */

export async function generateInviteToken(
  _prevState: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole) && !isAdmin(role as UserRole) && !isClinicalProvider(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    // Normalise "none" sentinel → null so UUID validation doesn't reject it
    const rawFacilityId = formData.get("facility_id") as string | null;
    const facilityId =
      !rawFacilityId || rawFacilityId.trim() === "" || rawFacilityId.trim() === "none"
        ? null
        : rawFacilityId.trim();

    const raw = {
      email: formData.get("email") as string,
      facility_id: facilityId,
      role_type: formData.get("role_type") as string,
      expires_in_days: formData.get("expires_in_days") ?? "30",
    };

    const parsed = generateInviteTokenSchema.safeParse(raw);
    if (!parsed.success) {
      const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
      if (emailIssue) {
        return { error: null, success: false, fieldErrors: { email: emailIssue.message } };
      }
      const msg = parsed.error?.issues?.[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const expiresAt = new Date(
      Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Resolve facility_id based on caller role and invite role_type.
    // clinical_provider → NULL (creates own clinic on signup)
    // clinical_staff → provider's facility (set in clinical_provider branch below)
    // sales_representative → NULL (creates own rep_office on setup)
    let resolvedFacilityId: string | null = null;

    if (isAdmin(role as UserRole)) {
      // Admin can invite clinical_provider (must be assigned to a rep/facility)
      // or sales_representative (creates their own rep_office on signup).
      // admin/support accounts are still managed via the Users page.
      if (
        parsed.data.role_type !== "clinical_provider" &&
        parsed.data.role_type !== "sales_representative"
      ) {
        return {
          error: "Admin can only invite Clinical Providers or Sales Reps via link.",
          success: false,
        };
      }
      if (parsed.data.role_type === "clinical_provider") {
        // facility_id = selected rep's facility (required — provider is assigned to a rep)
        resolvedFacilityId = parsed.data.facility_id ?? null;
        if (!resolvedFacilityId) {
          return { error: "Please select a sales rep to assign.", success: false };
        }
      } else {
        // sales_representative → facility_id stays NULL (rep creates their own office)
        resolvedFacilityId = null;
      }
    } else if (isSalesRep(role as UserRole)) {
      // Reps can invite clinical_provider or sales_representative (sub-rep).
      // clinical_staff is NOT allowed for reps — only clinical_provider can invite staff.
      if (parsed.data.role_type === "clinical_staff") {
        return { error: "Only Clinical Providers can invite Clinical Staff.", success: false };
      }
      if (!["clinical_provider", "sales_representative"].includes(parsed.data.role_type)) {
        return { error: "You can only invite Clinical Providers or Sub-Reps.", success: false };
      }
      // clinical_provider → facility_id stays NULL (creates own clinic on signup)
      // sales_representative → facility_id stays NULL (creates own rep_office on setup)
      resolvedFacilityId = null;
    } else if (isClinicalProvider(role as UserRole)) {
      // Clinical providers can only invite clinical_staff to their own clinic
      if (parsed.data.role_type !== "clinical_staff") {
        return { error: "Clinical providers can only invite clinical staff.", success: false };
      }
      const { data: ownedFacility } = await supabase
        .from("facilities")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownedFacility?.id) {
        return { error: "Complete your clinic setup first.", success: false };
      }
      resolvedFacilityId = ownedFacility.id;
    }

    const adminClient = createAdminClient();

    // Edge case A: check if email already has an account
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();
    if (existingProfile) {
      return { error: "An account with this email already exists.", success: false };
    }

    // Edge case B: check for duplicate pending invite
    const { data: pendingInvite } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .select("id, expires_at")
      .eq("invited_email", parsed.data.email)
      .eq("role_type", parsed.data.role_type)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      return { error: "A pending invite already exists for this email.", success: false };
    }

    // Fetch inviter name for the email
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const inviterName = profile ? `${profile.first_name} ${profile.last_name}` : "HB Medical";

    const { data: inserted, error } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .insert({
        created_by: user.id,
        facility_id: resolvedFacilityId,
        role_type: parsed.data.role_type,
        expires_at: expiresAt,
        invited_email: parsed.data.email,
      })
      .select("id, token")
      .single();

    if (error) {
      console.error("[generateInviteToken] Error:", JSON.stringify(error));
      return { error: error.message ?? error.code ?? "Failed to generate invite token.", success: false };
    }

    console.log("[generateInviteToken] Token created:", inserted.id, "for:", parsed.data.email);

    const inviteUrl = `${getBaseUrl()}/invite/${inserted.token}`;
    console.log("[generateInviteToken] Sending invite email to:", parsed.data.email);
    const { error: emailError } = await sendInviteEmail({
      to: parsed.data.email,
      inviteUrl,
      roleType: parsed.data.role_type,
      inviterName,
    });
    console.log("[generateInviteToken] Email send result:", { error: emailError });

    if (emailError) {
      // Rollback: delete the token we just created
      await supabase.from(INVITE_TOKENS_TABLE).delete().eq("id", inserted.id);
      return { error: "Failed to send invite email. Please try again.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { error: null, success: true, invitedEmail: parsed.data.email };
  } catch (err) {
    console.error("[generateInviteToken] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteInviteToken                                                           */
/* -------------------------------------------------------------------------- */

export async function deleteInviteToken(tokenId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .delete()
    .eq("id", tokenId)
    .eq("created_by", user.id);

  if (error) {
    console.error("[deleteInviteToken] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to delete invite token.");
  }

  revalidatePath("/dashboard/onboarding");
}

/* -------------------------------------------------------------------------- */
/* resendInviteEmail — resend the invite email for an existing unused token   */
/* -------------------------------------------------------------------------- */

export async function resendInviteEmail(
  tokenId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // Fetch the token — must belong to this user (or be visible to admin)
    const { data: token } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .select("*")
      .eq("id", tokenId)
      .eq("created_by", user.id)
      .single();

    if (!token) {
      return { error: "Token not found.", success: false };
    }
    if (token.used_at) {
      return { error: "This invite has already been used.", success: false };
    }
    if (!token.invited_email) {
      return { error: "No email address on this invite.", success: false };
    }
    if (new Date(token.expires_at) < new Date()) {
      return { error: "This invite has expired.", success: false };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const inviterName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : "HB Medical";

    const inviteUrl = `${getBaseUrl()}/invite/${token.token}`;

    const { error: emailError } = await sendInviteEmail({
      to: token.invited_email,
      inviteUrl,
      roleType: token.role_type,
      inviterName,
    });

    if (emailError) {
      return { error: "Failed to resend email.", success: false };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[resendInviteEmail]", err);
    return { error: "Failed to resend email.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* generateClinicMemberInvite — clinical_provider invites clinical_staff      */
/* -------------------------------------------------------------------------- */

export async function generateClinicMemberInvite(
  _prevState: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    const rawClinic = {
      email: formData.get("email") as string,
      expires_in_days: formData.get("expires_in_days") ?? "30",
    };

    const parsedClinic = clinicStaffInviteSchema.safeParse(rawClinic);
    if (!parsedClinic.success) {
      const emailIssue = parsedClinic.error.issues.find((i) => i.path[0] === "email");
      if (emailIssue) {
        return { error: null, success: false, fieldErrors: { email: emailIssue.message } };
      }
      return { error: parsedClinic.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const { email, expires_in_days } = parsedClinic.data;

    // Clinical provider owns their clinic directly via facilities.user_id
    const { data: ownedFacility } = await supabase
      .from("facilities")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!ownedFacility?.id) {
      return { error: "No clinic found. Complete your setup first.", success: false };
    }

    const adminClient = createAdminClient();

    // Edge case A: check if email already has an account
    const { data: existingStaffProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingStaffProfile) {
      return { error: "An account with this email already exists.", success: false };
    }

    // Edge case B: check for duplicate pending invite
    const { data: pendingInvite } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .select("id, expires_at")
      .eq("invited_email", email)
      .eq("role_type", "clinical_staff")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      return { error: "A pending invite already exists for this email.", success: false };
    }

    // Fetch inviter name for the email
    const { data: providerProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const inviterName = providerProfile
      ? `${providerProfile.first_name} ${providerProfile.last_name}`
      : "HB Medical";

    const expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .insert({
        created_by: user.id,
        facility_id: ownedFacility.id,
        role_type: "clinical_staff",
        expires_at: expiresAt,
        invited_email: email,
      })
      .select("id, token")
      .single();

    if (error) {
      console.error("[generateClinicMemberInvite] Error:", JSON.stringify(error));
      return { error: error.message ?? "Failed to generate invite.", success: false };
    }

    const inviteUrl = `${getBaseUrl()}/invite/${inserted.token}`;
    const { error: emailError } = await sendInviteEmail({
      to: email,
      inviteUrl,
      roleType: "clinical_staff",
      inviterName,
    });

    if (emailError) {
      await supabase.from(INVITE_TOKENS_TABLE).delete().eq("id", inserted.id);
      return { error: "Failed to send invite email. Please try again.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { error: null, success: true, invitedEmail: email };
  } catch (err) {
    console.error("[generateClinicMemberInvite] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
