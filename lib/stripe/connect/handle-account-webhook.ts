import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Handles Connect events that signal a change to a connected account's
// capabilities (payouts, charges, details submitted). Mirrors the relevant
// booleans into the `profiles` row keyed by the Connect account id.
//
// Any non-account event is ignored. This handler is idempotent — re-applying
// the same account snapshot produces the same profile row.

export async function handleConnectAccountWebhookEvent(event: Stripe.Event) {
  if (event.type !== "account.updated") {
    return;
  }

  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_payouts_enabled: !!account.payouts_enabled,
      stripe_charges_enabled: !!account.charges_enabled,
      stripe_details_submitted: !!account.details_submitted,
    })
    .eq("stripe_connect_account_id", account.id);

  if (error) {
    console.error("[connect.webhook] profile sync failed:", error);
    throw new Error(error.message || "Failed to sync Connect account status.");
  }
}
