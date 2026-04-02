"use server";

import { getUserData } from "@/app/(dashboard)/dashboard/(services)/actions";
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
  const { data: { user } } = await supabase.auth.getUser();
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

  const userData = await getUserData();
  if (userData?.role === "admin") {
    redirect("/dashboard/products");
  } else {
    redirect("/dashboard");
  }
}
