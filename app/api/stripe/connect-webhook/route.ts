import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleConnectAccountWebhookEvent } from "@/lib/stripe/connect/handle-account-webhook";

// Dedicated endpoint for Stripe Connect events (events fired FROM connected
// accounts, e.g. account.updated). Registered separately in the Stripe
// Dashboard with its own signing secret because Connect endpoints and
// platform-account endpoints each get their own secret.

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
  const admin = createAdminClient();

  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    object_id: getStripeEventObjectId(event),
  });

  if (!error) return true;
  if (error.code === "23505") return false; // duplicate event id — already processed

  console.error("[connect.webhook] Failed to reserve webhook event:", error);
  throw new Error(error.message || "Failed to reserve webhook event.");
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new NextResponse("Missing Stripe Connect webhook signature or secret.", {
      status: 400,
    });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[connect.webhook] Signature verification failed:", error);
    const message =
      error instanceof Error ? error.message : "Webhook signature verification failed.";
    return new NextResponse(message, { status: 400 });
  }

  try {
    const shouldProcess = await reserveWebhookEvent(event);
    if (!shouldProcess) {
      console.info(`[connect.webhook] Duplicate event skipped: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handleConnectAccountWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[connect.webhook] Handler error:", error);
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return new NextResponse(message, { status: 500 });
  }
}
