import "server-only";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderInvoiceStatus } from "@/utils/interfaces/orders";
import { sendNet30InvoiceCreatedEmail } from "@/lib/emails/send-net30-invoice-created";
import { sendNet30ReceiptEmail } from "@/lib/emails/send-net30-receipt";
import { sendNet30ReminderEmail } from "@/lib/emails/send-net30-reminder";

type FacilityRelation = {
  name?: string | null;
  user_id?: string | null;
};

type OrderEmailContext = {
  to: string | null;
  orderId: string;
  orderNumber: string | null;
  facilityName: string | null;
  productName: string | null;
};

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

function getInvoiceNumber(invoice: Stripe.Invoice) {
  return (
    invoice.number ??
    fallbackInvoiceNumber(invoice.metadata?.order_number, invoice.id)
  );
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getOverdueDays(invoice: Stripe.Invoice) {
  if (!invoice.due_date) {
    return null;
  }

  const dueAtMs = invoice.due_date * 1000;
  const nowMs = Date.now();
  const diffMs = nowMs - dueAtMs;

  if (diffMs <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(diffMs / 86_400_000));
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

    case "invoice.will_be_due": {
      if (invoice.status === "paid") return "paid";
      if (invoice.status === "void") return "void";
      return "sent";
    }

    case "invoice.overdue":
      return "overdue";

    case "invoice.voided":
      return "void";

    case "invoice.payment_failed": {
      if (invoice.status === "paid") return "paid";
      if (invoice.status === "void") return "void";
      if (invoice.due_date && invoice.status === "open") return "overdue";
      return "sent";
    }

    default: {
      if (invoice.status === "draft") return "draft";
      if (invoice.status === "paid") return "paid";
      if (invoice.status === "void") return "void";
      if (invoice.due_date && invoice.status === "open") return "overdue";
      if (invoice.status === "open") return "issued";
      return "issued";
    }
  }
}

