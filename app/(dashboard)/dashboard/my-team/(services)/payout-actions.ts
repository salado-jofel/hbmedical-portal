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
  // Set when the Stripe transfer succeeded (money moved) but the local DB
  // could not be fully reconciled — admin needs to know to investigate.
  warning?: string;
}

/* -------------------------------------------------------------------------- */
/* payRepCommissions                                                          */
/*                                                                            */
/* Pays a single rep for all their `approved` commissions in the given        */
/* period. One Stripe transfer → one payouts row → bulk status flip on the    */
/* underlying commissions. One payout per (rep, period) — late-arriving       */
/* commissions roll into the next month's batch.                              */
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

    // One-payout-per-period rule (business decision: monthly batches).
    // Reject if a paid payout already exists for this (rep, period). Belt:
    // this DB check rejects with a clear error. Suspenders: the unique index
    // payouts_rep_period_uidx blocks any future bug that bypasses this guard.
    const { data: existingPaid } = await admin
      .from(PAYOUTS_TABLE)
      .select("id, stripe_transfer_id, total_amount")
      .eq("rep_id", repId)
      .eq("period", period)
      .eq("status", "paid")
      .maybeSingle();
    if (existingPaid) {
      return {
        success: false,
        error: `This rep has already been paid for ${period} (transfer ${existingPaid.stripe_transfer_id}). Late commissions roll into next month's payout.`,
      };
    }

    // Stripe transfer. Fresh UUID idempotency key per attempt — Stripe caches
    // failed responses for 24h on a deterministic key, which used to cause
    // balance_insufficient failures to replay forever. Safe because the
    // existingPaid guard above ensures only one successful pay attempt per
    // (rep, period) ever lands in the DB.
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

    // Insert the payout audit row. Exactly one row per (rep, period) under
    // the one-payout-per-month rule — guarded above and at the DB by the
    // payouts_rep_period_uidx unique index.
    const paidAt = new Date().toISOString();
    const { error: insErr } = await admin.from(PAYOUTS_TABLE).insert({
      rep_id: repId,
      period,
      total_amount: totalAmount,
      status: "paid" as const,
      paid_at: paidAt,
      paid_by: adminUser.id,
      stripe_transfer_id: transfer.id,
      notes: `Stripe transfer ${transfer.id} (${approved.length} commission${approved.length === 1 ? "" : "s"})`,
    });

    // Flip commissions to paid. Independent of payout-row insert success.
    const commissionIds = approved.map((c: any) => c.id as string);
    const { error: flipErr } = await admin
      .from(COMMISSION_TABLE)
      .update({ status: "paid", paid_at: paidAt })
      .in("id", commissionIds);

    // Money has already moved at this point. If either DB write failed, we
    // can't reverse the Stripe transfer — surface a warning to the admin so
    // they manually reconcile (insert a missing payouts row, update commission
    // statuses) using the transfer.id we return.
    let warning: string | undefined;
    if (insErr || flipErr) {
      console.error(
        "[payRepCommissions] CRITICAL: transfer succeeded but local DB write failed.",
        "transfer_id:", transfer.id,
        "insErr:", insErr,
        "flipErr:", flipErr,
      );
      const parts: string[] = [];
      if (insErr) parts.push("payout audit row");
      if (flipErr) parts.push("commission status update");
      warning =
        `Money was sent successfully (Stripe transfer ${transfer.id}), but the ${parts.join(" and ")} ` +
        `failed locally. Please reconcile manually using the transfer ID.`;
    }

    revalidatePath(`/dashboard/my-team/${repId}`);
    return {
      success: true,
      error: null,
      transferId: transfer.id,
      amountPaid: totalAmount,
      commissionsPaid: approved.length,
      warning,
    };
  } catch (err) {
    console.error("[payRepCommissions] unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
