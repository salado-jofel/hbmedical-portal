import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderInvoiceStatus } from "@/utils/interfaces/orders";

function fromUnixTimestamp(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
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

function fallbackInvoiceNumber(
  orderNumber: string | null | undefined,
  invoiceId: string,
) {
  return orderNumber ? `INV-${orderNumber}` : invoiceId;
}

function getOrderIdFromInvoice(invoice: Stripe.Invoice) {
  return invoice.metadata?.order_id ?? null;
}

function mapInvoiceEventToLocalStatus(
  eventType: string,
  invoice: Stripe.Invoice,
): OrderInvoiceStatus {
  switch (eventType) {
    case "invoice.finalized":
      return "issued";
    case "invoice.sent":
      return "sent";
    case "invoice.paid":
      return "paid";
    case "invoice.overdue":
      return "overdue";
    case "invoice.voided":
      return "void";
    default: {
      if (invoice.status === "draft") return "draft";
      if (invoice.status === "paid") return "paid";
      if (invoice.status === "void") return "void";
      return "issued";
    }
  }
}

async function upsertLocalInvoiceFromStripe(
  invoice: Stripe.Invoice,
  localStatus: OrderInvoiceStatus,
) {
  const orderId = getOrderIdFromInvoice(invoice);
  if (!orderId) return null;

  const admin = await createAdminClient();

  const { error } = await admin.from("invoices").upsert(
    {
      order_id: orderId,
      invoice_number: fallbackInvoiceNumber(
        invoice.metadata?.order_number,
        invoice.id,
      ),
      provider: "stripe",
      provider_invoice_id: invoice.id,
      status: localStatus,
      amount_due: toMajorAmount(invoice.amount_due),
      amount_paid: toMajorAmount(invoice.amount_paid),
      currency: normalizeCurrency(invoice.currency),
      due_at: fromUnixTimestamp(invoice.due_date),
      issued_at: fromUnixTimestamp(invoice.status_transitions?.finalized_at),
      paid_at: fromUnixTimestamp(invoice.status_transitions?.paid_at),
      hosted_invoice_url: invoice.hosted_invoice_url,
    },
    { onConflict: "order_id" },
  );

  if (error) {
    console.error("[invoices.upsertLocalInvoiceFromStripe] Error:", error);
    throw new Error(error.message || "Failed to upsert local invoice.");
  }

  return orderId;
}

async function updateOrderFromInvoiceState(
  orderId: string,
  localStatus: OrderInvoiceStatus,
  eventType: string,
  invoice: Stripe.Invoice,
) {
  const admin = await createAdminClient();

  const payload: Record<string, string | null> = {
    order_status: "submitted",
    payment_method: "net_30",
    invoice_status: localStatus,
  };

  if (eventType === "invoice.paid") {
    payload.payment_status = "paid";
    payload.paid_at =
      fromUnixTimestamp(invoice.status_transitions?.paid_at) ??
      new Date().toISOString();
  } else if (eventType === "invoice.payment_failed") {
    payload.payment_status = "failed";
  } else if (eventType === "invoice.voided") {
    payload.payment_status = "canceled";
    payload.paid_at = null;
  } else {
    payload.payment_status = "pending";
  }

  const { error } = await admin
    .from("orders")
    .update(payload)
    .eq("id", orderId);

  if (error) {
    console.error("[invoices.updateOrderFromInvoiceState] Error:", error);
    throw new Error(
      error.message || "Failed to sync order from invoice event.",
    );
  }
}

async function handleInvoiceLifecycleEvent(
  eventType: string,
  invoice: Stripe.Invoice,
) {
  const localStatus = mapInvoiceEventToLocalStatus(eventType, invoice);
  const orderId = await upsertLocalInvoiceFromStripe(invoice, localStatus);

  if (!orderId) {
    return;
  }

  await updateOrderFromInvoiceState(orderId, localStatus, eventType, invoice);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const orderId = getOrderIdFromInvoice(invoice);
  if (!orderId) return;

  const admin = await createAdminClient();

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "failed",
    })
    .eq("id", orderId);

  if (error) {
    console.error("[invoices.handleInvoicePaymentFailed] Error:", error);
    throw new Error(
      error.message || "Failed to mark invoice payment as failed.",
    );
  }
}

export async function handleStripeInvoiceWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "invoice.finalized":
    case "invoice.sent":
    case "invoice.paid":
    case "invoice.overdue":
    case "invoice.voided": {
      await handleInvoiceLifecycleEvent(
        event.type,
        event.data.object as Stripe.Invoice,
      );
      return;
    }

    case "invoice.payment_failed": {
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      return;
    }

    default: {
      return;
    }
  }
}
