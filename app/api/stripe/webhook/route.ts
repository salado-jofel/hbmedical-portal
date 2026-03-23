import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toIsoDateFromUnix(value: unknown): string | null {
  if (typeof value !== "number") return null;
  return new Date(value * 1000).toISOString();
}

/**
 * Keep payment_status simple for now to avoid DB constraint issues:
 * - paid => paid
 * - everything else => invoice_sent
 *
 * Detailed Stripe status still goes into stripe_invoice_status.
 */
function mapInvoiceToPaymentStatus(invoice: Stripe.Invoice): string {
  return invoice.status === "paid" ? "paid" : "invoice_sent";
}

async function registerStripeEvent(params: {
  eventId: string;
  eventType: string;
  stripeObjectId: string | null;
  orderId: string | null;
  checkoutSessionId?: string | null;
}): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: params.eventId,
    event_type: params.eventType,
    stripe_object_id: params.stripeObjectId,
    order_id: params.orderId,
    checkout_session_id: params.checkoutSessionId ?? null,
  });

  if (!error) return true;

  const pgCode = (error as { code?: string } | null)?.code;

  if (pgCode === "23505") {
    return false;
  }

  throw new Error(`Failed to register Stripe event: ${error.message}`);
}

async function resolveOrderIdFromInvoice(
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const metadataOrderId = toNullableString(invoice.metadata?.order_id);
  if (metadataOrderId) return metadataOrderId;

  const invoiceId = toNullableString(invoice.id);
  if (!invoiceId) return null;

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_invoice_id", invoiceId)
    .maybeSingle();

  return toNullableString(data?.id);
}

async function syncStripeInvoiceToOrder(
  invoice: Stripe.Invoice,
  options?: {
    markSentAt?: boolean;
    markPaidAt?: boolean;
  },
): Promise<{ orderId: string | null; invoiceId: string | null }> {
  const supabase = createAdminClient();

  const orderId = await resolveOrderIdFromInvoice(invoice);
  const invoiceId = toNullableString(invoice.id);

  if (!orderId && !invoiceId) {
    return { orderId: null, invoiceId };
  }

  const amountDueCents = toNullableNumber(invoice.amount_due);
  const amountRemainingCents = toNullableNumber(invoice.amount_remaining);

  const payload: Record<string, unknown> = {
    payment_mode: "net_30",
    payment_status: mapInvoiceToPaymentStatus(invoice),
    stripe_invoice_id: invoiceId,
    stripe_invoice_number: toNullableString(invoice.number),
    stripe_invoice_status: toNullableString(invoice.status),
    stripe_invoice_hosted_url: toNullableString(invoice.hosted_invoice_url),
    invoice_due_date: toIsoDateFromUnix(invoice.due_date),
    invoice_amount_due: amountDueCents !== null ? amountDueCents / 100 : null,
    invoice_amount_remaining:
      amountRemainingCents !== null ? amountRemainingCents / 100 : null,
  };

  if (options?.markSentAt) {
    payload.invoice_sent_at = new Date().toISOString();
  }

  if (options?.markPaidAt || invoice.status === "paid") {
    payload.payment_status = "paid";
    payload.invoice_paid_at = new Date().toISOString();
    if (amountRemainingCents === 0) {
      payload.invoice_amount_remaining = 0;
    }
  }

  if (orderId) {
    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", orderId);

    if (error) {
      throw new Error(`Failed to update order by id: ${error.message}`);
    }

    return { orderId, invoiceId };
  }

  if (invoiceId) {
    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("stripe_invoice_id", invoiceId);

    if (error) {
      throw new Error(
        `Failed to update order by stripe_invoice_id: ${error.message}`,
      );
    }
  }

  return { orderId: null, invoiceId };
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  await syncStripeInvoiceToOrder(invoice, {
    markSentAt: true,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  await syncStripeInvoiceToOrder(invoice, {
    markPaidAt: true,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Keep payment_status as invoice_sent for now, and rely on stripe_invoice_status
  // for the richer detail in Phase 2A.
  await syncStripeInvoiceToOrder(invoice);
}

async function handleInvoiceUpdated(invoice: Stripe.Invoice) {
  await syncStripeInvoiceToOrder(invoice);
}

/**
 * Keep this if you want a minimal pay-now sync here.
 * If your current route already has richer checkout.session.completed logic
 * (receipt email, lock, fulfillment, etc.), keep your existing version instead.
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const supabase = createAdminClient();

  const orderId = toNullableString(session.metadata?.order_id);
  if (!orderId) return;

  const payload: Record<string, unknown> = {
    payment_mode: "pay_now",
    payment_status: session.payment_status === "paid" ? "paid" : "unpaid",
  };

  if (session.payment_status === "paid") {
    payload.invoice_paid_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId);

  if (error) {
    throw new Error(`Failed to update pay-now order: ${error.message}`);
  }
}

async function handleCheckoutSessionAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session,
) {
  const supabase = createAdminClient();

  const orderId = toNullableString(session.metadata?.order_id);
  if (!orderId) return;

  const { error } = await supabase
    .from("orders")
    .update({
      payment_mode: "pay_now",
      payment_status: "paid",
      invoice_paid_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(
      `Failed to update async pay-now order as paid: ${error.message}`,
    );
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const eventObject = event.data.object as {
    id?: unknown;
    metadata?: Record<string, unknown>;
  };
  const stripeObjectId = toNullableString(eventObject?.id);
  const orderIdFromMetadata = toNullableString(eventObject?.metadata?.order_id);

  const shouldProcess = await registerStripeEvent({
    eventId: event.id,
    eventType: event.type,
    stripeObjectId,
    orderId: orderIdFromMetadata,
    checkoutSessionId: event.type.startsWith("checkout.session.")
      ? stripeObjectId
      : null,
  });

  if (!shouldProcess) {
    return NextResponse.json({
      received: true,
      duplicate: true,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSessionAsyncPaymentSucceeded(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "invoice.finalized":
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "invoice.updated":
        await handleInvoiceUpdated(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handler failed";

    console.error("Stripe webhook error:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
