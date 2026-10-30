"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevLoginAllowed } from "@/lib/dev/dev-login-guard";
import { safeLogError } from "@/lib/logging/safe-log";
import type { IDevAccount } from "@/utils/interfaces/dev-login";

/* Lists the accounts the switcher offers. Admin client because there is no
   session yet — that is the whole point of this page. */
export async function getDevAccounts(): Promise<IDevAccount[]> {
  if (!(await isDevLoginAllowed())) return [];

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, first_name, last_name, role, status")
    .order("role")
    .order("email");

  if (error) {
    safeLogError("getDevAccounts", error, {});
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
    return {
      id: r.id as string,
      email: r.email as string,
      name: name || null,
      role: (r.role as string) ?? "unknown",
      status: (r.status as string) ?? "unknown",
    };
  });
}

/* Signs in as `email` with no password and no MFA challenge.
 *
 * generateLink produces a one-time token without sending any email; verifying
 * it on the cookie-aware client writes the session cookies. The password is
 * never involved, so this works for every seeded account regardless of what
 * their password is, and nothing is transmitted anywhere a normal sign-in
 * wouldn't already go. */
export async function devSignIn(formData: FormData): Promise<void> {
  if (!(await isDevLoginAllowed())) {
    throw new Error("Dev login is not enabled.");
  }

  const email = (formData.get("email") as string | null)?.trim();
  if (!email) throw new Error("Pick an account.");

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    safeLogError("devSignIn", error ?? "no hashed_token", { email });
    throw new Error(`Could not mint a session for ${email}.`);
  }

  const supabase = await createClient();
  // Drop any session already in the cookie jar so switching accounts doesn't
  // leave the previous one's refresh token behind.
  await supabase.auth.signOut();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    safeLogError("devSignIn", verifyError, { email });
    throw new Error(`Could not establish a session for ${email}.`);
  }

  console.log(`[dev-login] signed in as ${email}`);
  redirect("/dashboard");
}
