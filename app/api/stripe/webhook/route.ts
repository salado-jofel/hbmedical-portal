import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";

async function findOrderForSession(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
) {
  // 1) Best match: stored Stripe Checkout Session ID
  let { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_id, payment_status")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (error) {
    console.error(
      "[stripe webhook] Lookup by session.id failed:",
      error.message,
    );
  }

  if (order) return order;

  // 2) Next best: client_reference_id (you set this to order.id in one good version)
  const clientReferenceId =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null;

  if (clientReferenceId) {
    ({ data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, payment_status")
      .eq("id", clientReferenceId)
      .maybeSingle());

    if (error) {
      console.error(
        "[stripe webhook] Lookup by client_reference_id failed:",
        error.message,
      );
    }

    if (order) return order;
  }

  // 3) Metadata fallbacks
  const metadataOrderId = session.metadata?.order_id ?? null;
  const metadataOrderDocNumber = session.metadata?.order_doc_number ?? null;

  if (metadataOrderId) {
    // try UUID column first
    ({ data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, payment_status")
      .eq("id", metadataOrderId)
      .maybeSingle());

    if (order) return order;

    // then try human-readable order number column
    ({ data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, payment_status")
      .eq("order_id", metadataOrderId)
      .maybeSingle());

    if (order) return order;
  }

  if (metadataOrderDocNumber) {
    ({ data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_id, payment_status")
      .eq("order_id", metadataOrderDocNumber)
      .maybeSingle());

    if (order) return order;
  }

  console.error("[stripe webhook] No matching order found", {
    sessionId: session.id,
    clientReferenceId,
    metadata: session.metadata,
  });

  return null;
}

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const supabaseAdmin = createAdminClient();

  const order = await findOrderForSession(supabaseAdmin, session);
  if (!order) return;

  if (order.payment_status === "paid") {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(
      "[stripe webhook] Failed to mark order paid:",
      updateError.message,
    );
  }
}

async function markOrderFailedOrCanceled(
  session: Stripe.Checkout.Session,
  status: "failed" | "canceled",
) {
  const supabaseAdmin = createAdminClient();

  const order = await findOrderForSession(supabaseAdmin, session);
  if (!order) return;

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: status,
      stripe_checkout_session_id: session.id,
    })
    .eq("id", order.id);

  if (error) {
    console.error(
      `[stripe webhook] Failed to mark order ${status}:`,
      error.message,
    );
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
    console.error("[stripe webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderPaid(session);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderPaid(session);
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
