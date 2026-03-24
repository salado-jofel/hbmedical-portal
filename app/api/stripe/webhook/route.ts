import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { stripe } from "@/utils/stripe/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncPaidOrderToShipStation } from "@/lib/actions/shipstation";
import { sendPaymentReceiptEmail } from "@/utils/emails/send-payment-receipt";
import { sendNet30ReceiptEmail } from "@/utils/emails/send-net30-receipt";
import type { PersistedPaymentStatus } from "@/app/(interfaces)/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarkOrderPaidResult = {
  orderId: string | null;
  orderNumber: string | null;
  shouldSyncShipStation: boolean;
  receiptEmail: string | null;
  receiptUrl: string | null;
  amountTotal: number | null;
  currency: string | null;
};

type InvoiceOrderLookup = {
  id: string;
  order_id: string | null;
  stripe_invoice_id: string | null;
  payment_status: PersistedPaymentStatus | null;
};

type Net30ReceiptEmailContext = {
  id: string;
  order_id: string | null;
  receipt_email: string | null;
  stripe_invoice_number: string | null;
  stripe_invoice_hosted_url: string | null;
  paid_at: string | null;
  invoice_paid_at: string | null;
  facilities?:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
  products?:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
};

function toNullableString(value: string | null | undefined): string | null {
  return value ?? null;
}

function toIsoFromUnix(value: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  return new Date(value * 1000).toISOString();
}

function isInvoiceOverdue(invoice: Stripe.Invoice): boolean {
  if (invoice.status === "paid") return false;
  if (typeof invoice.due_date !== "number") return false;
  if ((invoice.amount_remaining ?? 0) <= 0) return false;
  return invoice.due_date * 1000 < Date.now();
}

function deriveInvoicePaymentStatus(
  invoice: Stripe.Invoice,
): PersistedPaymentStatus {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "uncollectible") return "payment_failed";
  if (invoice.status === "void") return "unpaid";
  if (isInvoiceOverdue(invoice)) return "overdue";
  return "invoice_sent";
}

function getRelatedName(
  relation:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null
    | undefined,
): string | null {
  if (!relation) return null;

  if (Array.isArray(relation)) {
    return relation[0]?.name?.trim() || null;
  }

  return relation.name?.trim() || null;
}

async function getFreshInvoiceFromEvent(event: Stripe.Event) {
  const invoiceFromEvent = event.data.object as Stripe.Invoice;

  return stripe.invoices.retrieve(invoiceFromEvent.id, {
    expand: ["payments"],
  });
}

function resolveCheckoutOrderId(
  session: Stripe.Checkout.Session,
): string | null {
  return (
    session.metadata?.order_id ??
    session.metadata?.order_db_id ??
    session.client_reference_id ??
    null
  );
}

async function registerStripeEvent(
  event: Stripe.Event,
  options?: {
    stripeObjectId?: string | null;
    checkoutSessionId?: string | null;
    orderId?: string | null;
  },
) {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    stripe_object_id: options?.stripeObjectId ?? null,
    checkout_session_id: options?.checkoutSessionId ?? null,
    order_id: options?.orderId ?? null,
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    console.log("[stripe webhook] Duplicate event ignored:", event.id);
    return false;
  }

  throw new Error(error.message);
}

async function getReceiptDetails(session: Stripe.Checkout.Session) {
  const receiptEmail =
    session.customer_details?.email ??
    session.customer_email ??
    session.metadata?.user_email ??
    null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  let receiptUrl: string | null = null;

  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const latestCharge =
      typeof paymentIntent.latest_charge === "string"
        ? null
        : paymentIntent.latest_charge;

    receiptUrl = latestCharge?.receipt_url ?? null;
  }

  return {
    receiptEmail,
    receiptUrl,
    paymentIntentId,
    customerId,
  };
}

