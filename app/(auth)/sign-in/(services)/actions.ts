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

  // MFA step-up — if the account has a verified TOTP factor but the session
  // is still aal1 (just signed in with password), send the user to the
  // challenge page. The dashboard's MFA gate would catch this anyway, but
  // redirecting here avoids one extra hop and keeps the URL clean.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = !!factors?.totp?.find((f) => f.status === "verified");
  if (hasVerifiedTotp) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      redirect("/sign-in/mfa");
    }
  }

  redirect("/dashboard");
}
