"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  Profile,
  UpdateProfilePayload,
} from "@/app/(interfaces)/profiles";

const PROFILE_PATH = "/dashboard/profile";

/**
 * READ: Gets the current authenticated user's profile from Auth metadata
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getProfile] Auth error:", authError?.message);
      return null;
    }

    const firstName =
      user.user_metadata?.first_name ??
      user.user_metadata?.full_name?.split(" ")[0] ??
      "";

    const lastName =
      user.user_metadata?.last_name ??
      user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ??
      "";

  return {
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    email: user.email ?? "",
    phone: user.user_metadata?.phone ?? "",
    role: user.user_metadata?.role ?? "sales_representative",
  };

  } catch (err) {
    console.error("[getProfile] Unexpected error:", err);
    return null;
  }
}

/**
 * UPDATE: Saves profile changes using Admin client (service role key)
 * - first_name, last_name, phone → stored in user_metadata
 * - email → updated directly on the auth user
 */
export async function updateProfile(formData: FormData) {
  try {
    // 1. Get current user ID using the regular session client
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[updateProfile] Auth error:", authError?.message);
      throw new Error("User not authenticated");
    }

    const payload: UpdateProfilePayload = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
    };

    // 2. Use admin client to update the user — bypasses key restrictions
    const admin = createAdminClient();

    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        email: payload.email || user.email,
        user_metadata: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          full_name: `${payload.first_name} ${payload.last_name}`.trim(),
          phone: payload.phone,
        },
      },
    );

    if (updateError) {
      console.error("[updateProfile] Update error:", updateError.message);
      throw new Error(updateError.message);
    }

    revalidatePath(PROFILE_PATH);
  } catch (err) {
    console.error("[updateProfile] Unexpected error:", err);
    throw new Error(
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while updating the profile",
    );
  }
}
