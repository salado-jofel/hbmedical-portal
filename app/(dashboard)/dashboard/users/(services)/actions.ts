"use server";

import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/utils/validators/users";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { resend, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/resend";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import type { IUser, IUserFormState, UserStatus } from "@/utils/interfaces/users";
import type { UserRole } from "@/utils/helpers/role";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { buildResetPasswordEmail } from "@/lib/emails/build-reset-password-email";
import { stripe } from "@/lib/stripe/stripe";
import {
  pageToRange,
  sanitizeDir,
  sanitizePage,
  sanitizePageSize,
  sanitizeSort,
  type PaginatedQuery,
  type PaginatedResult,
} from "@/utils/interfaces/paginated";
import { USER_SORT_COLUMNS, type UserSortColumn } from "@/utils/constants/users-list";

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
/* getUsersPaginated                                                          */
/*                                                                            */
/* Server-paginated view of the users list — range() at the DB layer plus     */
/* a count: "exact" to drive the pagination footer. Sort is a direct profile  */
/* column; filters are role + status; search OR's across first/last/email.    */
/* -------------------------------------------------------------------------- */

export async function getUsersPaginated(
  query: PaginatedQuery<{ role: string | null; status: string | null }>,
): Promise<PaginatedResult<IUser>> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const adminClient = createAdminClient();

  const page = sanitizePage(query.page);
  const pageSize = sanitizePageSize(query.pageSize);
  const sort = sanitizeSort<readonly UserSortColumn[]>(
    query.sort,
    USER_SORT_COLUMNS,
    "created_at",
  );
  const dir = sanitizeDir(query.dir);

  let builder = adminClient
    .from("profiles")
    .select(
      `
      id, email, first_name, last_name, phone, role, status,
      has_completed_setup, created_at, updated_at,
      facility:facilities!facilities_user_id_fkey(id, name, status, city, state)
    `,
      { count: "exact" },
    )
    .order(sort, { ascending: dir === "asc" });

  if (query.filters?.role) builder = builder.eq("role", query.filters.role);
  if (query.filters?.status) builder = builder.eq("status", query.filters.status);

  const searchRaw = (query.search ?? "").trim();
  if (searchRaw.length > 0) {
    const term = searchRaw.replace(/[%_,]/g, (c) => `\\${c}`);
    const like = `%${term}%`;
    builder = builder.or(
      `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
    );
  }

  const { from, to } = pageToRange(page, pageSize);
  const { data, error, count } = await builder.range(from, to);

  if (error) {
    console.error("[getUsersPaginated]", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to fetch users.");
  }

  const rows: IUser[] = (data ?? []).map((p: any) => {
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
        ? {
            id: fac.id,
            name: fac.name,
            status: fac.status ?? null,
            city: fac.city ?? null,
            state: fac.state ?? null,
          }
        : null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

/* -------------------------------------------------------------------------- */
/* createUser                                                                 */
/* -------------------------------------------------------------------------- */

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
        has_completed_setup: isAdmin(role),
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
      html: buildResetPasswordEmail({ first_name, last_name, role, resetLink }),
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

    // 1. Fetch profile to check status and role (also pull connect account
    //    id so we can clean it up in Stripe before nuking the local record).
    const { data: profile } = await adminClient
      .from("profiles")
      .select("status, role, stripe_connect_account_id")
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

    // Sales-rep-specific cleanup: Stripe Connect account + rep hierarchy.
    // Stripe deletion runs first; if it fails we keep going (admin can clean
    // the orphan up manually in Stripe Dashboard) and surface a warning.
    let stripeWarning: string | null = null;
    if (isSalesRep(profile.role)) {
      const connectAccountId = profile.stripe_connect_account_id as string | null;
      if (connectAccountId) {
        try {
          await stripe.accounts.del(connectAccountId);
        } catch (err: any) {
          const code = err?.code as string | undefined;
          // "resource_missing" = already gone in Stripe; harmless.
          if (code !== "resource_missing") {
            console.error(
              "[deleteUser] Stripe Connect account delete failed (continuing):",
              "account:", connectAccountId,
              "code:", code,
              "message:", err?.message,
            );
            stripeWarning =
              `User was deleted, but their Stripe Connect account (${connectAccountId}) ` +
              `couldn't be removed automatically (${err?.message ?? code ?? "unknown error"}). ` +
              `Please clean it up in Stripe Dashboard → Connect → Accounts.`;
          }
        }
      }

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
    return {
      success: true,
      error: null,
      ...(stripeWarning ? { warning: stripeWarning } : {}),
    };
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
      inviteUrl: resetLink,
      roleType: role,
      inviterName: "HB Medical",
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[resendInvite] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

