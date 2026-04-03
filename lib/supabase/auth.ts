import { createClient } from "./server";
import type { UserRole } from "@/utils/helpers/role";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getCurrentUserOrThrow(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("[auth.getCurrentUserOrThrow] Error:", error);
    throw new Error("You must be signed in.");
  }

  return user;
}

export async function getUserRole(
  supabase: SupabaseServerClient,
): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return (data?.role as UserRole) ?? null;
}

export async function requireAdminOrThrow(
  supabase: SupabaseServerClient,
): Promise<void> {
  const role = await getUserRole(supabase);
  if (role !== "admin") {
    throw new Error("You do not have permission to perform this action.");
  }
}

export async function requireSupportOrAdminOrThrow(
  supabase: SupabaseServerClient,
): Promise<void> {
  const role = await getUserRole(supabase);
  if (role !== "admin" && role !== "support_staff") {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function isClinicSide(role: UserRole): boolean {
  return role === "clinical_provider" || role === "clinical_staff";
}
