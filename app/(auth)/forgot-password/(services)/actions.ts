"use server";

import { createClient } from "@/lib/supabase/server";

export async function forgotPassword(
  prevState: any,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email") as string;

  if (!email?.trim()) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();

  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) {
    return { error: "No account found with this email address." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
