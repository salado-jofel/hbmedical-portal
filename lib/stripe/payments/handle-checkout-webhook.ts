import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReceiptEmail } from "@/lib/emails/send-payment-receipt";
import { syncOrderToShipStation } from "@/lib/actions/shipstation";
import { stripe } from "../server";

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

type OrderReceiptLookup = {
  id: string;
  order_number: string;
  facility_id: string;
};

type FacilityOwnerLookup = {
  user_id: string;
};

type ProfileEmailLookup = {
  email: string;
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

async function getOrderReceiptContext(orderId: string) {
  const admin = await createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_number, facility_id")
    .eq("id", orderId)
    .maybeSingle<OrderReceiptLookup>();

  if (orderError) {
    console.error("[payments.getOrderReceiptContext] Order error:", orderError);
    throw new Error(
      orderError.message || "Failed to fetch order receipt context.",
    );
  }

  if (!order) {
    return null;
  }

  const { data: facility, error: facilityError } = await admin
    .from("facilities")
    .select("user_id")
    .eq("id", order.facility_id)
    .maybeSingle<FacilityOwnerLookup>();

  if (facilityError) {
    console.error(
      "[payments.getOrderReceiptContext] Facility error:",
      facilityError,
    );
    throw new Error(
      facilityError.message || "Failed to fetch facility receipt context.",
    );
  }

  if (!facility) {
    return {
      orderNumber: order.order_number,
      email: null,
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", facility.user_id)
    .maybeSingle<ProfileEmailLookup>();

  if (profileError) {
    console.error(
      "[payments.getOrderReceiptContext] Profile error:",
      profileError,
    );
    throw new Error(
      profileError.message || "Failed to fetch profile receipt context.",
    );
  }

  return {
    orderNumber: order.order_number,
    email: profile?.email ?? null,
  };
}

async function getReceiptUrlFromSession(session: Stripe.Checkout.Session) {
  const paymentIntentId = getStripeObjectId(session.payment_intent);

  if (!paymentIntentId) {
    return null;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const latestCharge = paymentIntent.latest_charge;

    if (!latestCharge || typeof latestCharge === "string") {
      return null;
    }

    return latestCharge.receipt_url ?? null;
  } catch (error) {
    console.error("[payments.getReceiptUrlFromSession] Error:", error);
    return null;
  }
}

async function sendSuccessfulPaymentReceipt(
  orderId: string,
  session: Stripe.Checkout.Session,
) {
  try {
    const receiptContext = await getOrderReceiptContext(orderId);

    const recipientEmail =
      receiptContext?.email ??
      session.customer_details?.email ??
      session.customer_email ??
      null;

    console.info(
      "[payments.sendSuccessfulPaymentReceipt] orderId:",
      orderId,
      "| recipientEmail:",
      recipientEmail,
      "| orderNumber:",
      receiptContext?.orderNumber,
      "| amountTotal:",
      session.amount_total,
    );

    if (!recipientEmail) {
      console.warn(
        "[payments.sendSuccessfulPaymentReceipt] No recipient email found — skipping email.",
      );
      return;
    }

    const receiptUrl = await getReceiptUrlFromSession(session);

    console.info(
      "[payments.sendSuccessfulPaymentReceipt] receiptUrl:",
      receiptUrl,
      "| Calling sendPaymentReceiptEmail...",
    );

    const result = await sendPaymentReceiptEmail({
      to: recipientEmail,
      orderId,
      orderNumber:
        receiptContext?.orderNumber ?? session.metadata?.order_number,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      receiptUrl,
    });

    console.info(
      "[payments.sendSuccessfulPaymentReceipt] sendPaymentReceiptEmail result:",
      result,
    );
  } catch (error) {
    console.error(
      "[payments.sendSuccessfulPaymentReceipt] Failed to send receipt email:",
      error,
    );
    // Do not throw here — payment was already successful and DB should remain source of truth.
  }
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

  const chargeDetails =
    status === "paid"
      ? await getChargeDetailsFromSession(session)
      : {
          stripePaymentIntentId: getStripeObjectId(session.payment_intent),
          stripeChargeId: null,
          receiptUrl: null,
        };

  if (existingPayment) {
    const { error } = await admin
      .from("payments")
      .update({
        status: status,
        stripe_payment_intent_id: stripePaymentIntentId,
        provider_payment_id: stripePaymentIntentId,
        paid_at: paidAt,
        stripe_charge_id: chargeDetails.stripeChargeId,
        receipt_url: chargeDetails.receiptUrl,
      })
      .eq("id", existingPayment.id);

    if (error) {
      console.error(
        "[payments.ensurePaymentRecordForSession] Update error:",
        error,
      );
      throw new Error(error.message || "Failed to update payment record.");
    }

    return {
      orderId: existingPayment.order_id,
      wasAlreadyPaid: existingPayment.status === "paid",
    };
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

  return {
    orderId: metadataOrderId,
    wasAlreadyPaid: false,
  };
}

async function getChargeDetailsFromSession(session: Stripe.Checkout.Session) {
  const paymentIntentId = getStripeObjectId(session.payment_intent);

  if (!paymentIntentId) {
    return {
      stripePaymentIntentId: null,
      stripeChargeId: null,
      receiptUrl: null,
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const latestCharge = paymentIntent.latest_charge;

    if (!latestCharge || typeof latestCharge === "string") {
      return {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: null,
        receiptUrl: null,
      };
    }

    return {
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: latestCharge.id ?? null,
      receiptUrl: latestCharge.receipt_url ?? null,
    };
  } catch (error) {
    console.error("[payments.getChargeDetailsFromSession] Error:", error);

    return {
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: null,
      receiptUrl: null,
    };
  }
}

async function markOrderPaid(orderId: string, paidAt: string) {
  const admin = await createAdminClient();

  console.info("[payments.markOrderPaid] Updating orderId:", orderId, "paidAt:", paidAt);

  const { data, error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      fulfillment_status: "processing",
      paid_at: paidAt,
    })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[payments.markOrderPaid] DB error:", JSON.stringify(error), "orderId:", orderId);
    throw new Error(error.message || "Failed to mark order as paid.");
  }

  const result = Boolean(data);
  console.info(
    "[payments.markOrderPaid] orderId:",
    orderId,
    "| updated:",
    result,
    "| data:",
    data,
  );
  return result;
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

async function syncToShipStationSafely(orderId: string) {
  try {
    await syncOrderToShipStation(orderId);
  } catch (error) {
    console.error(
      "[payments.syncToShipStationSafely] ShipStation sync failed for order:",
      orderId,
      error,
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const paidAt = new Date().toISOString();

  console.info(
    "[payments.handleCheckoutSessionCompleted] Handling session:",
    session.id,
  );

  const { orderId, wasAlreadyPaid } = await ensurePaymentRecordForSession(
    session,
    "paid",
    paidAt,
  );

  console.info(
    "[payments.handleCheckoutSessionCompleted] orderId:",
    orderId,
    "| wasAlreadyPaid:",
    wasAlreadyPaid,
  );

  const didMarkPaid = await markOrderPaid(orderId, paidAt);

  console.info(
    "[payments.handleCheckoutSessionCompleted] didMarkPaid:",
    didMarkPaid,
  );

  if (!wasAlreadyPaid && didMarkPaid) {
    console.info(
      "[payments.handleCheckoutSessionCompleted] Guard passed — sending receipt email for order:",
      orderId,
    );
    await sendSuccessfulPaymentReceipt(orderId, session);
    await syncToShipStationSafely(orderId);
  } else {
    console.warn(
      "[payments.handleCheckoutSessionCompleted] Guard FAILED — email skipped. wasAlreadyPaid:",
      wasAlreadyPaid,
      "| didMarkPaid:",
      didMarkPaid,
    );
  }
}

async function handleCheckoutSessionAsyncSucceeded(
  session: Stripe.Checkout.Session,
) {
  const paidAt = new Date().toISOString();

  const { orderId, wasAlreadyPaid } = await ensurePaymentRecordForSession(
    session,
    "paid",
    paidAt,
  );

  const didMarkPaid = await markOrderPaid(orderId, paidAt);

  if (!wasAlreadyPaid && didMarkPaid) {
    await sendSuccessfulPaymentReceipt(orderId, session);
    await syncToShipStationSafely(orderId);
  }
}

async function handleCheckoutSessionAsyncFailed(
  session: Stripe.Checkout.Session,
) {
  const { orderId } = await ensurePaymentRecordForSession(
    session,
    "failed",
    null,
  );

  await markOrderFailedIfNotPaid(orderId);
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  await ensurePaymentRecordForSession(session, "canceled", null);
  // Intentionally do not mark the order itself as canceled.
  // The order can still remain payable with a new Checkout Session later.
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
) {
  // Always look up the checkout session so the full handleCheckoutSessionCompleted
  // flow runs — including the receipt email. The previous fast path (skipping the
  // session lookup when order_id was in metadata) caused a race: it marked the order
  // and payment as paid before checkout.session.completed fired, which caused the
  // wasAlreadyPaid/didMarkPaid guards to block the email.
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  });

  const session = sessions.data[0] ?? null;

  if (!session) {
    console.warn(
      "[payments.handlePaymentIntentSucceeded] No checkout session found for payment intent:",
      paymentIntent.id,
    );
    return;
  }

  await handleCheckoutSessionCompleted(session);
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

    case "payment_intent.succeeded": {
      await handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
      );
      return;
    }

    default: {
      return;
    }
  }
}