async function getInvoiceReceiptUrl(
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const invoicePayments = invoice.payments?.data?.length
    ? invoice.payments.data
    : (
        await stripe.invoicePayments.list({
          invoice: invoice.id,
          limit: 10,
        })
      ).data;

  for (const invoicePayment of invoicePayments) {
    if (invoicePayment.status !== "paid") continue;

    const payment = invoicePayment.payment;

    if (payment.type === "charge" && payment.charge) {
      const charge =
        typeof payment.charge === "string"
          ? await stripe.charges.retrieve(payment.charge)
          : payment.charge;

      if (charge.receipt_url) {
        return charge.receipt_url;
      }
    }

    if (payment.type === "payment_intent" && payment.payment_intent) {
      const paymentIntentId =
        typeof payment.payment_intent === "string"
          ? payment.payment_intent
          : payment.payment_intent.id;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
      );

      const latestCharge =
        typeof paymentIntent.latest_charge === "string"
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : paymentIntent.latest_charge;

      if (latestCharge?.receipt_url) {
        return latestCharge.receipt_url;
      }
    }
  }

  return null;
}

async function markOrderPaid(
  session: Stripe.Checkout.Session,
): Promise<MarkOrderPaidResult> {
  const orderId = resolveCheckoutOrderId(session);

  if (!orderId) {
    throw new Error(
      `[stripe webhook] Missing order identifier for checkout session ${session.id}`,
    );
  }

  const supabaseAdmin = createAdminClient();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        order_id,
        payment_status,
        shipstation_sync_status,
        shipstation_shipment_id,
        receipt_email
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `[stripe webhook] Order lookup failed for checkout session ${session.id}: ${fetchError.message}`,
    );
  }

  if (!existing) {
    throw new Error(
      `[stripe webhook] No order found for checkout session ${session.id} and order id ${orderId}`,
    );
  }

  const { receiptEmail, receiptUrl, paymentIntentId, customerId } =
    await getReceiptDetails(session);

  const finalReceiptEmail =
    receiptEmail ??
    existing.receipt_email ??
    session.metadata?.user_email ??
    null;

  const alreadyPaid = existing.payment_status === "paid";

  const alreadySynced =
    existing.shipstation_sync_status === "sent" ||
    existing.shipstation_sync_status === "fulfilled" ||
    !!existing.shipstation_shipment_id;

  const updatePayload: Record<string, unknown> = {
    payment_provider: "stripe",
    payment_mode: "pay_now",
    payment_status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: customerId,
    receipt_email: finalReceiptEmail,
    stripe_receipt_url: receiptUrl,
  };

  if (!alreadyPaid) {
    updatePayload.paid_at = new Date().toISOString();
    updatePayload.shipstation_sync_status = "ready";
  }

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("id");

  if (updateError) {
    throw new Error(
      `[stripe webhook] Failed to update paid checkout order ${orderId}: ${updateError.message}`,
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(
      `[stripe webhook] No pay_now order row updated for order id ${orderId}`,
    );
  }

  return {
    orderId,
    orderNumber: existing.order_id ?? orderId,
    shouldSyncShipStation: !alreadySynced,
    receiptEmail: finalReceiptEmail,
    receiptUrl,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
}

async function markCheckoutOrderStatus(
  session: Stripe.Checkout.Session,
  paymentStatus: PersistedPaymentStatus,
) {
  const orderId = resolveCheckoutOrderId(session);

  if (!orderId) {
    throw new Error(
      `[stripe webhook] Missing order identifier for checkout session ${session.id}`,
    );
  }

  const supabaseAdmin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    payment_status: paymentStatus,
    stripe_checkout_session_id: session.id,
    payment_mode: "pay_now",
    payment_provider: "stripe",
  };

  if (paymentStatus === "payment_failed") {
    updatePayload.receipt_email_error = "Stripe checkout payment failed.";
  }

  const { data: updatedRows, error } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("id");

  if (error) {
    throw new Error(
      `[stripe webhook] Failed to mark checkout order ${orderId} as ${paymentStatus}: ${error.message}`,
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(
      `[stripe webhook] No checkout order row updated for order id ${orderId}`,
    );
  }
}

async function claimReceiptEmailLock(orderId: string) {
  const supabaseAdmin = createAdminClient();
  const lockId = crypto.randomUUID();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      receipt_email_lock_id: lockId,
    })
    .eq("id", orderId)
    .is("receipt_email_sent_at", null)
    .is("receipt_email_lock_id", null)
    .select("id, receipt_email_lock_id")
    .maybeSingle();

  if (error) {
    console.error(
      "[stripe webhook] Failed to claim receipt email lock:",
      error.message,
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return lockId;
}

async function maybeSendReceiptEmail(result: MarkOrderPaidResult) {
  if (!result.orderId || !result.receiptEmail) {
    return;
  }

  const supabaseAdmin = createAdminClient();
  const lockId = await claimReceiptEmailLock(result.orderId);

  if (!lockId) {
    console.log(
      "[stripe webhook] Receipt email skipped; already locked or sent:",
      result.orderId,
    );
    return;
  }

  try {
    const resendResult = await sendPaymentReceiptEmail({
      to: result.receiptEmail,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      amountTotal: result.amountTotal,
      currency: result.currency,
      receiptUrl: result.receiptUrl,
    });

    console.log("[stripe webhook] Receipt email sent:", {
      orderId: result.orderId,
      resendId: resendResult?.data?.id ?? null,
    });

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_sent_at: new Date().toISOString(),
        receipt_email_error: null,
        receipt_email_lock_id: null,
      })
      .eq("id", result.orderId)
      .eq("receipt_email_lock_id", lockId);

    if (error) {
      console.error(
        "[stripe webhook] Failed to save receipt_email_sent_at:",
        error.message,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email error";

    console.error("[stripe webhook] Failed to send receipt email:", message);

    const { error: dbError } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_error: message,
        receipt_email_lock_id: null,
      })
      .eq("id", result.orderId)
      .eq("receipt_email_lock_id", lockId);

    if (dbError) {
      console.error(
        "[stripe webhook] Failed to save receipt email error:",
        dbError.message,
      );
    }
  }
}

async function handleSuccessfulCheckoutSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const resolvedOrderId = resolveCheckoutOrderId(session);

  const isNewEvent = await registerStripeEvent(event, {
    stripeObjectId: session.id,
    checkoutSessionId: session.id,
    orderId: resolvedOrderId,
  });

  if (!isNewEvent) {
    return;
  }

  const result = await markOrderPaid(session);

  await maybeSendReceiptEmail(result);

  if (result.orderId && result.shouldSyncShipStation) {
    try {
      await syncPaidOrderToShipStation(result.orderId);
    } catch (shipstationError) {
      console.error(
        "[stripe webhook] ShipStation sync failed:",
        shipstationError,
      );

      const supabaseAdmin = createAdminClient();

      await supabaseAdmin
        .from("orders")
        .update({
          shipstation_sync_status: "failed",
        })
        .eq("id", result.orderId);
    }
  }

  revalidatePath("/dashboard/orders");
}

async function findOrderForInvoice(
  invoice: Stripe.Invoice,
): Promise<InvoiceOrderLookup | null> {
  const supabaseAdmin = createAdminClient();

  const selectColumns = "id, order_id, stripe_invoice_id, payment_status";

  {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(selectColumns)
      .eq("stripe_invoice_id", invoice.id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `[stripe webhook] Failed lookup by stripe_invoice_id (${invoice.id}): ${error.message}`,
      );
    }

    if (data) return data as InvoiceOrderLookup;
  }

  const orderDbId = invoice.metadata?.order_db_id ?? null;
  if (orderDbId) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(selectColumns)
      .eq("id", orderDbId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `[stripe webhook] Failed lookup by metadata.order_db_id (${orderDbId}): ${error.message}`,
      );
    }

    if (data) return data as InvoiceOrderLookup;
  }

  const orderNumber = invoice.metadata?.order_number ?? null;
  if (orderNumber) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(selectColumns)
      .eq("order_id", orderNumber)
      .maybeSingle();

    if (error) {
      throw new Error(
        `[stripe webhook] Failed lookup by metadata.order_number (${orderNumber}): ${error.message}`,
      );
    }

    if (data) return data as InvoiceOrderLookup;
  }

  const legacyOrderId = invoice.metadata?.order_id ?? null;
  if (legacyOrderId) {
    const { data: byId, error: idError } = await supabaseAdmin
      .from("orders")
      .select(selectColumns)
      .eq("id", legacyOrderId)
      .maybeSingle();

    if (idError) {
      throw new Error(
        `[stripe webhook] Failed lookup by legacy metadata.order_id as id (${legacyOrderId}): ${idError.message}`,
      );
    }

    if (byId) return byId as InvoiceOrderLookup;

    const { data: byOrderNumber, error: orderNumberError } = await supabaseAdmin
      .from("orders")
      .select(selectColumns)
      .eq("order_id", legacyOrderId)
      .maybeSingle();

    if (orderNumberError) {
      throw new Error(
        `[stripe webhook] Failed lookup by legacy metadata.order_id as order_id (${legacyOrderId}): ${orderNumberError.message}`,
      );
    }

    if (byOrderNumber) return byOrderNumber as InvoiceOrderLookup;
  }

  return null;
}

