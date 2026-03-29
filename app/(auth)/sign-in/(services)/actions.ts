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
  const userData = await getUserData();
  if (userData?.role === "admin") {
    redirect("/dashboard/products");
  } else {
    redirect("/dashboard");
  }
}
