"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { UserRole } from "@/utils/helpers/role";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserData } from "@/utils/interfaces/users";

export async function signOut() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");

  redirect("/sign-in");
}

export async function getUserData(): Promise<UserData | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, stripe_details_submitted")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = profile?.first_name || user.user_metadata?.first_name || "";
  const lastName  = profile?.last_name  || user.user_metadata?.last_name  || "";
  const fullName  = `${firstName} ${lastName}`.trim() || "User";
  const initials  = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";

  const role: UserRole = profile?.role ?? user.user_metadata?.role ?? "sales_representative";

  // Check if this sales rep is a sub-rep (appears as child_rep_id in rep_hierarchy).
  // Uses createClient() with RLS — rep_own_hierarchy policy allows reps to read their own rows.
  let isSubRep = false;
  if (isSalesRep(role)) {
    const { data: hierarchy } = await supabase
      .from("rep_hierarchy")
      .select("id")
      .eq("child_rep_id", user.id)
      .maybeSingle();
    isSubRep = !!hierarchy;
  }

  return {
    name: fullName,
    email: user.email || "",
    initials,
    role,
    isSubRep,
    userId: user.id,
    stripeDetailsSubmitted: !!profile?.stripe_details_submitted,
  };
}
