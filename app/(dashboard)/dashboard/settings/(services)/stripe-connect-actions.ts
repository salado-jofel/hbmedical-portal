"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { stripe, getAppUrl } from "@/lib/stripe/stripe";

export interface ConnectStatus {
  hasAccount: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface LastPayout {
  period: string;
  totalAmount: number;
  paidAt: string | null;
}

export interface ConnectActionResult {
  success: boolean;
  error: string | null;
  url?: string;
}

/* -------------------------------------------------------------------------- */
/* getMyConnectStatus                                                         */
/* -------------------------------------------------------------------------- */

export async function getMyConnectStatus(): Promise<ConnectStatus> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data } = await supabase
    .from("profiles")
    .select(
      "stripe_connect_account_id, stripe_payouts_enabled, stripe_charges_enabled, stripe_details_submitted",
    )
    .eq("id", user.id)
    .maybeSingle();

  return {
    hasAccount: !!data?.stripe_connect_account_id,
    accountId: data?.stripe_connect_account_id ?? null,
    payoutsEnabled: !!data?.stripe_payouts_enabled,
    chargesEnabled: !!data?.stripe_charges_enabled,
    detailsSubmitted: !!data?.stripe_details_submitted,
  };
}

/* -------------------------------------------------------------------------- */
/* getMyLastPayout — most recent paid payout for the current rep              */
/* -------------------------------------------------------------------------- */

export async function getMyLastPayout(): Promise<LastPayout | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("payouts")
    .select("period, total_amount, paid_at")
    .eq("rep_id", user.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    period: data.period as string,
    totalAmount: Number(data.total_amount),
    paidAt: (data.paid_at as string | null) ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* createConnectOnboardingLink                                                */
/*                                                                            */
/* Idempotent: reuses an existing Connect account if one is already attached  */
/* to the profile; otherwise creates a new Express account first.             */
/* -------------------------------------------------------------------------- */

// returnPath lets callers swap the post-Stripe destination. Defaults to the
// Settings → Payouts return route so existing callers keep working. The login
// gate at /onboarding/payouts passes its own return path so reps land back
// in the gate (which then forwards to /dashboard once details_submitted=true).
export async function createConnectOnboardingLink(
  returnPath: string = "/dashboard/settings/payouts/return",
): Promise<ConnectActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { success: false, error: "Only sales reps can set up payouts." };
    }

    const adminClient = createAdminClient();

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("stripe_connect_account_id, email, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[createConnectOnboardingLink] profile lookup:", profileErr);
      return { success: false, error: "Could not load your profile." };
    }

    let accountId = profile.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: profile.email ?? user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          profile_id: user.id,
        },
      });
      accountId = account.id;

      const { error: saveErr } = await adminClient
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);

      if (saveErr) {
        console.error("[createConnectOnboardingLink] save account id:", saveErr);
        return { success: false, error: "Failed to save payout account. Please try again." };
      }
    }

    const appUrl = getAppUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl}${returnPath}?status=refresh`,
      return_url: `${appUrl}${returnPath}?status=complete`,
    });

    return { success: true, error: null, url: link.url };
  } catch (err) {
    console.error("[createConnectOnboardingLink] unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* createConnectLoginLink                                                     */
/*                                                                            */
/* Express Dashboard login link for reps who've already onboarded — they can  */
/* update bank info, view payouts, download statements.                       */
/* -------------------------------------------------------------------------- */

export async function createConnectLoginLink(): Promise<ConnectActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role as UserRole)) {
      return { success: false, error: "Only sales reps can access payouts." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .maybeSingle();

    const accountId = profile?.stripe_connect_account_id as string | null;
    if (!accountId) {
      return { success: false, error: "You haven't set up payouts yet." };
    }

    const link = await stripe.accounts.createLoginLink(accountId);
    return { success: true, error: null, url: link.url };
  } catch (err) {
    console.error("[createConnectLoginLink] unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* refreshConnectAccountStatus                                                */
/*                                                                            */
/* Pulls the latest account state from Stripe into the profile row. Called    */
/* from the onboarding return page and (later) from webhooks.                 */
/* -------------------------------------------------------------------------- */

export async function refreshConnectAccountStatus(): Promise<ConnectActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single();

    const accountId = profile?.stripe_connect_account_id as string | null;
    if (!accountId) {
      return { success: false, error: "No Stripe account attached." };
    }

    const account = await stripe.accounts.retrieve(accountId);

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({
        stripe_payouts_enabled: !!account.payouts_enabled,
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_details_submitted: !!account.details_submitted,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("[refreshConnectAccountStatus] update:", updateErr);
      return { success: false, error: "Failed to refresh payout status." };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[refreshConnectAccountStatus] unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
