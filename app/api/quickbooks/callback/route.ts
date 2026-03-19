import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { exchangeCodeForTokens } from "../../../dashboard/quickbooks/actions";
import { getValidQBClient } from "@/utils/quickbooks/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const abortLogin = async (reason: string): Promise<NextResponse> => {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(reason)}`, request.url),
    );
  };

  if (error) {
    return abortLogin("QuickBooks authorization was denied. Please try again.");
  }

  if (!code || !realmId || !state) {
    return abortLogin("Invalid QuickBooks callback. Please sign in again.");
  }

  try {
    await exchangeCodeForTokens(request.url, realmId, state);
  } catch (err) {
    console.error("[QB callback] Token exchange failed:", err);
    return abortLogin("Failed to connect QuickBooks. Please sign in again.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return abortLogin(
      "Session lost during QuickBooks auth. Please sign in again.",
    );
  }
  const { data: facility, error: facilityError } = await supabaseAdmin
    .from("facilities")
    .select("id, name, qb_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (facilityError) {
    console.error("[QB callback] Facility query error:", facilityError.message);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!facility || facility.qb_customer_id) {
    console.log("[QB callback] No sync needed, going to dashboard.");
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  try {
    const client = await getValidQBClient();
    const token = client.getToken();

    const baseUrl =
      process.env.QB_ENVIRONMENT === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    const response = await fetch(
      `${baseUrl}/v3/company/${token.realmId}/customer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          DisplayName: facility.name,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[QB callback] Customer POST failed:", errText);
      return abortLogin(
        "Failed to sync facility with QuickBooks. Please sign in again.",
      );
    }

    const json = await response.json();
    const customer = json?.Customer;

    if (!customer?.Id || !customer?.SyncToken) {
      console.error("[QB callback] Unexpected QB response:", json);
      return abortLogin(
        "QuickBooks returned an unexpected response. Please sign in again.",
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("facilities")
      .update({
        qb_customer_id: customer.Id,
        qb_sync_token: customer.SyncToken,
        qb_synced_at: new Date().toISOString(),
      })
      .eq("id", facility.id);

    if (updateError) {
      console.error(
        "[QB callback] Facility update error:",
        updateError.message,
      );
      return abortLogin(
        "Failed to save QuickBooks sync data. Please sign in again.",
      );
    }

    console.log("[QB callback] ✅ Facility synced to QB:", customer.Id);
  } catch (err) {
    console.error("[QB callback] Sync error:", err);
    return abortLogin("QuickBooks sync failed. Please sign in again.");
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
