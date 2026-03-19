"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";

export async function signUp(
  prevState: unknown,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const phone = formData.get("phone") as string;
  const role = (formData.get("role") as string) || "sales_representative";
  const facilityName = formData.get("facility_name") as string;
  const facilityLocation = formData.get("facility_location") as string;

  // ── Step 1: Create Supabase auth user ─────────────────────────────────────
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        role,
        phone,
      },
    },
  });

  if (error) {
    console.error("[signup] Auth error:", error.message);
    return { error: error.message };
  }

  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists." };
  }

  if (!data.user) {
    return { error: "Failed to create account. Please try again." };
  }

  // ── Step 2: Insert facility in DB (no QB yet) ──────────────────────────────
  const { error: facilityError } = await supabaseAdmin
    .from("facilities")
    .insert({
      name: facilityName,
      location: facilityLocation || null,
      user_id: data.user.id,
      status: "Active",
      // QB fields left null — to be synced later
      qb_customer_id: null,
      qb_sync_token: null,
      qb_synced_at: null,
    });

  if (facilityError) {
    console.error("[signup] Facility DB error:", facilityError.message);
    return {
      error:
        "Account created but facility setup failed. Please contact support.",
    };
  }

  redirect("/verify-email");
}
