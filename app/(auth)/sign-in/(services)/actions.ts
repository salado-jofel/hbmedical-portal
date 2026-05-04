"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(
  prevState: any,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Activate pending users on first login
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    if (profile?.status === "pending") {
      await supabase.from("profiles").update({ status: "active" }).eq("id", user.id);
    }
  }

  // MFA routing is delegated to the dashboard layout's evaluateMfaGate(). It
  // sees role + factor + session AAL + SMS-session cookie and redirects to
  // /sign-in/mfa, /sign-in/sms-mfa, or /onboarding/phone as appropriate.
  // Keeping the logic in one place avoids drift between the proactive sign-in
  // redirect and the layout-level gate (which previously diverged for sales
  // reps once we split TOTP vs SMS MFA paths).
  redirect("/dashboard");
}
