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
  shouldSendReceiptEmail: boolean;
  receiptEmail: string | null;
  receiptUrl: string | null;
  amountTotal: number | null;
  currency: string | null;
};

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
      shouldSendReceiptEmail: false,
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
      "id, order_id, payment_status, shipstation_sync_status, shipstation_shipment_id, receipt_email, receipt_email_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !existing) {
    console.error("[stripe webhook] Order lookup failed:", fetchError?.message);
    return {
      orderId: null,
      orderNumber: null,
      shouldSyncShipStation: false,
      shouldSendReceiptEmail: false,
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

  if (!alreadyPaid) {
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
        paid_at: new Date().toISOString(),
        shipstation_sync_status: "ready",
        receipt_email: finalReceiptEmail,
        stripe_receipt_url: receiptUrl,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(
        "[stripe webhook] Failed to mark order paid:",
        updateError.message,
      );
      throw new Error(updateError.message);
    }
  } else {
    const { error: refreshError } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email: finalReceiptEmail,
        stripe_receipt_url: receiptUrl,
      })
      .eq("id", orderId);

    if (refreshError) {
      console.error(
        "[stripe webhook] Failed to refresh receipt fields:",
        refreshError.message,
      );
    }
  }

  return {
    orderId,
    orderNumber: existing.order_id ?? orderId,
    shouldSyncShipStation: !alreadySynced,
    shouldSendReceiptEmail:
      !existing.receipt_email_sent_at && !!finalReceiptEmail,
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

async function maybeSendReceiptEmail(result: MarkOrderPaidResult) {
  if (
    !result.orderId ||
    !result.shouldSendReceiptEmail ||
    !result.receiptEmail
  ) {
    return;
  }

  const supabaseAdmin = createAdminClient();

  try {
    await sendPaymentReceiptEmail({
      to: result.receiptEmail,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      amountTotal: result.amountTotal,
      currency: result.currency,
      receiptUrl: result.receiptUrl,
    });

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_sent_at: new Date().toISOString(),
        receipt_email_error: null,
      })
      .eq("id", result.orderId);

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
      })
      .eq("id", result.orderId);

    if (dbError) {
      console.error(
        "[stripe webhook] Failed to save receipt email error:",
        dbError.message,
      );
    }

    // Don't throw here.
    // Payment already succeeded, and throwing would cause webhook retries.
  }
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        const result = await markOrderPaid(session);

        await maybeSendReceiptEmail(result);

        if (result.orderId && result.shouldSyncShipStation) {
          try {
            await syncPaidOrderToShipStation(result.orderId);
          } catch (shipstationError) {
            console.error(
              "[stripe webhook] ShipStation mock sync failed:",
              shipstationError,
            );

            const supabaseAdmin = createAdminClient();
            await supabaseAdmin
              .from("orders")
              .update({
                shipstation_sync_status: "failed",
              })
              .eq("id", result.orderId);

            throw shipstationError;
          }
        }

        revalidatePath("/dashboard/orders");
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
