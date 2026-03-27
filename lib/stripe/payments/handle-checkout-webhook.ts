import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type PaymentRecordLookup = {
  id: string;
  order_id: string;
  status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "canceled";
};

type OrderRecordLookup = {
  id: string;
  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "canceled";
};

function getStripeObjectId(
  value:
    | string
    | Stripe.Customer
    | Stripe.PaymentIntent
    | Stripe.Subscription
    | null,
) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function toMajorAmount(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
    return 0;
  }

  return amountMinor / 100;
}

function normalizeCurrency(currency: string | null | undefined) {
  return (currency ?? "usd").toUpperCase();
}

async function getPaymentBySessionId(sessionId: string) {
  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select("id, order_id, status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle<PaymentRecordLookup>();

  if (error) {
    console.error("[payments.getPaymentBySessionId] Error:", error);
    throw new Error(error.message || "Failed to fetch payment by session ID.");
  }

  return data ?? null;
}

async function getOrderById(orderId: string) {
  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .maybeSingle<OrderRecordLookup>();

  if (error) {
    console.error("[payments.getOrderById] Error:", error);
    throw new Error(error.message || "Failed to fetch order.");
  }

  return data ?? null;
}

async function ensurePaymentRecordForSession(
  session: Stripe.Checkout.Session,
  status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "canceled",
  paidAt: string | null,
) {
  const admin = await createAdminClient();

  const existingPayment = await getPaymentBySessionId(session.id);
  const metadataOrderId =
    session.metadata?.order_id ?? session.client_reference_id ?? null;

  const stripePaymentIntentId = getStripeObjectId(session.payment_intent);

  if (existingPayment) {
    const { error } = await admin
      .from("payments")
      .update({
        status,
        stripe_payment_intent_id: stripePaymentIntentId,
        provider_payment_id: stripePaymentIntentId,
        paid_at: paidAt,
      })
      .eq("id", existingPayment.id);

    if (error) {
      console.error(
        "[payments.ensurePaymentRecordForSession] Update error:",
        error,
      );
      throw new Error(error.message || "Failed to update payment record.");
    }

    return existingPayment.order_id;
  }

  if (!metadataOrderId) {
    throw new Error(
      "Unable to resolve order_id from Checkout Session metadata.",
    );
  }

  const { error } = await admin.from("payments").insert({
    order_id: metadataOrderId,
    provider: "stripe",
    payment_type: "checkout",
    status,
    amount: toMajorAmount(session.amount_total),
    currency: normalizeCurrency(session.currency),
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: stripePaymentIntentId,
    provider_payment_id: stripePaymentIntentId,
    paid_at: paidAt,
  });

  if (error) {
    console.error(
      "[payments.ensurePaymentRecordForSession] Insert error:",
      error,
    );
    throw new Error(error.message || "Failed to insert payment record.");
  }

  return metadataOrderId;
}

async function markOrderPaid(orderId: string, paidAt: string) {
  const admin = await createAdminClient();

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      paid_at: paidAt,
    })
    .eq("id", orderId);

  if (error) {
    console.error("[payments.markOrderPaid] Error:", error);
    throw new Error(error.message || "Failed to mark order as paid.");
  }
}

async function markOrderFailedIfNotPaid(orderId: string) {
  const admin = await createAdminClient();
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found while marking failed.");
  }

  if (order.payment_status === "paid") {
    return;
  }

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "failed",
    })
    .eq("id", orderId);

  if (error) {
    console.error("[payments.markOrderFailedIfNotPaid] Error:", error);
    throw new Error(error.message || "Failed to mark order as failed.");
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const paidAt = new Date().toISOString();
  const orderId = await ensurePaymentRecordForSession(session, "paid", paidAt);
  await markOrderPaid(orderId, paidAt);
}

async function handleCheckoutSessionAsyncSucceeded(
  session: Stripe.Checkout.Session,
) {
  const paidAt = new Date().toISOString();
  const orderId = await ensurePaymentRecordForSession(session, "paid", paidAt);
  await markOrderPaid(orderId, paidAt);
}

async function handleCheckoutSessionAsyncFailed(
  session: Stripe.Checkout.Session,
) {
  const orderId = await ensurePaymentRecordForSession(session, "failed", null);
  await markOrderFailedIfNotPaid(orderId);
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  await ensurePaymentRecordForSession(session, "canceled", null);
  // Intentionally do not mark the order itself as canceled.
  // The order can still remain payable with a new Checkout Session later.
}

export async function handleCheckoutWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    }

    case "checkout.session.async_payment_succeeded": {
      await handleCheckoutSessionAsyncSucceeded(
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    }

    case "checkout.session.async_payment_failed": {
      await handleCheckoutSessionAsyncFailed(
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    }

    case "checkout.session.expired": {
      await handleCheckoutSessionExpired(
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    }

    default: {
      return;
    }
  }
}
