"use server";

import { revalidatePath } from "next/cache";
import { inviteSubRepSchema } from "@/utils/validators/onboarding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import { INVITE_TOKENS_TABLE, LOGO_URL } from "./_onboarding-shared";

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
    };

    const parsed = inviteSubRepSchema.safeParse(raw);
    if (!parsed.success) {
      const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
      if (emailIssue) {
        return { error: null, success: false, fieldErrors: { email: emailIssue.message } };
      }
      return { error: parsed.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const { email } = parsed.data;

    const adminClient = createAdminClient();

    // Generate invite link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? "http://localhost:3000";

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { first_name: "Pending", last_name: "Setup", invited_by: user.id },
          redirectTo: `${appUrl}/set-password`,
        },
      });

    if (linkError || !linkData?.user) {
      console.error("[inviteSubRep] generateLink error:", linkError);
      // Supabase returns "User already registered" when the email already exists
      if (linkError?.message?.toLowerCase().includes("already registered") ||
          linkError?.message?.toLowerCase().includes("already exists")) {
        return { error: "An account with this email already exists.", success: false };
      }
      return { error: linkError?.message ?? "Failed to create invite.", success: false };
    }

    const userId = linkData.user.id;
    const actionLink = linkData.properties?.action_link ?? "";

    // Create profile with placeholder name — sub-rep provides real name during setup
    await adminClient.from("profiles").upsert({
      id: userId,
      first_name: "Pending",
      last_name: "Setup",
      email,
      role: "sales_representative",
    });

    // Link parent → child in rep_hierarchy
    const { error: hierarchyError } = await adminClient
      .from("rep_hierarchy")
      .insert({
        parent_rep_id: user.id,
        child_rep_id: userId,
        created_by: user.id,
      });

    if (hierarchyError) {
      await adminClient.auth.admin.deleteUser(userId);
      console.error("[inviteSubRep] rep_hierarchy insert failed:", JSON.stringify(hierarchyError));
      return {
        error: "Failed to link sub-rep hierarchy. Please try again.",
        success: false,
      };
    }

    // Record invite token for tracking — mark as used immediately since the
    // sub-rep account was created directly (not via /invite/:token link).
    // used_by lets the card resolve has_completed_setup and the rep's facility.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from(INVITE_TOKENS_TABLE).insert({
      created_by: user.id,
      facility_id: null,
      role_type: "sales_representative",
      expires_at: expiresAt,
      invited_email: email,
      used_by: userId,
      used_at: new Date().toISOString(),
    });

    // Send invite email via Resend
    if (actionLink) {
      await resend.emails.send({
        from: ACCOUNTS_FROM_EMAIL,
        to: email,
        subject: "You've been invited to join HB Medical as a Sales Rep",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7f9;margin:0;padding:0;}
.wrapper{background-color:#f4f7f9;padding:32px 16px;}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}
.header{padding:22px 28px 16px;text-align:center;border-bottom:1px solid #f1f5f9;}
.logo-img{display:block;margin:0 auto;width:176px;height:auto;border:0;}
.content{padding:28px 32px 34px;line-height:1.6;color:#334155;}
.h1{font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;}
p{margin:0 0 14px;font-size:14px;}
.btn-row{text-align:center;margin:24px 0 22px;}
.btn{background-color:#e8821a;color:#ffffff !important;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;}
.muted{margin-top:20px;font-size:13px;color:#94a3b8;}
.footer{background-color:#f8fafc;padding:20px 24px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;}
</style></head>
<body>
<div class="wrapper"><div class="container">
<div class="header"><img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" /></div>
<div class="content">
<h1 class="h1">You're invited to HB Medical Portal</h1>
<p>You've been invited to join the <strong>HB Medical Portal</strong> as a <strong>Sales Representative</strong>. Click below to set your password and get started.</p>
<div class="btn-row"><a href="${actionLink}" class="btn" target="_blank" rel="noopener noreferrer">Set Password &amp; Sign In</a></div>
<p>This invitation expires in 7 days. If you did not expect this, you can safely ignore it.</p>
<p class="muted">Questions? Contact your HB Medical admin.</p>
</div>
<div class="footer">&copy; 2026 HB Medical Portal.</div>
</div></div>
</body></html>
        `.trim(),
      });
    }

    revalidatePath("/dashboard/onboarding");
    return { success: true, error: null };
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
      : "HB Medical";

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
