"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { isAdmin } from "@/utils/helpers/role";

/* ──────────────────────────────────────────────────────────────────────────
 *  Staff invite signup — admin / support_staff path.
 *
 *  This is the "set password and you're in" flow for accounts created via
 *  CreateUserModal. Defers auth-user creation until the invitee actually
 *  consumes the token (matches the sales-rep / clinic-provider pattern).
 *
 *  Flow:
 *    1. Validate token (still active, not expired, not used)
 *    2. Validate role_type is admin or support_staff
 *    3. Create the Supabase Auth user with the provided password
 *    4. Upsert the profiles row with role + first/last name from token
 *    5. Mark the invite_tokens row as used
 *    6. Redirect to /sign-in
 * ──────────────────────────────────────────────────────────────────────── */

export interface StaffInviteSignUpState {
  error: string | null;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    password?: string;
    confirm_password?: string;
  };
}

export async function consumeStaffInvite(
  _prev: StaffInviteSignUpState | null,
  formData: FormData,
): Promise<StaffInviteSignUpState> {
  try {
    const token = (formData.get("token") as string)?.trim();
    const firstName = (formData.get("first_name") as string)?.trim();
    const lastName = (formData.get("last_name") as string)?.trim();
    const password = (formData.get("password") as string) ?? "";
    const confirmPassword = (formData.get("confirm_password") as string) ?? "";

    if (!token) {
      return { error: "Missing invite token." };
    }

    const fieldErrors: NonNullable<StaffInviteSignUpState["fieldErrors"]> = {};
    if (!firstName) fieldErrors.first_name = "First name is required.";
    if (!lastName) fieldErrors.last_name = "Last name is required.";
    if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      fieldErrors.confirm_password = "Passwords don't match.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { error: null, fieldErrors };
    }

    const inviteToken = await validateInviteToken(token);
    if (!inviteToken) {
      return { error: "This invite link is no longer valid." };
    }

    if (
      inviteToken.role_type !== "admin" &&
      inviteToken.role_type !== "support_staff"
    ) {
      return {
        error: "Wrong invite type. Use the link sent to your email.",
      };
    }

    if (!inviteToken.invited_email) {
      return { error: "Invite is missing the recipient email." };
    }

    if (
      inviteToken.expires_at &&
      new Date(inviteToken.expires_at) < new Date()
    ) {
      return { error: "This invite link has expired." };
    }

    const admin = createAdminClient();

    // Step 1 — Create the auth user, email pre-confirmed (admin issued the
    // invite, we trust the email).
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: inviteToken.invited_email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError || !authData?.user) {
      console.error("[consumeStaffInvite] auth.createUser:", authError);
      const message = authError?.message ?? "Failed to create your account.";
      // Friendlier copy for the most common failure: existing email.
      if (message.toLowerCase().includes("already")) {
        return {
          error:
            "An account with this email already exists. Try signing in instead.",
        };
      }
      return { error: message };
    }

    const userId = authData.user.id;

    // Step 2 — Upsert profile with role + name from the invite.
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email: inviteToken.invited_email,
      role: inviteToken.role_type,
      // Admin/support don't have a separate setup wizard — they're done as
      // soon as they pick a password.
      has_completed_setup: isAdmin(inviteToken.role_type),
      status: "active",
    });

    if (profileError) {
      console.error("[consumeStaffInvite] profile upsert:", profileError);
      return { error: "Account created but profile setup failed." };
    }

    // Step 3 — Mark the invite token as used so it can't be re-consumed.
    const { error: tokenError } = await admin
      .from("invite_tokens")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("token", token);

    if (tokenError) {
      console.error("[consumeStaffInvite] token mark-used:", tokenError);
      // Non-fatal — the auth user is already created. Continue.
    }

    // Sign the new user in (server-side) so they land logged-in. Otherwise
    // they'd just see the sign-in form with an empty session.
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({
      email: inviteToken.invited_email,
      password,
    });
  } catch (err) {
    console.error("[consumeStaffInvite] unexpected:", err);
    return {
      error:
        err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }

  // Successful flow ends here — redirect throws to bail out of the action.
  redirect("/dashboard");
}
