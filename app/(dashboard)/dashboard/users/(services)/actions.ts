"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import type { IUser, IUserFormState, UserStatus } from "@/utils/interfaces/users";
import type { UserRole } from "@/utils/helpers/role";
import { ROLE_LABELS } from "@/utils/helpers/role";

const LOGO_URL =
  "https://eyrefohymvvabazvmemq.supabase.co/storage/v1/object/public/spearhead-assets/assets/email/hb-logo-name-2.png";

/* -------------------------------------------------------------------------- */
/* getUsers                                                                   */
/* -------------------------------------------------------------------------- */

export async function getUsers(filters?: {
  role?: string;
  search?: string;
}): Promise<IUser[]> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const adminClient = createAdminClient();

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select(`
      id,
      email,
      first_name,
      last_name,
      phone,
      role,
      status,
      has_completed_setup,
      created_at,
      updated_at,
      facility:facilities!facilities_user_id_fkey(
        id,
        name,
        status,
        city,
        state
      )
    `)
    .order("created_at", { ascending: false });

  if (profilesError) {
    console.error("[getUsers] Profiles error:", JSON.stringify(profilesError));
    throw new Error(profilesError.message ?? profilesError.code ?? "Failed to fetch users.");
  }

  let users: IUser[] = (profiles ?? []).map((p: any) => {
    const fac = Array.isArray(p.facility) ? p.facility[0] : p.facility;
    const status = (p.status as UserStatus) ?? "pending";

    return {
      id: p.id,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      email: p.email ?? "",
      role: p.role,
      created_at: p.created_at ?? "",
      is_active: status === "active",
      status,
      facility: fac
        ? { id: fac.id, name: fac.name, status: fac.status ?? null, city: fac.city ?? null, state: fac.state ?? null }
        : null,
    };
  });

  // Role filter
  if (filters?.role && filters.role !== "all") {
    users = users.filter((u) => u.role === filters.role);
  }

  // Search filter
  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    users = users.filter(
      (u) =>
        u.first_name.toLowerCase().includes(term) ||
        u.last_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    );
  }

  return users;
}

/* -------------------------------------------------------------------------- */
/* createUser                                                                 */
/* -------------------------------------------------------------------------- */

const createUserSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
  role: z.enum(["admin", "sales_representative", "support_staff"] as const, {
    error: "Select a valid role.",
  }),
});

