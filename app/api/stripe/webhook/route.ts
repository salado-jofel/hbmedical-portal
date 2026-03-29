import { handleStripeInvoiceWebhookEvent } from "@/lib/stripe/invoices/handle-stripe-invoice-webhook";
import { handleCheckoutWebhookEvent } from "@/lib/stripe/payments/handle-checkout-webhook";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripeEventObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as unknown;

  if (
    object &&
    typeof object === "object" &&
    "id" in object &&
    typeof (object as { id?: unknown }).id === "string"
  ) {
    return (object as { id: string }).id;
  }

  return null;
}

async function reserveWebhookEvent(event: Stripe.Event) {
  const admin = await createAdminClient();

  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    object_id: getStripeEventObjectId(event),
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return false;
  }

  console.error("[stripe.webhook] Failed to reserve webhook event:", error);
  throw new Error(error.message || "Failed to reserve webhook event.");
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new NextResponse("Missing Stripe webhook signature or secret.", {
      status: 400,
    });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook signature verification failed.";

    console.error("[stripe.webhook] Signature verification failed:", error);

    return new NextResponse(message, { status: 400 });
  }

  try {
    const shouldProcess = await reserveWebhookEvent(event);

    if (!shouldProcess) {
      console.info(`[stripe.webhook] Duplicate event skipped: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handleCheckoutWebhookEvent(event);
    await handleStripeInvoiceWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handler failed.";

    console.error("[stripe.webhook] Handler error:", error);

    return new NextResponse(message, { status: 500 });
  }
}