async function upsertLocalInvoiceFromStripe(
  invoice: Stripe.Invoice,
  localStatus: OrderInvoiceStatus,
) {
  const orderId = getOrderIdFromInvoice(invoice);

  if (!orderId) {
    return null;
  }

  const admin = await createAdminClient();

  const { error } = await admin.from("invoices").upsert(
    {
      order_id: orderId,
      invoice_number: getInvoiceNumber(invoice),
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

function buildOrderUpdatePayload(
  eventType: string,
  localStatus: OrderInvoiceStatus,
  invoice: Stripe.Invoice,
) {
  const payload: Record<string, string | null> = {
    order_status: "submitted",
    payment_method: "net_30",
    invoice_status: localStatus,
  };

  switch (eventType) {
    case "invoice.paid": {
      payload.payment_status = "paid";
      payload.paid_at =
        fromUnixTimestamp(invoice.status_transitions?.paid_at) ??
        new Date().toISOString();
      break;
    }

    case "invoice.voided": {
      payload.payment_status = "canceled";
      payload.paid_at = null;
      break;
    }

    case "invoice.payment_failed": {
      payload.payment_status = "failed";
      break;
    }

    case "invoice.overdue":
    case "invoice.will_be_due":
    case "invoice.finalized":
    case "invoice.sent":
    default: {
      payload.payment_status = "pending";
      break;
    }
  }

  return payload;
}

async function updateOrderFromInvoiceState(
  orderId: string,
  localStatus: OrderInvoiceStatus,
  eventType: string,
  invoice: Stripe.Invoice,
) {
  const admin = await createAdminClient();
  const payload = buildOrderUpdatePayload(eventType, localStatus, invoice);

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

async function syncInvoiceAndOrder(eventType: string, invoice: Stripe.Invoice) {
  const localStatus = mapInvoiceEventToLocalStatus(eventType, invoice);
  const orderId = await upsertLocalInvoiceFromStripe(invoice, localStatus);

  if (!orderId) {
    return null;
  }

  await updateOrderFromInvoiceState(orderId, localStatus, eventType, invoice);

  return orderId;
}

async function getOrderEmailContext(
  invoice: Stripe.Invoice,
): Promise<OrderEmailContext | null> {
  const orderId = getOrderIdFromInvoice(invoice);

  if (!orderId) {
    return null;
  }

  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
        id,
        order_number,
        product_name,
        facility_id,
        facilities (
          name,
          user_id
        )
      `,
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.error("[invoices.getOrderEmailContext] Order lookup error:", error);
    throw new Error(error?.message || "Failed to load order email context.");
  }

  const order = data as {
    id: string;
    order_number?: string | null;
    product_name?: string | null;
    facilities?: FacilityRelation | FacilityRelation[] | null;
  };

  const facility = getSingleRelation(order.facilities);
  let to = invoice.customer_email ?? null;

  if (!to && facility?.user_id) {
    const { data: userResult, error: userError } =
      await admin.auth.admin.getUserById(facility.user_id);

    if (userError) {
      console.error(
        "[invoices.getOrderEmailContext] User lookup error:",
        userError,
      );
    } else {
      to = userResult.user?.email ?? null;
    }
  }

  return {
    to,
    orderId: order.id,
    orderNumber: order.order_number ?? invoice.metadata?.order_number ?? null,
    facilityName: facility?.name ?? null,
    productName: order.product_name ?? null,
  };
}

async function getReceiptUrlFromInvoice(invoice: Stripe.Invoice) {
  const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
    expand: ["payments.data.payment.payment_intent.latest_charge"],
  });

  const invoicePayments = expandedInvoice.payments?.data ?? [];

  const paidInvoicePayment = invoicePayments.find(
    (entry) =>
      entry.status === "paid" && entry.payment?.type === "payment_intent",
  );

  if (
    !paidInvoicePayment ||
    paidInvoicePayment.payment.type !== "payment_intent"
  ) {
    return null;
  }

  const paymentIntent = paidInvoicePayment.payment.payment_intent;

  if (!paymentIntent || typeof paymentIntent === "string") {
    return null;
  }

  const latestCharge = paymentIntent.latest_charge;

  if (!latestCharge || typeof latestCharge === "string") {
    return null;
  }

  return latestCharge.receipt_url ?? null;
}

async function runEmailHookSafely(
  label: string,
  callback: () => Promise<void>,
) {
  try {
    await callback();
  } catch (error) {
    console.error(`[invoices.${label}] Email hook failed:`, error);
  }
}

async function sendInvoiceFinalizedEmail(invoice: Stripe.Invoice) {
  const context = await getOrderEmailContext(invoice);

  if (!context?.to) {
    console.warn(
      "[invoices.sendInvoiceFinalizedEmail] Missing recipient email for invoice:",
      invoice.id,
    );
    return;
  }

  await sendNet30InvoiceCreatedEmail({
    to: context.to,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    facilityName: context.facilityName,
    productName: context.productName,
    amountDue: toMajorAmount(invoice.amount_due),
    currency: invoice.currency,
    dueDate: fromUnixTimestamp(invoice.due_date),
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoiceNumber: getInvoiceNumber(invoice),
  });
}

async function sendInvoicePaidEmail(invoice: Stripe.Invoice) {
  const context = await getOrderEmailContext(invoice);

  if (!context?.to) {
    console.warn(
      "[invoices.sendInvoicePaidEmail] Missing recipient email for invoice:",
      invoice.id,
    );
    return;
  }

  const receiptUrl = await getReceiptUrlFromInvoice(invoice);

  await sendNet30ReceiptEmail({
    to: context.to,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    facilityName: context.facilityName,
    productName: context.productName,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    paidAt:
      fromUnixTimestamp(invoice.status_transitions?.paid_at) ??
      new Date().toISOString(),
    receiptUrl,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoiceNumber: getInvoiceNumber(invoice),
  });
}

async function sendInvoiceWillBeDueEmail(invoice: Stripe.Invoice) {
  const context = await getOrderEmailContext(invoice);

  if (!context?.to) {
    console.warn(
      "[invoices.sendInvoiceWillBeDueEmail] Missing recipient email for invoice:",
      invoice.id,
    );
    return;
  }

  const dueDateIso = fromUnixTimestamp(invoice.due_date);
  const dueDateMs = dueDateIso ? new Date(dueDateIso).getTime() : null;
  const nowMs = Date.now();
  const diffDays =
    dueDateMs != null ? Math.ceil((dueDateMs - nowMs) / 86_400_000) : null;

  const reminderStage =
    diffDays === 1 ? "tomorrow" : diffDays === 0 ? "due_today" : "upcoming";

  await sendNet30ReminderEmail({
    to: context.to,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    facilityName: context.facilityName,
    productName: context.productName,
    amountRemaining:
      typeof invoice.amount_remaining === "number"
        ? invoice.amount_remaining
        : invoice.amount_due,
    currency: invoice.currency,
    dueDate: dueDateIso,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoiceNumber: getInvoiceNumber(invoice),
    reminderStage,
  });
}

async function sendInvoiceOverdueEmail(invoice: Stripe.Invoice) {
  const context = await getOrderEmailContext(invoice);

  if (!context?.to) {
    console.warn(
      "[invoices.sendInvoiceOverdueEmail] Missing recipient email for invoice:",
      invoice.id,
    );
    return;
  }

  await sendNet30ReminderEmail({
    to: context.to,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    facilityName: context.facilityName,
    productName: context.productName,
    amountRemaining:
      typeof invoice.amount_remaining === "number"
        ? invoice.amount_remaining
        : invoice.amount_due,
    currency: invoice.currency,
    dueDate: fromUnixTimestamp(invoice.due_date),
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoiceNumber: getInvoiceNumber(invoice),
    reminderStage: "overdue",
    overdueDays: getOverdueDays(invoice),
  });
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  const orderId = await syncInvoiceAndOrder("invoice.finalized", invoice);

  if (!orderId) {
    return;
  }

  await runEmailHookSafely("handleInvoiceFinalized", async () => {
    await sendInvoiceFinalizedEmail(invoice);
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const orderId = await syncInvoiceAndOrder("invoice.paid", invoice);

  if (!orderId) {
    return;
  }

  await runEmailHookSafely("handleInvoicePaid", async () => {
    await sendInvoicePaidEmail(invoice);
  });
}

async function handleInvoiceWillBeDue(invoice: Stripe.Invoice) {
  const orderId = await syncInvoiceAndOrder("invoice.will_be_due", invoice);

  if (!orderId) {
    return;
  }

  await runEmailHookSafely("handleInvoiceWillBeDue", async () => {
    await sendInvoiceWillBeDueEmail(invoice);
  });
}

async function handleInvoiceOverdue(invoice: Stripe.Invoice) {
  const orderId = await syncInvoiceAndOrder("invoice.overdue", invoice);

  if (!orderId) {
    return;
  }

  await runEmailHookSafely("handleInvoiceOverdue", async () => {
    await sendInvoiceOverdueEmail(invoice);
  });
}

async function handleInvoiceSent(invoice: Stripe.Invoice) {
  await syncInvoiceAndOrder("invoice.sent", invoice);
}

async function handleInvoiceVoided(invoice: Stripe.Invoice) {
  await syncInvoiceAndOrder("invoice.voided", invoice);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  await syncInvoiceAndOrder("invoice.payment_failed", invoice);
}

export async function handleStripeInvoiceWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "invoice.finalized": {
      await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
      return;
    }

    case "invoice.paid": {
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      return;
    }

    case "invoice.will_be_due": {
      await handleInvoiceWillBeDue(event.data.object as Stripe.Invoice);
      return;
    }

    case "invoice.overdue": {
      await handleInvoiceOverdue(event.data.object as Stripe.Invoice);
      return;
    }

    case "invoice.sent": {
      await handleInvoiceSent(event.data.object as Stripe.Invoice);
      return;
    }

    case "invoice.voided": {
      await handleInvoiceVoided(event.data.object as Stripe.Invoice);
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
