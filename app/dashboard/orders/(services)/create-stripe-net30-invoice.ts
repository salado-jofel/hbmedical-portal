import type Stripe from "stripe";

import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { PersistedPaymentStatus } from "@/app/(interfaces)/payment";

type Net30OrderRow = {
  id: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  payment_mode: string | null;
  payment_provider: string | null;
  payment_status: PersistedPaymentStatus | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  receipt_email: string | null;
};

export type CreateStripeNet30InvoiceResult = {
  orderId: string;
  stripeCustomerId: string;
  stripeInvoiceId: string;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  stripeInvoiceStatus: string | null;
  dueDate: string | null;
  amountDueCents: number | null;
  amountRemainingCents: number | null;
  paymentStatus: PersistedPaymentStatus;
};

function toNullableString(value: string | null | undefined): string | null {
  return value ?? null;
}

function toIsoFromUnix(value: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  return new Date(value * 1000).toISOString();
}

function parseAmountToCents(value: number | string): number {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`Invalid Net30 invoice amount: ${value}`);
  }

  const amountCents = Math.round(numericValue * 100);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error(`Invalid Net30 invoice amount in cents: ${amountCents}`);
  }

  return amountCents;
}

function isInvoiceOverdue(invoice: Stripe.Invoice): boolean {
  if (invoice.status === "paid") return false;
  if (typeof invoice.due_date !== "number") return false;
  if ((invoice.amount_remaining ?? 0) <= 0) return false;
  return invoice.due_date * 1000 < Date.now();
}

function mapInvoiceStatusToPaymentStatus(
  invoice: Stripe.Invoice,
): PersistedPaymentStatus {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "uncollectible") return "payment_failed";
  if (invoice.status === "void") return "unpaid";
  if (isInvoiceOverdue(invoice)) return "overdue";
  return "invoice_sent";
}

async function getNet30Order(orderId: string): Promise<Net30OrderRow> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        order_id,
        facility_id,
        product_id,
        amount,
        quantity,
        payment_mode,
        payment_provider,
        payment_status,
        stripe_customer_id,
        stripe_invoice_id,
        receipt_email
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[createStripeNet30Invoice] Failed to load order ${orderId}: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `[createStripeNet30Invoice] Order ${orderId} was not found.`,
    );
  }

  return data as Net30OrderRow;
}

async function ensureStripeCustomerForOrder(
  order: Net30OrderRow,
): Promise<string> {
  const customerMetadata = {
    order_db_id: order.id,
    order_number: order.order_id,
    facility_id: order.facility_id,
    payment_mode: "net_30",
  };

  const customerEmail = order.receipt_email ?? undefined;

  if (order.stripe_customer_id) {
    try {
      const existingCustomer = await stripe.customers.retrieve(
        order.stripe_customer_id,
      );

      if (!("deleted" in existingCustomer) || !existingCustomer.deleted) {
        await stripe.customers.update(existingCustomer.id, {
          email: customerEmail,
          metadata: {
            ...existingCustomer.metadata,
            ...customerMetadata,
          },
        });

        return existingCustomer.id;
      }
    } catch (error) {
      console.warn(
        "[createStripeNet30Invoice] Existing Stripe customer lookup failed, creating a new customer instead:",
        error,
      );
    }
  }

  const createdCustomer = await stripe.customers.create({
    email: customerEmail,
    metadata: customerMetadata,
  });

  return createdCustomer.id;
}

