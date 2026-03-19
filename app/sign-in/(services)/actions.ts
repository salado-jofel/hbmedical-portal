"use server";

import OAuthClient from "intuit-oauth";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getValidQBClient, createQBClient } from "@/utils/quickbooks/client";
import { redirect } from "next/navigation";

export async function signIn(
  prevState: any,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // ── Step 1: Sign in with Supabase ─────────────────────────────────────────
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  // ── Step 2: Get signed in user ────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Failed to get user session. Please try again." };

  // ── Step 3: Validate QB connection ────────────────────────────────────────
  let qbClient;

  try {
    qbClient = await getValidQBClient();
  } catch {
    const state = crypto.randomUUID();

    await supabase.auth.updateUser({
      data: {
        qb_oauth_state: state,
        qb_oauth_state_exp: Date.now() + 10 * 60 * 1000,
      },
    });

    const authUri = createQBClient().authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state,
    });

    redirect(authUri);
  }

  // ── Step 4: Check if facility needs QB sync ───────────────────────────────
  // ✅ removed phone — facilities table doesn't have that column
  // ✅ destructure error so we can catch silent failures
  const { data: facility, error: facilityError } = await supabaseAdmin
    .from("facilities")
    .select("id, name, qb_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (facilityError) {
    console.error("[signin] Facility query error:", facilityError.message);
    await supabase.auth.signOut();
    return { error: "Failed to load facility data. Please try again." };
  }

  if (!facility) {
    console.warn("[signin] No facility found for user:", user.id);
    // No facility — let them in, nothing to sync
    redirect("/dashboard");
  }

  console.log(
    "[signin] Facility found:",
    facility.name,
    "| qb_customer_id:",
    facility.qb_customer_id,
  );

  // Already synced — skip
  if (facility.qb_customer_id) {
    console.log("[signin] Already synced to QB, skipping.");
    redirect("/dashboard");
  }

  // ── Step 5: Not synced → POST to QB customers ─────────────────────────────
  const token = qbClient.getToken();

  const baseUrl =
    process.env.QB_ENVIRONMENT === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/v3/company/${token.realmId}/customer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        DisplayName: facility.name,
      }),
    });
  } catch (err) {
    console.error("[signin] QB fetch error:", err);
    await supabase.auth.signOut();
    return { error: "Could not reach QuickBooks. Please try again." };
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("[signin] QB customer POST failed:", errText);
    await supabase.auth.signOut();
    return {
      error: "Failed to sync facility with QuickBooks. Please try again.",
    };
  }

  const json = await response.json();
  const customer = json?.Customer;

  console.log("[signin] QB customer response:", JSON.stringify(customer));

  if (!customer?.Id || !customer?.SyncToken) {
    console.error("[signin] QB unexpected response:", json);
    await supabase.auth.signOut();
    return {
      error: "QuickBooks returned an unexpected response. Please try again.",
    };
  }

  // ── Step 6: Save QB data back to facility ─────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from("facilities")
    .update({
      qb_customer_id: customer.Id,
      qb_sync_token: customer.SyncToken,
      qb_synced_at: new Date().toISOString(),
    })
    .eq("id", facility.id);

  if (updateError) {
    console.error("[signin] Facility update error:", updateError.message);
    await supabase.auth.signOut();
    return { error: "Failed to save QuickBooks sync data. Please try again." };
  }

  console.log("[signin] ✅ Facility synced to QB:", customer.Id);

  redirect("/dashboard");
}
