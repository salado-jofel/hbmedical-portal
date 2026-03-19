// utils/auth-guard.ts  ← CREATE THIS FILE

import { getSupabaseClient } from "@/utils/supabase/db";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the currently authenticated user from the request session.
 * Throws immediately if there is no valid session — use at the top of
 * every server action that mutates data.
 */
export async function requireUser(): Promise<User> {
  const supabase = await getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Not authenticated.");
  return user;
}

// ── Optional: role-based guard ────────────────────────────────────────────────
// Uncomment and adapt once you have a `profiles` table with a `role` column.
//
// export async function requireAdmin(): Promise<User> {
//   const user = await requireUser();
//   const supabase = await getSupabaseClient();
//
//   const { data: profile } = await supabase
//     .from("profiles")
//     .select("role")
//     .eq("id", user.id)
//     .single();
//
//   if (profile?.role !== "admin") throw new Error("Insufficient permissions.");
//   return user;
// }
