"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import type {
  Profile,
  IProfileFormState,
} from "@/utils/interfaces/profiles";

const SETTINGS_PATH = "/dashboard/settings";

const updateProfileSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required."),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required."),
  phone: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
});

/* -------------------------------------------------------------------------- */
/* getProfile                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reads the authenticated user's profile from the `profiles` table.
 * Uses createClient() so RLS (profiles_select_own) scopes results to
 * the current user automatically.
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase).catch(() => null);
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, role")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      console.error("[getProfile] Error:", JSON.stringify(error));
      return null;
    }

    return {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: (data.phone as string | null) ?? null,
      role: data.role as Profile["role"],
    };
  } catch (err) {
    console.error("[getProfile] Unexpected error:", err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* updateProfile                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Updates first_name, last_name, phone only.
 * email and role are NEVER accepted from the form.
 */
export async function updateProfile(
  _prev: IProfileFormState | null,
  formData: FormData,
): Promise<IProfileFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name:  formData.get("last_name") as string,
      phone:      (formData.get("phone") as string) ?? "",
    };

    const parsed = updateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IProfileFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IProfileFormState["fieldErrors"]>;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      return { error: null, success: false, fieldErrors };
    }

    const phoneValue = parsed.data.phone || null; // "" → null (clears phone)

    // 1. Update profiles table (canonical source of truth, RLS scoped to own row)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: parsed.data.first_name,
        last_name:  parsed.data.last_name,
        phone:      phoneValue,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("[updateProfile] Profile update error:", JSON.stringify(profileError));
      return { error: profileError.message || "Failed to update profile.", success: false };
    }

    // 2. Sync user_metadata so Supabase auth.getUser() metadata stays in sync
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        first_name: parsed.data.first_name,
        last_name:  parsed.data.last_name,
        full_name:  `${parsed.data.first_name} ${parsed.data.last_name}`.trim(),
        phone:      phoneValue,
      },
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[updateProfile] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
