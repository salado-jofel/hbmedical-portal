import { handleStripeInvoiceWebhookEvent } from "@/lib/stripe/invoices/handle-stripe-invoice-webhook";
import { handleCheckoutWebhookEvent } from "@/lib/stripe/payments/handle-checkout-webhook";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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
