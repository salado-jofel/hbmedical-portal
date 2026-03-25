"use server";

import "server-only";
import type Stripe from "stripe";

import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { PersistedPaymentStatus } from "@/lib/interfaces/payment";
import { sendNet30InvoiceCreatedEmail } from "@/utils/emails/send-net30-invoice-created";

type Net30OrderRow = {
  id: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  user_id: string | null;
  payment_mode: string | null;
  payment_provider: string | null;
  payment_status: PersistedPaymentStatus | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  receipt_email: string | null;
  invoice_email_sent_at: string | null;
};

type OrderUserProfile = {
  email: string | null;
  fullName: string | null;
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
    throw new Error(`Invalid Net 30 invoice amount: ${value}`);
  }

  const amountCents = Math.round(numericValue * 100);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error(`Invalid Net 30 invoice amount in cents: ${amountCents}`);
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

function shouldSendInvoiceCreatedEmail(invoice: Stripe.Invoice): boolean {
  if (invoice.status !== "open") return false;
  if ((invoice.amount_due ?? 0) <= 0) return false;
  return true;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildFullName(firstName: unknown, lastName: unknown): string | null {
  const first = normalizeString(firstName);
  const last = normalizeString(lastName);
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || null;
}

function extractUserFullName(
  user: {
    user_metadata?: Record<string, unknown> | null;
  } | null,
): string | null {
  const metadata = user?.user_metadata ?? {};

  return (
    normalizeString(metadata.full_name) ??
    normalizeString(metadata.name) ??
    buildFullName(metadata.first_name, metadata.last_name) ??
    buildFullName(metadata.firstName, metadata.lastName)
  );
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
        user_id,
        payment_mode,
        payment_provider,
        payment_status,
        stripe_customer_id,
        stripe_invoice_id,
        receipt_email,
        invoice_email_sent_at
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

async function getOrderUserProfile(
  userId: string | null,
): Promise<OrderUserProfile> {
  if (!userId) {
    return {
      email: null,
      fullName: null,
    };
  }

  const supabaseAdmin = createAdminClient();

  const { data: userResult, error: userError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError) {
    throw new Error(
      `[createStripeNet30Invoice] Failed to resolve user profile for user ${userId}: ${userError.message}`,
    );
  }

  const authUser = userResult?.user ?? null;

  return {
    email: normalizeString(authUser?.email) ?? null,
    fullName: extractUserFullName(authUser),
  };
}

async function getFacilityName(facilityId: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("facilities")
    .select("name")
    .eq("id", facilityId)
    .maybeSingle();

  if (error) {
    console.warn(
      `[createStripeNet30Invoice] Failed to load facility name for facility ${facilityId}: ${error.message}`,
    );
    return null;
  }

  return (
    normalizeString((data as { name?: string | null } | null)?.name) ?? null
  );
}

async function resolveOrderReceiptEmail(
  order: Net30OrderRow,
  userProfile: OrderUserProfile,
): Promise<string> {
  const existingEmail = order.receipt_email?.trim() ?? "";

  if (existingEmail) {
    return existingEmail;
  }

  const fallbackEmail = userProfile.email?.trim() ?? "";

  if (!fallbackEmail) {
    throw new Error(
      `Missing email. Please add an email address for this order or account before sending a Net 30 invoice.`,
    );
  }

  const supabaseAdmin = createAdminClient();

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      receipt_email: fallbackEmail,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(
      `[createStripeNet30Invoice] Failed to save fallback receipt_email for order ${order.order_id}: ${updateError.message}`,
    );
  }

  return fallbackEmail;
}

async function resolveStripeCustomerName(params: {
  order: Net30OrderRow;
  receiptEmail: string;
  userProfile: OrderUserProfile;
}): Promise<string> {
  const facilityName = await getFacilityName(params.order.facility_id);
  if (facilityName) return facilityName;

  const userFullName = params.userProfile.fullName?.trim();
  if (userFullName) return userFullName;

  return params.receiptEmail.trim();
}

async function ensureStripeCustomerForOrder(
  order: Net30OrderRow,
  customerEmail: string,
  customerName: string,
): Promise<string> {
  const customerMetadata = {
    order_db_id: order.id,
    order_number: order.order_id,
    facility_id: order.facility_id,
    payment_mode: "net_30",
  };

  if (order.stripe_customer_id) {
    try {
      const existingCustomer = await stripe.customers.retrieve(
        order.stripe_customer_id,
      );

      if (!("deleted" in existingCustomer) || !existingCustomer.deleted) {
        await stripe.customers.update(existingCustomer.id, {
          email: customerEmail,
          name: customerName,
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
    name: customerName,
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
    fallbackReceiptEmail?: string | null;
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
    receipt_email: toNullableString(
      invoice.customer_email ?? options?.fallbackReceiptEmail,
    ),
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

async function maybeSendInvoiceCreatedEmail(params: {
  orderId: string;
  orderNumber: string;
  receiptEmail: string;
  invoice: Stripe.Invoice;
}) {
  const { orderId, orderNumber, receiptEmail, invoice } = params;
  const supabaseAdmin = createAdminClient();

  if (!receiptEmail.trim()) {
    await supabaseAdmin
      .from("orders")
      .update({
        invoice_email_error: "Missing receipt_email for Net 30 invoice email.",
      })
      .eq("id", orderId);

    return;
  }

  try {
    await sendNet30InvoiceCreatedEmail({
      to: receiptEmail,
      orderId,
      orderNumber,
      amountDue:
        typeof invoice.amount_due === "number"
          ? invoice.amount_due / 100
          : undefined,
      currency: invoice.currency ?? "usd",
      dueDate: toIsoFromUnix(invoice.due_date),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoiceNumber: invoice.number ?? undefined,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        invoice_email_sent_at: new Date().toISOString(),
        invoice_email_error: null,
      })
      .eq("id", orderId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown invoice email error";

    await supabaseAdmin
      .from("orders")
      .update({
        invoice_email_error: message,
      })
      .eq("id", orderId);

    console.error("[createStripeNet30Invoice] failed to send invoice email", {
      orderId,
      message,
    });
  }
}

export async function createStripeNet30Invoice(
  orderId: string,
): Promise<CreateStripeNet30InvoiceResult> {
  const order = await getNet30Order(orderId);

  if (order.payment_mode && order.payment_mode !== "net_30") {
    throw new Error(
      `[createStripeNet30Invoice] Order ${order.order_id} is already assigned to ${order.payment_mode}.`,
    );
  }

  const amountCents = parseAmountToCents(order.amount);
  const userProfile = await getOrderUserProfile(order.user_id);
  const receiptEmail = await resolveOrderReceiptEmail(order, userProfile);
  const customerName = await resolveStripeCustomerName({
    order,
    receiptEmail,
    userProfile,
  });

  const stripeCustomerId = await ensureStripeCustomerForOrder(
    order,
    receiptEmail,
    customerName,
  );

  if (order.stripe_invoice_id) {
    const existingInvoice = await stripe.invoices.retrieve(
      order.stripe_invoice_id,
    );

    const persisted = await persistStripeInvoiceOnOrder(
      order.id,
      stripeCustomerId,
      existingInvoice,
      {
        fallbackReceiptEmail: receiptEmail,
      },
    );

    if (
      !order.invoice_email_sent_at &&
      shouldSendInvoiceCreatedEmail(existingInvoice)
    ) {
      await maybeSendInvoiceCreatedEmail({
        orderId: order.id,
        orderNumber: order.order_id,
        receiptEmail,
        invoice: existingInvoice,
      });
    }

    return persisted;
  }

  const supabaseAdmin = createAdminClient();

  const { error: prepareError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_provider: "stripe",
      payment_mode: "net_30",
      payment_status: "unpaid",
      stripe_customer_id: stripeCustomerId,
      receipt_email: receiptEmail,
    })
    .eq("id", order.id);

  if (prepareError) {
    throw new Error(
      `[createStripeNet30Invoice] Failed to prepare order ${order.id} for Net 30 invoicing: ${prepareError.message}`,
    );
  }

  const stripeMetadata = {
    order_db_id: order.id,
    order_number: order.order_id,
    order_id: order.order_id,
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
    description: `Net 30 Invoice for Order #${order.order_id}`,
  });

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: draftInvoice.id,
    amount: amountCents,
    currency: "usd",
    description: `Net 30 Invoice for Order #${order.order_id}`,
    metadata: stripeMetadata,
  });

  await stripe.invoices.finalizeInvoice(draftInvoice.id, {
    auto_advance: true,
  });

  const finalizedInvoice = await stripe.invoices.retrieve(draftInvoice.id);

  const persisted = await persistStripeInvoiceOnOrder(
    order.id,
    stripeCustomerId,
    finalizedInvoice,
    {
      markInvoiceSentAt: true,
      fallbackReceiptEmail: receiptEmail,
    },
  );

  if (shouldSendInvoiceCreatedEmail(finalizedInvoice)) {
    await maybeSendInvoiceCreatedEmail({
      orderId: order.id,
      orderNumber: order.order_id,
      receiptEmail,
      invoice: finalizedInvoice,
    });
  }

  return persisted;
}
