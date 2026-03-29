"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function forgotPassword(
  prevState: any,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();

  if (!email) {
    return { error: "Email is required." };
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (profileError) {
    console.error("[forgotPassword] Profile lookup failed:", profileError);
    return { error: "Something went wrong. Please try again." };
  }

  if (!profile) {
    return { error: "No account found with this email address." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("[forgotPassword] resetPasswordForEmail failed:", error);
    return { error: error.message || "Failed to send reset email." };
  }

  return { success: true };
}