export async function createUser(
  _prev: IUserFormState | null,
  formData: FormData,
): Promise<IUserFormState> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("[createUser] RESEND_API_KEY not set");
    }

    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
    };

    const parsed = createUserSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IUserFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IUserFormState["fieldErrors"]>;
        fieldErrors[field] = issue.message;
      }
      return { error: null, success: false, fieldErrors };
    }

    const { first_name, last_name, email, role } = parsed.data;

    console.log("[createUser] Creating user:", { email, first_name, last_name, role });

    const adminClient = createAdminClient();

    // Step 1 — Create the auth user with email pre-confirmed
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

    if (authError || !authData?.user) {
      console.error("[createUser] Auth createUser error:", authError);
      return { error: authError?.message ?? "Failed to create auth user.", success: false };
    }

    const userId = authData.user.id;
    console.log("[createUser] Auth user created:", userId);

    // Step 2 — Upsert profile with the assigned role
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: userId,
        first_name,
        last_name,
        email,
        role,
        has_completed_setup: role === "admin",
        status: "pending",
      });

    if (profileError) {
      console.error("[createUser] Profile upsert error:", JSON.stringify(profileError));
      return { error: "User created but profile setup failed.", success: false };
    }

    // Step 3 — Generate a password-reset (recovery) link
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/set-password`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[createUser] generateLink error:", linkError);
      const newUser: IUser = {
        id: userId,
        first_name,
        last_name,
        email,
        role: role as NonNullable<UserRole>,
        created_at: authData.user.created_at,
        is_active: true,
        status: "pending",
        facility: null,
      };
      return { success: true, error: null, user: newUser };
    }

    const resetLink = linkData.properties.action_link;

    // Step 4 — Send invite email via Resend
    const emailResult = await resend.emails.send({
      from: ACCOUNTS_FROM_EMAIL,
      to: email,
      subject: "You've been invited to HB Medical Portal",
      html: buildInviteEmail({ first_name, last_name, role, resetLink }),
    });

    console.log("[createUser] Email result:", JSON.stringify(emailResult));

    const newUser: IUser = {
      id: userId,
      first_name,
      last_name,
      email,
      role: role as NonNullable<UserRole>,
      created_at: authData.user.created_at,
      is_active: true,
      status: "pending",
      facility: null,
    };

    revalidatePath("/dashboard/users");
    return { success: true, error: null, user: newUser };
  } catch (err) {
    console.error("[createUser] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deactivateUser                                                             */
/* -------------------------------------------------------------------------- */

export async function deactivateUser(userId: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876600h", // ~100 years
  });

  if (error) {
    console.error("[deactivateUser] Error:", error);
    throw new Error(error.message ?? "Failed to deactivate user.");
  }

  await adminClient.from("profiles").update({ status: "inactive" }).eq("id", userId);

  revalidatePath("/dashboard/users");
}

/* -------------------------------------------------------------------------- */
/* reactivateUser                                                             */
/* -------------------------------------------------------------------------- */

export async function reactivateUser(userId: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) {
    console.error("[reactivateUser] Error:", error);
    throw new Error(error.message ?? "Failed to reactivate user.");
  }

  await adminClient.from("profiles").update({ status: "active" }).eq("id", userId);

  revalidatePath("/dashboard/users");
}

/* -------------------------------------------------------------------------- */
/* deleteUser                                                                 */
/* -------------------------------------------------------------------------- */

export async function deleteUser(userId: string): Promise<IUserFormState> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    // Guard: admin cannot delete themselves
    const currentUser = await getCurrentUserOrThrow(supabase);
    if (userId === currentUser.id) {
      return { success: false, error: "You cannot delete your own account." };
    }

    const adminClient = createAdminClient();

    // 1. Fetch profile to check status and role
    const { data: profile } = await adminClient
      .from("profiles")
      .select("status, role")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found." };
    }

    // Active users must be deactivated first
    if (profile.status === "active") {
      return { success: false, error: "Deactivate this user before deleting." };
    }

    // 2. Clean up related data in FK-safe order

    // Rep hierarchy (sales reps only)
    if (profile.role === "sales_representative") {
      await adminClient
        .from("rep_hierarchy")
        .delete()
        .or(`parent_rep_id.eq.${userId},child_rep_id.eq.${userId}`);
    }

    // Invite tokens created by this user
    await adminClient
      .from("invite_tokens")
      .delete()
      .eq("created_by", userId);

    // Facility memberships this user belongs to
    await adminClient
      .from("facility_members")
      .delete()
      .eq("user_id", userId);

    // Provider credentials
    await adminClient
      .from("provider_credentials")
      .delete()
      .eq("user_id", userId);

    // Facilities owned by this user — clean children first
    const { data: userFacilities } = await adminClient
      .from("facilities")
      .select("id")
      .eq("user_id", userId);

    if (userFacilities && userFacilities.length > 0) {
      const facilityIds = userFacilities.map((f: { id: string }) => f.id);

      await adminClient.from("facility_members").delete().in("facility_id", facilityIds);
      await adminClient.from("contacts").delete().in("facility_id", facilityIds);
      await adminClient.from("activities").delete().in("facility_id", facilityIds);

      // Nullify tasks linked to these facilities (don't delete tasks)
      await adminClient
        .from("tasks")
        .update({ facility_id: null })
        .in("facility_id", facilityIds);

      // Orders + their children
      try {
        const { data: facilityOrders } = await adminClient
          .from("orders")
          .select("id")
          .in("facility_id", facilityIds);

        if (facilityOrders && facilityOrders.length > 0) {
          const orderIds = facilityOrders.map((o: { id: string }) => o.id);
          await adminClient.from("order_items").delete().in("order_id", orderIds);
          await adminClient.from("shipments").delete().in("order_id", orderIds);
          await adminClient.from("payments").delete().in("order_id", orderIds);
          await adminClient.from("invoices").delete().in("order_id", orderIds);
          await adminClient.from("orders").delete().in("facility_id", facilityIds);
        }
      } catch (err) {
        console.error("[deleteUser] Order cleanup failed:", err);
        // Continue — don't block user deletion over order cleanup
      }

      await adminClient.from("facilities").delete().eq("user_id", userId);
    }

    // 3. Nullify assigned_rep on any clinics assigned to this user
    await adminClient
      .from("facilities")
      .update({ assigned_rep: null })
      .eq("assigned_rep", userId);

    // 4. Delete auth user — profile cascades via FK
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[deleteUser] Error:", JSON.stringify(deleteError));
      return { success: false, error: deleteError.message ?? "Failed to delete user." };
    }

    revalidatePath("/dashboard/users");
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteUser] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* resendInvite                                                               */
/* -------------------------------------------------------------------------- */

export async function resendInvite(
  userId: string,
  email: string,
  firstName: string,
  role: string,
): Promise<IUserFormState> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    const adminClient = createAdminClient();

    // Verify user is still pending
    const { data: profile } = await adminClient
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .single();

    if (profile?.status !== "pending") {
      return { error: "User is not in pending status.", success: false };
    }

    // Generate fresh recovery link
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/set-password`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[resendInvite] generateLink error:", linkError);
      return { error: linkError?.message ?? "Failed to generate invite link.", success: false };
    }

    const resetLink = linkData.properties.action_link;

    await sendInviteEmail({
      to: email,
      firstName,
      role: ROLE_LABELS[role as NonNullable<UserRole>] ?? role,
      resetLink,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[resendInvite] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* Email template                                                             */
/* -------------------------------------------------------------------------- */

function buildInviteEmail({
  first_name,
  last_name,
  role,
  resetLink,
}: {
  first_name: string;
  last_name: string;
  role: string;
  resetLink: string;
}) {
  const roleLabel =
    role === "admin"
      ? "Administrator"
      : role === "sales_representative"
      ? "Sales Representative"
      : "Support Staff";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
    .wrapper { background-color: #f4f7f9; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: #ffffff; padding: 22px 28px 16px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .logo-img { display: block; margin: 0 auto; width: 176px; height: auto; border: 0; }
    .content { padding: 28px 32px 34px; line-height: 1.6; color: #334155; }
    .h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { margin: 0 0 14px; font-size: 14px; }
    .btn-row { text-align: center; margin: 24px 0 22px; }
    .btn { background-color: #15689E; color: #ffffff !important; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
    .muted { margin-top: 20px; font-size: 13px; color: #94a3b8; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" />
      </div>
      <div class="content">
        <h1 class="h1">You've been invited to HB Medical Portal</h1>
        <p>Hi ${first_name},</p>
        <p>
          You have been added to the <strong>HB Medical Portal</strong> as a
          <strong> ${roleLabel}</strong>. Click the button below to set your
          password and get started.
        </p>
        <div class="btn-row">
          <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">
            Set Password &amp; Sign In
          </a>
        </div>
        <p>This link expires in 24 hours. If you did not expect this email, you can safely ignore it.</p>
        <p class="muted">
          Questions? Reply to this email or contact your HB Medical admin.
        </p>
      </div>
      <div class="footer">&copy; 2026 HB Medical Portal. Secure &amp; Confidential.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
