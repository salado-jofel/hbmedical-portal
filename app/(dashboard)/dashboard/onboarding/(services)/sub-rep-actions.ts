"use server";

import { revalidatePath } from "next/cache";
import { inviteSubRepSchema } from "@/utils/validators/onboarding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import { INVITE_TOKENS_TABLE, getBaseUrl } from "./_onboarding-shared";

/* -------------------------------------------------------------------------- */
/* inviteSubRep                                                                */
/* -------------------------------------------------------------------------- */

export async function inviteSubRep(
  _prev: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    const raw = {
      email: formData.get("email") as string,
      expires_in_days: formData.get("expires_in_days") ?? "30",
      commission_rate: formData.get("commission_rate") as string | null,
      commission_override: formData.get("commission_override") as string | null,
    };

    const parsed = inviteSubRepSchema.safeParse(raw);
    if (!parsed.success) {
      const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
      if (emailIssue) {
        return { error: null, success: false, fieldErrors: { email: emailIssue.message } };
      }
      return { error: parsed.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const { email, expires_in_days, commission_rate, commission_override } = parsed.data;
    const adminClient = createAdminClient();

    // Block if the email already has an account.
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile) {
      return { error: "An account with this email already exists.", success: false };
    }

    // Block if there's already an active (unused, unexpired) invite for this email.
    const { data: pendingInvite } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .select("id")
      .eq("invited_email", email)
      .eq("role_type", "sales_representative")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pendingInvite) {
      return { error: "A pending invite already exists for this email.", success: false };
    }

    const expiresAt = new Date(
      Date.now() + expires_in_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Create the invite token — consumed later at /invite/:token/signup where the
    // auth user, profile, and rep_hierarchy are created as one atomic step.
    const { data: inserted, error: insertErr } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .insert({
        created_by: user.id,
        facility_id: null,
        role_type: "sales_representative",
        expires_at: expiresAt,
        invited_email: email,
        commission_rate,
        commission_override,
      })
      .select("id, token")
      .single();

    if (insertErr || !inserted) {
      console.error("[inviteSubRep] token insert error:", JSON.stringify(insertErr));
      return { error: "Failed to generate invite link. Please try again.", success: false };
    }

    const { data: parentProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const parentName = parentProfile
      ? `${parentProfile.first_name ?? ""} ${parentProfile.last_name ?? ""}`.trim() ||
        "Meridian"
      : "Meridian";

    const inviteUrl = `${getBaseUrl()}/invite/${inserted.token}`;

    const { error: emailError } = await sendInviteEmail({
      to: email,
      inviteUrl,
      roleType: "sales_representative",
      inviterName: parentName,
    });

    if (emailError) {
      // Rollback the token so the caller can retry cleanly.
      await supabase.from(INVITE_TOKENS_TABLE).delete().eq("id", inserted.id);
      console.error("[inviteSubRep] sendInviteEmail:", emailError);
      return { error: "Failed to send invite email. Please try again.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { success: true, error: null, invitedEmail: email };
  } catch (err) {
    console.error("[inviteSubRep] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* getMySubReps                                                                */
/* -------------------------------------------------------------------------- */

export async function getMySubReps(): Promise<ISubRep[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("rep_hierarchy")
    .select(`
      child:profiles!rep_hierarchy_child_rep_id_fkey(
        id, first_name, last_name, email, status, has_completed_setup, created_at
      )
    `)
    .eq("parent_rep_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMySubReps]", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to fetch sub-reps.");
  }

  return (data ?? []).map((row: any) => {
    const c = Array.isArray(row.child) ? row.child[0] : row.child;
    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      status: c.status,
      has_completed_setup: c.has_completed_setup ?? false,
      created_at: c.created_at,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* updateSubRepStatus                                                          */
/* -------------------------------------------------------------------------- */

export async function updateSubRepStatus(
  subRepId: string,
  status: "active" | "inactive",
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    const adminClient = createAdminClient();

    // Verify this sub-rep is a direct child of the caller
    const { data: link, error: linkError } = await adminClient
      .from("rep_hierarchy")
      .select("id")
      .eq("parent_rep_id", user.id)
      .eq("child_rep_id", subRepId)
      .single();

    if (linkError || !link) {
      return { error: "You can only manage your own sub-reps.", success: false };
    }

    // Update profile status
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ status })
      .eq("id", subRepId);

    if (profileError) {
      console.error("[updateSubRepStatus] profile update error:", JSON.stringify(profileError));
      return { error: profileError.message ?? "Failed to update status.", success: false };
    }

    // Ban/unban in auth to prevent or restore login
    if (status === "inactive") {
      await adminClient.auth.admin.updateUserById(subRepId, {
        ban_duration: "876600h", // ~100 years
      });
    } else {
      await adminClient.auth.admin.updateUserById(subRepId, {
        ban_duration: "none",
      });
    }

    revalidatePath("/dashboard/onboarding");
    return { success: true, error: null };
  } catch (err) {
    console.error("[updateSubRepStatus] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteSubRep — pending-only; cascades via auth.admin.deleteUser            */
/* -------------------------------------------------------------------------- */

export async function deleteSubRep(subRepId: string): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    const adminClient = createAdminClient();

    // Verify this sub-rep is a direct child of the caller
    const { data: link, error: linkError } = await adminClient
      .from("rep_hierarchy")
      .select("id")
      .eq("parent_rep_id", user.id)
      .eq("child_rep_id", subRepId)
      .single();

    if (linkError || !link) {
      return { error: "You can only manage your own sub-reps.", success: false };
    }

    // Verify sub-rep is pending (only pending sub-reps may be deleted)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("status")
      .eq("id", subRepId)
      .single();

    if (profileError || !profile) {
      return { error: "Sub-rep not found.", success: false };
    }

    if (profile.status === "active") {
      return { error: "Deactivate this sub-rep before deleting.", success: false };
    }
    // pending and inactive are both allowed to be deleted

    // Delete auth user — cascades profile + rep_hierarchy via FK
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(subRepId);

    if (deleteError) {
      console.error("[deleteSubRep] deleteUser error:", deleteError);
      return { error: deleteError.message ?? "Failed to delete sub-rep.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteSubRep] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* resendSubRepInvite — pending-only; generates recovery link + sends email  */
/* -------------------------------------------------------------------------- */

export async function resendSubRepInvite(
  subRepId: string,
  email: string,
  firstName: string,
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { error: "Unauthorized.", success: false };
    }

    const adminClient = createAdminClient();

    // Verify this sub-rep is a direct child of the caller
    const { data: link, error: linkError } = await adminClient
      .from("rep_hierarchy")
      .select("id")
      .eq("parent_rep_id", user.id)
      .eq("child_rep_id", subRepId)
      .single();

    if (linkError || !link) {
      return { error: "You can only manage your own sub-reps.", success: false };
    }

    // Generate a recovery link for the pending user
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? "http://localhost:3000";

    const { data: linkData, error: genError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl}/set-password`,
      },
    });

    if (genError || !linkData?.properties?.action_link) {
      console.error("[resendSubRepInvite] generateLink error:", genError);
      return { error: genError?.message ?? "Failed to generate invite link.", success: false };
    }

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const inviterName = inviterProfile
      ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
      : "Meridian";

    await sendInviteEmail({
      to: email,
      inviteUrl: linkData.properties.action_link,
      roleType: "sales_representative",
      inviterName,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[resendSubRepInvite] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
