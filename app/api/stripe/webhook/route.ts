import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncPaidOrderToShipStation } from "@/lib/actions/shipstation";
import { sendPaymentReceiptEmail } from "@/utils/emails/send-payment-receipt";

export const runtime = "nodejs";

type MarkOrderPaidResult = {
  orderId: string | null;
  orderNumber: string | null;
  shouldSyncShipStation: boolean;
  receiptEmail: string | null;
  receiptUrl: string | null;
  amountTotal: number | null;
  currency: string | null;
};

async function registerStripeEvent(
  event: Stripe.Event,
  session?: Stripe.Checkout.Session,
) {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    checkout_session_id: session?.id ?? null,
    order_id: session?.metadata?.order_id ?? null,
  });

  if (!error) {
    return true;
  }

  // Postgres unique violation => already processed
  if (error.code === "23505") {
    console.log("[stripe webhook] Duplicate event ignored:", event.id);
    return false;
  }

  throw new Error(error.message);
}

async function getReceiptDetails(session: Stripe.Checkout.Session) {
  const receiptEmail =
    session.customer_details?.email ??
    session.customer_email ??
    session.metadata?.user_email ??
    null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  let receiptUrl: string | null = null;

  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const latestCharge =
      typeof paymentIntent.latest_charge === "string"
        ? null
        : paymentIntent.latest_charge;

    receiptUrl = latestCharge?.receipt_url ?? null;
  }

  return {
    receiptEmail,
    receiptUrl,
    paymentIntentId,
    customerId,
  };
}

async function markOrderPaid(
  session: Stripe.Checkout.Session,
): Promise<MarkOrderPaidResult> {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    return {
      orderId: null,
      orderNumber: null,
      shouldSyncShipStation: false,
      receiptEmail: null,
      receiptUrl: null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    };
  }

  const supabaseAdmin = createAdminClient();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        order_id,
        payment_status,
        shipstation_sync_status,
        shipstation_shipment_id,
        receipt_email
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !existing) {
    console.error("[stripe webhook] Order lookup failed:", fetchError?.message);
    return {
      orderId: null,
      orderNumber: null,
      shouldSyncShipStation: false,
      receiptEmail: null,
      receiptUrl: null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    };
  }

  const { receiptEmail, receiptUrl, paymentIntentId, customerId } =
    await getReceiptDetails(session);

  const finalReceiptEmail =
    receiptEmail ??
    existing.receipt_email ??
    session.metadata?.user_email ??
    null;

  const alreadyPaid = existing.payment_status === "paid";

  const alreadySynced =
    existing.shipstation_sync_status === "sent" ||
    existing.shipstation_sync_status === "fulfilled" ||
    !!existing.shipstation_shipment_id;

  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: customerId,
    receipt_email: finalReceiptEmail,
    stripe_receipt_url: receiptUrl,
  };

  if (!alreadyPaid) {
    updatePayload.paid_at = new Date().toISOString();
    updatePayload.shipstation_sync_status = "ready";
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateError) {
    console.error(
      "[stripe webhook] Failed to update paid order:",
      updateError.message,
    );
    throw new Error(updateError.message);
  }

  return {
    orderId,
    orderNumber: existing.order_id ?? orderId,
    shouldSyncShipStation: !alreadySynced,
    receiptEmail: finalReceiptEmail,
    receiptUrl,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
}

async function markOrderFailedOrCanceled(
  session: Stripe.Checkout.Session,
  status: "failed" | "canceled",
) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: status,
      stripe_checkout_session_id: session.id,
    })
    .eq("id", orderId);

  if (error) {
    console.error(
      `[stripe webhook] Failed to mark order ${status}:`,
      error.message,
    );
  }
}

async function claimReceiptEmailLock(orderId: string) {
  const supabaseAdmin = createAdminClient();
  const lockId = crypto.randomUUID();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      receipt_email_lock_id: lockId,
    })
    .eq("id", orderId)
    .is("receipt_email_sent_at", null)
    .is("receipt_email_lock_id", null)
    .select("id, receipt_email_lock_id")
    .maybeSingle();

  if (error) {
    console.error(
      "[stripe webhook] Failed to claim receipt email lock:",
      error.message,
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return lockId;
}

async function maybeSendReceiptEmail(result: MarkOrderPaidResult) {
  if (!result.orderId || !result.receiptEmail) {
    return;
  }

  const supabaseAdmin = createAdminClient();
  const lockId = await claimReceiptEmailLock(result.orderId);

  // Another request already sent it or is currently sending it.
  if (!lockId) {
    console.log(
      "[stripe webhook] Receipt email skipped; already locked or sent:",
      result.orderId,
    );
    return;
  }

  try {
    const resendResult = await sendPaymentReceiptEmail({
      to: result.receiptEmail,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      amountTotal: result.amountTotal,
      currency: result.currency,
      receiptUrl: result.receiptUrl,
    });

    console.log("[stripe webhook] Receipt email sent:", {
      orderId: result.orderId,
      resendId: resendResult?.data?.id ?? null,
    });

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_sent_at: new Date().toISOString(),
        receipt_email_error: null,
        receipt_email_lock_id: null,
      })
      .eq("id", result.orderId)
      .eq("receipt_email_lock_id", lockId);

    if (error) {
      console.error(
        "[stripe webhook] Failed to save receipt_email_sent_at:",
        error.message,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email error";

    console.error("[stripe webhook] Failed to send receipt email:", message);

    const { error: dbError } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_error: message,
        receipt_email_lock_id: null,
      })
      .eq("id", result.orderId)
      .eq("receipt_email_lock_id", lockId);

    if (dbError) {
      console.error(
        "[stripe webhook] Failed to save receipt email error:",
        dbError.message,
      );
    }

    // Do not throw. Payment already succeeded.
  }
}

async function handleSuccessfulCheckoutSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const isNewEvent = await registerStripeEvent(event, session);

  if (!isNewEvent) {
    return;
  }

  const result = await markOrderPaid(session);

  await maybeSendReceiptEmail(result);

  if (result.orderId && result.shouldSyncShipStation) {
    try {
      await syncPaidOrderToShipStation(result.orderId);
    } catch (shipstationError) {
      console.error(
        "[stripe webhook] ShipStation sync failed:",
        shipstationError,
      );

      const supabaseAdmin = createAdminClient();

      await supabaseAdmin
        .from("orders")
        .update({
          shipstation_sync_status: "failed",
        })
        .eq("id", result.orderId);

      // Do not throw here, otherwise Stripe may retry the webhook.
    }
  }

  revalidatePath("/dashboard/orders");
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration." },
      { status: 400 },
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("[stripe webhook] received", {
    eventId: event.id,
    eventType: event.type,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only fulfill immediately if the Checkout Session is actually paid.
        if (session.payment_status === "paid") {
          await handleSuccessfulCheckoutSession(event, session);
        }

        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulCheckoutSession(event, session);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderFailedOrCanceled(session, "failed");
        revalidatePath("/dashboard/orders");
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderFailedOrCanceled(session, "canceled");
        revalidatePath("/dashboard/orders");
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook processing failed.";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
