import { createClient } from "./server";

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
