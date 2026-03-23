"use server";

import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendNet30InvoiceEmail } from "@/utils/emails/send-net30-invoice-email";
import { syncPaidOrderToShipStation } from "@/lib/actions/shipstation";

type CreateStripeNet30InvoiceResult = {
  success: boolean;
  orderId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  customerEmail: string | null;
  error: string | null;
};

type OrderRow = {
  id: string;
  order_id: string | null;
  amount: number | null;
  email: string | null;
  customer_name: string | null;
  stripe_customer_id: string | null;
};

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

function toDisplayDateFromUnix(value: unknown): string | null {
  if (typeof value !== "number") return null;

  return new Date(value * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function createStripeNet30Invoice(
  orderId: string,
): Promise<CreateStripeNet30InvoiceResult> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_id,
          amount,
          email,
          customer_name,
          stripe_customer_id
        `,
      )
      .eq("id", orderId)
      .single();

    if (error || !data) {
      return {
        success: false,
        orderId,
        invoiceId: null,
        invoiceNumber: null,
        hostedInvoiceUrl: null,
        customerEmail: null,
        error: "Order not found.",
      };
    }

    const order = data as OrderRow;

    const orderDbId = toNullableString(order.id);
    const publicOrderId = toNullableString(order.order_id) ?? orderDbId;
    const orderAmount = toNullableNumber(order.amount) ?? 0;
    const orderEmail = toNullableString(order.email);
    const customerName = toNullableString(order.customer_name);

    if (!orderDbId) {
      return {
        success: false,
        orderId: null,
        invoiceId: null,
        invoiceNumber: null,
        hostedInvoiceUrl: null,
        customerEmail: null,
        error: "Order ID is missing.",
      };
    }

    let stripeCustomerId = toNullableString(order.stripe_customer_id);

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: customerName ?? undefined,
        email: orderEmail ?? undefined,
        metadata: {
          order_id: orderDbId,
        },
      });

      stripeCustomerId = toNullableString(customer.id);

      await supabase
        .from("orders")
        .update({
          stripe_customer_id: stripeCustomerId,
        })
        .eq("id", orderDbId);
    }

    if (!stripeCustomerId) {
      return {
        success: false,
        orderId: orderDbId,
        invoiceId: null,
        invoiceNumber: null,
        hostedInvoiceUrl: null,
        customerEmail: orderEmail,
        error: "Failed to create or resolve Stripe customer.",
      };
    }

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: Math.round(orderAmount * 100),
      currency: "usd",
      description: `Order #${publicOrderId ?? orderDbId}`,
      metadata: {
        order_id: orderDbId,
        payment_mode: "net_30",
      },
    });

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: false,
      metadata: {
        order_id: orderDbId,
        payment_mode: "net_30",
      },
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    const invoiceId = toNullableString(finalizedInvoice.id);
    const invoiceNumber = toNullableString(finalizedInvoice.number);
    const hostedInvoiceUrl = toNullableString(
      finalizedInvoice.hosted_invoice_url,
    );
    const invoiceStatus = toNullableString(finalizedInvoice.status);
    const customerEmail =
      toNullableString(finalizedInvoice.customer_email) ?? orderEmail;

    const invoiceDueDateIso = toIsoDateFromUnix(finalizedInvoice.due_date);
    const invoiceDueDateDisplay = toDisplayDateFromUnix(
      finalizedInvoice.due_date,
    );

    const amountDueCents = toNullableNumber(finalizedInvoice.amount_due);
    const amountRemainingCents = toNullableNumber(
      finalizedInvoice.amount_remaining,
    );

    await supabase
      .from("orders")
      .update({
        payment_mode: "net_30",
        payment_status: "invoice_sent",
        stripe_invoice_id: invoiceId,
        stripe_invoice_number: invoiceNumber,
        stripe_invoice_status: invoiceStatus,
        stripe_invoice_hosted_url: hostedInvoiceUrl,
        invoice_due_date: invoiceDueDateIso,
        invoice_sent_at: new Date().toISOString(),
        invoice_amount_due:
          amountDueCents !== null ? amountDueCents / 100 : null,
        invoice_amount_remaining:
          amountRemainingCents !== null ? amountRemainingCents / 100 : null,
      })
      .eq("id", orderDbId);

    if (customerEmail && hostedInvoiceUrl) {
      await sendNet30InvoiceEmail({
        to: customerEmail,
        orderId: publicOrderId ?? orderDbId,
        invoiceNumber,
        dueDate: invoiceDueDateDisplay,
        hostedInvoiceUrl,
        amountDue: amountDueCents !== null ? amountDueCents / 100 : orderAmount,
      });
    }

    // For your requested flow: even Net 30 orders can still trigger shipping sync
    await syncPaidOrderToShipStation(orderDbId).catch((syncError) => {
      console.error("ShipStation sync failed for Net 30 invoice:", syncError);
    });

    return {
      success: true,
      orderId: orderDbId,
      invoiceId,
      invoiceNumber,
      hostedInvoiceUrl,
      customerEmail,
      error: null,
    };
  } catch (error) {
    console.error("createStripeNet30Invoice error:", error);

    return {
      success: false,
      orderId: orderId ?? null,
      invoiceId: null,
      invoiceNumber: null,
      hostedInvoiceUrl: null,
      customerEmail: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create Net 30 invoice.",
    };
  }
}
