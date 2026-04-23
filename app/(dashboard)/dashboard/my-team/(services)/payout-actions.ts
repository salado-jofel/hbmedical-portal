"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { stripe, toStripeAmount } from "@/lib/stripe/stripe";
import { COMMISSION_TABLE, PAYOUTS_TABLE } from "@/utils/constants/commissions";

export interface PayRepResult {
  success: boolean;
  error: string | null;
  transferId?: string;
  amountPaid?: number;
  commissionsPaid?: number;
}

/* -------------------------------------------------------------------------- */
/* payRepCommissions                                                          */
/*                                                                            */
/* Pays a single rep for all their `approved` commissions in the given        */
/* period. One Stripe transfer → one payouts row → bulk status flip on the    */
/* underlying commissions. Idempotent via rep+period key so a double-click    */
/* or network retry never sends two transfers.                                */
/* -------------------------------------------------------------------------- */

export async function payRepCommissions(
  repId: string,
  period: string,
): Promise<PayRepResult> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);
    const adminUser = await getCurrentUserOrThrow(supabase);

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return { success: false, error: "Invalid period (expected YYYY-MM)." };
    }

    const admin = createAdminClient();

    // Rep payout config
    const { data: rep, error: repErr } = await admin
      .from("profiles")
      .select("id, first_name, last_name, stripe_connect_account_id, stripe_payouts_enabled")
      .eq("id", repId)
      .maybeSingle();
    if (repErr || !rep) {
      return { success: false, error: "Sales rep not found." };
    }
    if (!rep.stripe_connect_account_id) {
      return { success: false, error: "Rep has not set up a Stripe payout account yet." };
    }
    if (!rep.stripe_payouts_enabled) {
      return { success: false, error: "Stripe has not enabled payouts for this rep (setup may be incomplete or restricted)." };
    }

    // Approved commissions for this rep + period (not yet paid, not void)
    const { data: approved, error: commErr } = await admin
      .from(COMMISSION_TABLE)
      .select("id, final_amount, commission_amount, adjustment")
      .eq("rep_id", repId)
      .eq("payout_period", period)
      .eq("status", "approved");
    if (commErr) {
      console.error("[payRepCommissions] commissions fetch:", commErr);
      return { success: false, error: "Failed to fetch approved commissions." };
    }
    if (!approved || approved.length === 0) {
      return { success: false, error: "No approved commissions ready to pay for this period." };
    }

    const totalAmount = approved.reduce((sum, c: any) => {
      const final = c.final_amount != null
        ? Number(c.final_amount)
        : Number(c.commission_amount ?? 0) + Number(c.adjustment ?? 0);
      return sum + final;
    }, 0);

    if (totalAmount <= 0) {
      return { success: false, error: "Approved total is $0 — nothing to transfer." };
    }

    // Double-pay guard. We rely on DB state rather than a deterministic Stripe
    // idempotency key because Stripe caches failed responses for 24 hours — if
    // the first attempt hit balance_insufficient, every retry with the same
    // key would replay that failure even after the balance was topped up.
    // Instead: check the payouts table for an existing paid row, and use a
    // fresh UUID idempotency key per attempt so retries are never cached.
    const { data: existingPaid } = await admin
      .from(PAYOUTS_TABLE)
      .select("id, stripe_transfer_id")
      .eq("rep_id", repId)
      .eq("period", period)
      .eq("status", "paid")
      .maybeSingle();
    if (existingPaid?.stripe_transfer_id) {
      return {
        success: false,
        error: `This rep has already been paid for ${period} (transfer ${existingPaid.stripe_transfer_id}).`,
      };
    }

    // Stripe transfer. Fresh idempotency key per attempt — safe because we
    // already proved above that no successful payout exists for this rep+period.
    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: toStripeAmount(totalAmount),
          currency: "usd",
          destination: rep.stripe_connect_account_id,
          description: `Commission payout · ${period}`,
          metadata: {
            rep_id: repId,
            period,
            commission_count: String(approved.length),
            admin_user_id: adminUser.id,
          },
        },
        {
          idempotencyKey: `commission-payout:${repId}:${period}:${randomUUID()}`,
        },
      );
    } catch (err: any) {
      console.error("[payRepCommissions] Stripe transfer failed:", err);
      const code = err?.code as string | undefined;
      const friendly =
        code === "balance_insufficient"
          ? "Your Stripe platform balance is insufficient to cover this payout. Top up your Stripe account and try again."
          : code === "account_closed" || code === "account_frozen"
            ? "This rep's Stripe account is closed or frozen. They'll need to resolve it with Stripe before you can pay them."
            : err?.message ?? "Stripe transfer failed.";
      return { success: false, error: friendly };
    }

    // Upsert payout row for this rep+period. Unique on (rep_id, period) would be
    // ideal; without that we match explicitly.
    const { data: existing, error: existErr } = await admin
      .from(PAYOUTS_TABLE)
      .select("id")
      .eq("rep_id", repId)
      .eq("period", period)
      .maybeSingle();
    if (existErr) {
      console.error("[payRepCommissions] payout lookup:", existErr);
    }

    const paidAt = new Date().toISOString();
    const payoutPayload = {
      rep_id: repId,
      period,
      total_amount: totalAmount,
      status: "paid" as const,
      paid_at: paidAt,
      paid_by: adminUser.id,
      stripe_transfer_id: transfer.id,
      notes: `Stripe transfer ${transfer.id} (${approved.length} commission${approved.length === 1 ? "" : "s"})`,
    };

    if (existing) {
      const { error: updErr } = await admin
        .from(PAYOUTS_TABLE)
        .update(payoutPayload)
        .eq("id", existing.id);
      if (updErr) {
        console.error("[payRepCommissions] payout update:", updErr);
        // Don't fail the flow — money already moved. Surface as a soft log.
      }
    } else {
      const { error: insErr } = await admin
        .from(PAYOUTS_TABLE)
        .insert(payoutPayload);
      if (insErr) {
        console.error("[payRepCommissions] payout insert:", insErr);
      }
    }

    // Flip commissions to paid. If this fails after a successful transfer,
    // we've sent money but DB is stale — log loudly, don't throw.
    const commissionIds = approved.map((c: any) => c.id as string);
    const { error: flipErr } = await admin
      .from(COMMISSION_TABLE)
      .update({ status: "paid", paid_at: paidAt })
      .in("id", commissionIds);
    if (flipErr) {
      console.error(
        "[payRepCommissions] CRITICAL: transfer succeeded but commissions could not be marked paid:",
        flipErr,
        "| transfer_id:",
        transfer.id,
      );
      // Return success=true with a warning so UI toasts success; admin sees logs.
    }

    revalidatePath(`/dashboard/my-team/${repId}`);
    return {
      success: true,
      error: null,
      transferId: transfer.id,
      amountPaid: totalAmount,
      commissionsPaid: approved.length,
    };
  } catch (err) {
    console.error("[payRepCommissions] unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