async function loadNet30ReceiptEmailContext(
  orderId: string,
): Promise<Net30ReceiptEmailContext | null> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        order_id,
        receipt_email,
        stripe_invoice_number,
        stripe_invoice_hosted_url,
        paid_at,
        invoice_paid_at,
        facilities(name),
        products(name)
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[stripe webhook] Failed to load Net 30 receipt email context for ${orderId}: ${error.message}`,
    );
  }

  return (data as Net30ReceiptEmailContext | null) ?? null;
}

async function maybeSendNet30ReceiptEmail(params: {
  orderId: string;
  invoice: Stripe.Invoice;
}) {
  const { orderId, invoice } = params;
  const context = await loadNet30ReceiptEmailContext(orderId);

  if (!context?.receipt_email) {
    console.log(
      "[stripe webhook] Net 30 receipt email skipped; missing receipt_email:",
      orderId,
    );
    return;
  }

  const supabaseAdmin = createAdminClient();
  const lockId = await claimReceiptEmailLock(orderId);

  if (!lockId) {
    console.log(
      "[stripe webhook] Net 30 receipt email skipped; already locked or sent:",
      orderId,
    );
    return;
  }

  try {
    const receiptUrl = await getInvoiceReceiptUrl(invoice);

    const resendResult = await sendNet30ReceiptEmail({
      to: context.receipt_email,
      orderId: context.id,
      orderNumber: context.order_id,
      facilityName: getRelatedName(context.facilities),
      productName: getRelatedName(context.products),
      amountPaid:
        typeof invoice.amount_paid === "number" ? invoice.amount_paid : null,
      currency: invoice.currency ?? "usd",
      paidAt:
        toIsoFromUnix(invoice.status_transitions?.paid_at) ??
        context.invoice_paid_at ??
        context.paid_at,
      receiptUrl,
      hostedInvoiceUrl:
        invoice.hosted_invoice_url ?? context.stripe_invoice_hosted_url,
      invoiceNumber: invoice.number ?? context.stripe_invoice_number,
    });

    console.log("[stripe webhook] Net 30 receipt email sent:", {
      orderId,
      resendId: resendResult?.data?.id ?? null,
    });

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_sent_at: new Date().toISOString(),
        receipt_email_error: null,
        receipt_email_lock_id: null,
      })
      .eq("id", orderId)
      .eq("receipt_email_lock_id", lockId);

    if (error) {
      console.error(
        "[stripe webhook] Failed to save Net 30 receipt email sent state:",
        error.message,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Net 30 receipt email error";

    console.error(
      "[stripe webhook] Failed to send Net 30 receipt email:",
      message,
    );

    const { error: dbError } = await supabaseAdmin
      .from("orders")
      .update({
        receipt_email_error: message,
        receipt_email_lock_id: null,
      })
      .eq("id", orderId)
      .eq("receipt_email_lock_id", lockId);

    if (dbError) {
      console.error(
        "[stripe webhook] Failed to save Net 30 receipt email error:",
        dbError.message,
      );
    }
  }
}

async function syncStripeInvoiceToOrder(
  invoice: Stripe.Invoice,
  options?: {
    forcePaymentStatus?: PersistedPaymentStatus;
    markInvoiceSentAt?: boolean;
    markInvoicePaidAt?: boolean;
  },
) {
  const supabaseAdmin = createAdminClient();

  const order = await findOrderForInvoice(invoice);

  if (!order) {
    throw new Error(
      `[stripe webhook] No order found for invoice ${invoice.id} with metadata ${JSON.stringify(
        invoice.metadata ?? {},
      )}`,
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        order_id,
        payment_status,
        stripe_invoice_status,
        invoice_overdue_at,
        invoice_sent_at,
        invoice_paid_at,
        paid_at,
        invoice_amount_due,
        invoice_amount_remaining,
        shipstation_sync_status,
        shipstation_shipment_id,
        stripe_receipt_url,
        receipt_email
      `,
    )
    .eq("id", order.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `[stripe webhook] Failed fetching existing order ${order.id}: ${existingError.message}`,
    );
  }

  if (!existing) {
    throw new Error(
      `[stripe webhook] Resolved order ${order.id} but no matching row was returned.`,
    );
  }

  let nextPaymentStatus =
    options?.forcePaymentStatus ?? deriveInvoicePaymentStatus(invoice);

  if (existing.payment_status === "paid" && nextPaymentStatus !== "paid") {
    nextPaymentStatus = "paid";
  }

  if (
    nextPaymentStatus === "invoice_sent" &&
    existing.payment_status === "payment_failed"
  ) {
    nextPaymentStatus = "payment_failed";
  }

  if (
    nextPaymentStatus === "invoice_sent" &&
    existing.payment_status === "overdue"
  ) {
    nextPaymentStatus = "overdue";
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer?.id ?? null);

  const paidAt =
    toIsoFromUnix(invoice.status_transitions?.paid_at) ??
    existing.invoice_paid_at ??
    existing.paid_at ??
    (options?.markInvoicePaidAt ? new Date().toISOString() : null);

  const finalReceiptEmail =
    toNullableString(invoice.customer_email) ?? existing.receipt_email ?? null;

  const receiptUrl =
    nextPaymentStatus === "paid" ? await getInvoiceReceiptUrl(invoice) : null;

  const updatePayload: Record<string, unknown> = {
    payment_provider: "stripe",
    payment_mode: "net_30",
    payment_status: nextPaymentStatus,
    stripe_customer_id: customerId,
    stripe_invoice_id: invoice.id,
    stripe_invoice_number: toNullableString(invoice.number),
    stripe_invoice_status: toNullableString(invoice.status),
    stripe_invoice_hosted_url: toNullableString(invoice.hosted_invoice_url),
    receipt_email: finalReceiptEmail,
    invoice_due_date: toIsoFromUnix(invoice.due_date),
    invoice_amount_due:
      typeof invoice.amount_due === "number" ? invoice.amount_due : null,
    invoice_amount_remaining:
      typeof invoice.amount_remaining === "number"
        ? invoice.amount_remaining
        : null,
    stripe_receipt_url: receiptUrl ?? existing.stripe_receipt_url ?? null,
  };

  if (options?.markInvoiceSentAt) {
    updatePayload.invoice_sent_at =
      existing.invoice_sent_at ?? new Date().toISOString();
  }

  if (nextPaymentStatus === "paid") {
    updatePayload.invoice_paid_at = paidAt;
    updatePayload.paid_at = paidAt;
    updatePayload.invoice_overdue_at = null;
    updatePayload.invoice_amount_remaining = 0;
    updatePayload.stripe_invoice_status = "paid";

    const alreadySynced =
      existing.shipstation_sync_status === "sent" ||
      existing.shipstation_sync_status === "fulfilled" ||
      !!existing.shipstation_shipment_id;

    if (!alreadySynced) {
      updatePayload.shipstation_sync_status = "ready";
    }
  } else if (nextPaymentStatus === "overdue") {
    updatePayload.invoice_overdue_at =
      existing.invoice_overdue_at ?? new Date().toISOString();
  } else {
    updatePayload.invoice_overdue_at = null;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", order.id)
    .select(
      "id, order_id, payment_status, stripe_invoice_status, shipstation_sync_status",
    )
    .maybeSingle();

  if (updateError) {
    throw new Error(
      `[stripe webhook] Failed updating invoice-backed order ${order.id}: ${updateError.message}`,
    );
  }

  if (!updated) {
    throw new Error(
      `[stripe webhook] No invoice-backed order row updated for invoice ${invoice.id}`,
    );
  }

  console.log("[stripe webhook] invoice synced to order", {
    invoiceId: invoice.id,
    orderId: updated.id,
    orderNumber: updated.order_id,
    paymentStatus: updated.payment_status,
    stripeInvoiceStatus: updated.stripe_invoice_status,
    shipstationSyncStatus: updated.shipstation_sync_status,
  });

  return {
    resolvedOrderId: order.id,
    resolvedOrderNumber: order.order_id,
    updatedOrder: updated,
  };
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const debug: Record<string, unknown> = {
    build: "orders-net30-webhook-v3",
    eventId: event.id,
    eventType: event.type,
    branch: "start",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
  };

  console.log("[stripe webhook] received", debug);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        debug.branch = "checkout.session.completed";

        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await handleSuccessfulCheckoutSession(event, session);
          debug.checkoutSessionId = session.id;
          debug.checkoutPaymentStatus = session.payment_status;
          debug.resolvedOrderId = resolveCheckoutOrderId(session);
        }

        return NextResponse.json({ received: true, debug });
      }

      case "checkout.session.async_payment_succeeded": {
        debug.branch = "checkout.session.async_payment_succeeded";

        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulCheckoutSession(event, session);

        debug.checkoutSessionId = session.id;
        debug.checkoutPaymentStatus = session.payment_status;
        debug.resolvedOrderId = resolveCheckoutOrderId(session);

        return NextResponse.json({ received: true, debug });
      }

      case "checkout.session.async_payment_failed": {
        debug.branch = "checkout.session.async_payment_failed";

        const session = event.data.object as Stripe.Checkout.Session;
        const resolvedOrderId = resolveCheckoutOrderId(session);

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: session.id,
          checkoutSessionId: session.id,
          orderId: resolvedOrderId,
        });

        debug.checkoutSessionId = session.id;
        debug.isNewEvent = isNewEvent;
        debug.resolvedOrderId = resolvedOrderId;

        if (isNewEvent) {
          await markCheckoutOrderStatus(session, "payment_failed");
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "checkout.session.expired": {
        debug.branch = "checkout.session.expired";

        const session = event.data.object as Stripe.Checkout.Session;
        const resolvedOrderId = resolveCheckoutOrderId(session);

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: session.id,
          checkoutSessionId: session.id,
          orderId: resolvedOrderId,
        });

        debug.checkoutSessionId = session.id;
        debug.isNewEvent = isNewEvent;
        debug.resolvedOrderId = resolvedOrderId;

        if (isNewEvent) {
          await markCheckoutOrderStatus(session, "unpaid");
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.finalized": {
        debug.branch = "invoice.finalized";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice, {
            forcePaymentStatus: "invoice_sent",
            markInvoiceSentAt: true,
          });

          debug.syncResult = result;
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.updated": {
        debug.branch = "invoice.updated";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice);
          debug.syncResult = result;
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.paid": {
        debug.branch = "invoice.paid";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice, {
            forcePaymentStatus: "paid",
            markInvoicePaidAt: true,
          });

          debug.syncResult = result;

          if (result.resolvedOrderId) {
            await maybeSendNet30ReceiptEmail({
              orderId: result.resolvedOrderId,
              invoice,
            });

            try {
              await syncPaidOrderToShipStation(result.resolvedOrderId);
            } catch (shipstationError) {
              console.error(
                "[stripe webhook] ShipStation sync failed for invoice.paid:",
                shipstationError,
              );

              const supabaseAdmin = createAdminClient();

              await supabaseAdmin
                .from("orders")
                .update({
                  shipstation_sync_status: "failed",
                })
                .eq("id", result.resolvedOrderId);
            }
          }

          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.payment_failed": {
        debug.branch = "invoice.payment_failed";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice, {
            forcePaymentStatus: "payment_failed",
          });

          debug.syncResult = result;
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.marked_uncollectible": {
        debug.branch = "invoice.marked_uncollectible";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice, {
            forcePaymentStatus: "payment_failed",
          });

          debug.syncResult = result;
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      case "invoice.voided": {
        debug.branch = "invoice.voided";

        const invoice = await getFreshInvoiceFromEvent(event);
        debug.invoiceId = invoice.id;
        debug.invoiceStatus = invoice.status;
        debug.invoiceMetadata = invoice.metadata ?? {};

        const order = await findOrderForInvoice(invoice);
        debug.resolvedOrder = order ?? null;

        const isNewEvent = await registerStripeEvent(event, {
          stripeObjectId: invoice.id,
          orderId: order?.id ?? null,
        });

        debug.isNewEvent = isNewEvent;

        if (isNewEvent) {
          const result = await syncStripeInvoiceToOrder(invoice, {
            forcePaymentStatus: "unpaid",
          });

          debug.syncResult = result;
          revalidatePath("/dashboard/orders");
        }

        return NextResponse.json({ received: true, debug });
      }

      default: {
        debug.branch = `default:${event.type}`;
        return NextResponse.json({ received: true, debug });
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";

    console.error("[stripe webhook] error", {
      message,
      debug,
    });

    return NextResponse.json(
      {
        error: message,
        debug,
      },
      { status: 500 },
    );
  }
}
