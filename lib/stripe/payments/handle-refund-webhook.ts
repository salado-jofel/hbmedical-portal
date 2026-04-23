import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Handles charge.refunded events. On refund:
//  - commissions that are `pending` or `approved` are voided (clawback)
//  - commissions that are already `paid` are left untouched; we log a warning
//    so an admin can record a negative adjustment on the next payout via the
//    existing Adjust flow (can't safely retro-edit a commission that already
//    shipped money).
//
// Idempotent — re-running on the same charge is a no-op (rows already void).

export async function handleRefundWebhookEvent(event: Stripe.Event) {
  if (event.type !== "charge.refunded") return;

  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.warn("[refund.webhook] charge.refunded with no payment_intent — skipping:", charge.id);
    return;
  }

  const admin = createAdminClient();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("order_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle<{ order_id: string }>();

  if (payErr) {
    console.error("[refund.webhook] payment lookup failed:", payErr);
    throw new Error(payErr.message || "Failed to look up payment for refund.");
  }
  if (!payment) {
    console.warn("[refund.webhook] no payment found for payment_intent:", paymentIntentId);
    return;
  }

  const { data: commissions, error: commErr } = await admin
    .from("commissions")
    .select("id, status, final_amount, rep_id")
    .eq("order_id", payment.order_id)
    .neq("status", "void");

  if (commErr) {
    console.error("[refund.webhook] commissions lookup failed:", commErr);
    throw new Error(commErr.message || "Failed to look up commissions for refund.");
  }

  const toVoid = (commissions ?? []).filter((c) => c.status === "pending" || c.status === "approved");
  const alreadyPaid = (commissions ?? []).filter((c) => c.status === "paid");

  if (toVoid.length > 0) {
    const reason = `Auto-voided: order refunded (${charge.id}) on ${new Date().toISOString().slice(0, 10)}`;
    const { error: voidErr } = await admin
      .from("commissions")
      .update({ status: "void", notes: reason })
      .in(
        "id",
        toVoid.map((c) => c.id),
      );

    if (voidErr) {
      console.error("[refund.webhook] void update failed:", voidErr);
      throw new Error(voidErr.message || "Failed to void commissions for refund.");
    }

    console.info(
      `[refund.webhook] Auto-voided ${toVoid.length} commission(s) for order ${payment.order_id} (charge ${charge.id})`,
    );
  }

  for (const c of alreadyPaid) {
    console.warn(
      `[refund.webhook] Commission ${c.id} (rep ${c.rep_id}, $${c.final_amount}) was already PAID before the refund. Admin must record a negative adjustment on the next period via the Adjust flow.`,
    );
  }
}