async function persistStripeInvoiceOnOrder(
  orderId: string,
  stripeCustomerId: string,
  invoice: Stripe.Invoice,
  options?: {
    markInvoiceSentAt?: boolean;
    invoiceEmailSentAt?: string | null;
  },
): Promise<CreateStripeNet30InvoiceResult> {
  const supabaseAdmin = createAdminClient();

  const paymentStatus = mapInvoiceStatusToPaymentStatus(invoice);
  const invoicePaidAt = toIsoFromUnix(invoice.status_transitions?.paid_at);

  const updatePayload: Record<string, unknown> = {
    payment_provider: "stripe",
    payment_mode: "net_30",
    payment_status: paymentStatus,
    stripe_customer_id: stripeCustomerId,
    stripe_invoice_id: invoice.id,
    stripe_invoice_number: toNullableString(invoice.number),
    stripe_invoice_status: toNullableString(invoice.status),
    stripe_invoice_hosted_url: toNullableString(invoice.hosted_invoice_url),
    receipt_email: toNullableString(invoice.customer_email),
    invoice_due_date: toIsoFromUnix(invoice.due_date),
    invoice_amount_due:
      typeof invoice.amount_due === "number" ? invoice.amount_due : null,
    invoice_amount_remaining:
      typeof invoice.amount_remaining === "number"
        ? invoice.amount_remaining
        : null,
    invoice_email_error: null,
  };

  if (options?.markInvoiceSentAt) {
    updatePayload.invoice_sent_at = new Date().toISOString();
  }

  if (options?.invoiceEmailSentAt) {
    updatePayload.invoice_email_sent_at = options.invoiceEmailSentAt;
  }

  if (paymentStatus === "paid") {
    updatePayload.invoice_paid_at = invoicePaidAt ?? new Date().toISOString();
    updatePayload.paid_at = invoicePaidAt ?? new Date().toISOString();
    updatePayload.invoice_overdue_at = null;
  } else if (paymentStatus === "overdue") {
    updatePayload.invoice_overdue_at = new Date().toISOString();
  } else {
    updatePayload.invoice_paid_at = null;
    updatePayload.invoice_overdue_at = null;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select(
      `
        id,
        stripe_customer_id,
        stripe_invoice_id,
        stripe_invoice_number,
        stripe_invoice_hosted_url,
        stripe_invoice_status,
        invoice_due_date,
        invoice_amount_due,
        invoice_amount_remaining,
        payment_status
      `,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `[createStripeNet30Invoice] Failed to persist invoice on order ${orderId}: ${error.message}`,
    );
  }

  if (!updated) {
    throw new Error(
      `[createStripeNet30Invoice] No order row updated for ${orderId}.`,
    );
  }

  return {
    orderId: updated.id,
    stripeCustomerId:
      (updated as { stripe_customer_id?: string | null }).stripe_customer_id ??
      stripeCustomerId,
    stripeInvoiceId:
      (updated as { stripe_invoice_id?: string | null }).stripe_invoice_id ??
      invoice.id,
    invoiceNumber:
      (updated as { stripe_invoice_number?: string | null })
        .stripe_invoice_number ?? null,
    hostedInvoiceUrl:
      (updated as { stripe_invoice_hosted_url?: string | null })
        .stripe_invoice_hosted_url ?? null,
    stripeInvoiceStatus:
      (updated as { stripe_invoice_status?: string | null })
        .stripe_invoice_status ?? null,
    dueDate:
      (updated as { invoice_due_date?: string | null }).invoice_due_date ??
      null,
    amountDueCents:
      (updated as { invoice_amount_due?: number | null }).invoice_amount_due ??
      null,
    amountRemainingCents:
      (updated as { invoice_amount_remaining?: number | null })
        .invoice_amount_remaining ?? null,
    paymentStatus:
      ((updated as { payment_status?: PersistedPaymentStatus | null })
        .payment_status as PersistedPaymentStatus) ?? paymentStatus,
  };
}

export async function createStripeNet30Invoice(
  orderId: string,
): Promise<CreateStripeNet30InvoiceResult> {
  const order = await getNet30Order(orderId);

  if (order.payment_mode !== "net_30") {
    throw new Error(
      `[createStripeNet30Invoice] Order ${order.order_id} is not a net_30 order.`,
    );
  }

  const amountCents = parseAmountToCents(order.amount);
  const stripeCustomerId = await ensureStripeCustomerForOrder(order);

  // If an invoice already exists, retrieve and re-persist its latest state
  // instead of creating a duplicate invoice.
  if (order.stripe_invoice_id) {
    const existingInvoice = await stripe.invoices.retrieve(
      order.stripe_invoice_id,
    );
    return persistStripeInvoiceOnOrder(
      order.id,
      stripeCustomerId,
      existingInvoice,
    );
  }

  const stripeMetadata = {
    order_db_id: order.id,
    order_number: order.order_id,
    order_id: order.order_id, // backward compatibility for legacy webhook logic
    facility_id: order.facility_id,
    product_id: order.product_id,
    payment_mode: "net_30",
  };

  const draftInvoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: 30,
    auto_advance: false,
    metadata: stripeMetadata,
    description: `Net 30 invoice for order #${order.order_id}`,
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: draftInvoice.id,
    amount: amountCents,
    currency: "usd",
    description: `Net 30 invoice for order #${order.order_id}`,
    metadata: stripeMetadata,
  });

  let finalizedInvoice = await stripe.invoices.finalizeInvoice(
    draftInvoice.id,
    {
      auto_advance: true,
    },
  );

  let invoiceEmailSentAt: string | null = null;

  if (
    finalizedInvoice.status === "open" &&
    (finalizedInvoice.amount_due ?? 0) > 0
  ) {
    finalizedInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);
    invoiceEmailSentAt = new Date().toISOString();
  }

  return persistStripeInvoiceOnOrder(
    order.id,
    stripeCustomerId,
    finalizedInvoice,
    {
      markInvoiceSentAt: true,
      invoiceEmailSentAt,
    },
  );
}
