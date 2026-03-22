import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncPaidOrderToShipStation } from "@/lib/actions/shipstation";

const ORDERS_PATH = "/dashboard/orders";

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return { orderId: null, shouldSyncShipStation: false };

  const supabaseAdmin = createAdminClient();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, payment_status, shipstation_sync_status, shipstation_shipment_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !existing) {
    console.error("[stripe webhook] Order lookup failed:", fetchError?.message);
    return { orderId: null, shouldSyncShipStation: false };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const alreadyPaid = existing.payment_status === "paid";
  const alreadySynced =
    existing.shipstation_sync_status === "sent" ||
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
        shipstation_sync_status: alreadySynced ? "sent" : "ready",
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(
        "[stripe webhook] Failed to mark order paid:",
        updateError.message,
      );
      throw new Error(updateError.message);
    }
  }

  revalidatePath(ORDERS_PATH);

  return {
    orderId,
    shouldSyncShipStation: !alreadySynced,
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

  revalidatePath(ORDERS_PATH);
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

        const { orderId, shouldSyncShipStation } = await markOrderPaid(session);

        if (orderId && shouldSyncShipStation) {
          try {
            await syncPaidOrderToShipStation(orderId);
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
              .eq("id", orderId);

            revalidatePath(ORDERS_PATH);
            throw shipstationError;
          }
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderFailedOrCanceled(session, "failed");
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderFailedOrCanceled(session, "canceled");
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
