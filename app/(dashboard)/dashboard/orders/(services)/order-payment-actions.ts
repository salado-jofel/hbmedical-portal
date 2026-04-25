"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, getAppUrl, toStripeAmount } from "@/lib/stripe/stripe";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import type {
  DashboardOrder,
  IPayment,
  IInvoice,
} from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  insertOrderHistory,
  createNotifications,
} from "./_shared";
import { safeLogError } from "@/lib/logging/safe-log";
import { requireOrderAccess } from "@/lib/supabase/order-access";

/* -------------------------------------------------------------------------- */
/* setOrderPaymentMethod                                                      */
/* -------------------------------------------------------------------------- */

export async function setOrderPaymentMethod(
  orderId: string,
  paymentMethod: "pay_now" | "net_30",
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedRoles = [
      "admin",
      "support_staff",
      "clinical_provider",
      "clinical_staff",
      "sales_representative",
    ];

    if (!allowedRoles.includes(profile?.role ?? "")) {
      return { success: false, error: "Unauthorized." };
    }

    const { data: order } = await adminClient
      .from("orders")
      .select("order_status, order_number, facility_id")
      .eq("id", orderId)
      .single();

    if (order?.order_status !== "approved") {
      return { success: false, error: "Payment method can only be set on approved orders." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        payment_method: paymentMethod,
        invoice_status: paymentMethod === "net_30" ? "draft" : "not_applicable",
      })
      .eq("id", orderId);

    if (error) {
      safeLogError("setOrderPaymentMethod", error, { orderId });
      return { success: false, error: error.message };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `Payment method set: ${paymentMethod === "pay_now" ? "Pay Now" : "Net-30"}`,
      null,
      null,
      user.id,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* initiatePayment (all roles)                                                 */
/* -------------------------------------------------------------------------- */

export async function initiatePayment(
  orderId: string,
  returnUrl?: string,
): Promise<{
  success: boolean;
  error: string | null;
  checkoutUrl?: string;
  paymentType?: "pay_now" | "net_30";
}> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    const allowedRoles = [
      "admin",
      "support_staff",
      "clinical_provider",
      "clinical_staff",
      "sales_representative",
    ];
    if (!profile?.role || !allowedRoles.includes(profile.role)) {
      return { success: false, error: "You are not authorized to initiate payments." };
    }

    // Fetch order with items
    const { data: order } = await adminClient
      .from("orders")
      .select(`
        id, order_number, order_status, payment_method,
        payment_status, facility_id,
        order_items (product_name, product_sku, unit_price, quantity, total_amount)
      `)
      .eq("id", orderId)
      .single();

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    if (order.order_status !== "approved") {
      return { success: false, error: "Payment can only be initiated for approved orders." };
    }

    if (!order.payment_method) {
      return { success: false, error: "No payment method set." };
    }

    if (order.payment_status === "paid") {
      return { success: false, error: "This order has already been paid." };
    }

    // Only validate rep hierarchy for sales reps
    if (isSalesRep(profile.role)) {
      const { data: facilityCheck } = await adminClient.rpc("is_rep_facility", {
        p_rep_id:      user.id,
        p_facility_id: order.facility_id,
      });
      if (!facilityCheck) {
        return { success: false, error: "This order is not in your territory." };
      }
    }
    // For all other roles — no facility hierarchy check needed
    // DB RLS already handles access control

    // Fetch facility for Stripe customer
    const { data: facility } = await adminClient
      .from("facilities")
      .select(`
        id, name, contact, phone,
        address_line_1, address_line_2,
        city, state, postal_code, country,
        stripe_customer_id
      `)
      .eq("id", order.facility_id)
      .single();

    if (!facility) {
      return { success: false, error: "Facility not found." };
    }

    const items = (order.order_items ?? []) as Array<{
      product_name: string; product_sku: string;
      unit_price: number; quantity: number; total_amount: number | null;
    }>;
    const firstItem = items[0];
    if (!firstItem) {
      return { success: false, error: "Order has no items." };
    }
    const amount = items.reduce(
      (sum, item) => sum + (item.total_amount ?? item.unit_price * item.quantity),
      0,
    );

    const initiatorName = `${profile!.first_name} ${profile!.last_name}`;

    // Get or create Stripe customer
    let stripeCustomerId: string;
    if (facility.stripe_customer_id) {
      stripeCustomerId = facility.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        name:  facility.name,
        email: user.email ?? undefined,
        phone: facility.phone || undefined,
        metadata: { facility_id: facility.id, facility_contact: facility.contact },
        address: {
          line1:       facility.address_line_1,
          line2:       facility.address_line_2 ?? undefined,
          city:        facility.city,
          state:       facility.state,
          postal_code: facility.postal_code,
          country:     facility.country,
        },
      });
      await adminClient
        .from("facilities")
        .update({ stripe_customer_id: customer.id })
        .eq("id", facility.id);
      stripeCustomerId = customer.id;
    }

    const appUrl = getAppUrl();
    const safeReturnPath = returnUrl ?? "/dashboard/orders";

    // ── pay_now ────────────────────────────────────────────────────────────────
    if (order.payment_method === "pay_now") {
      const session = await stripe.checkout.sessions.create({
        mode:                       "payment",
        customer:                   stripeCustomerId,
        client_reference_id:        order.id,
        success_url:                `${appUrl}${safeReturnPath}?payment_success=true&order_id=${orderId}`,
        cancel_url:                 `${appUrl}${safeReturnPath}?payment_cancelled=true&order_id=${orderId}`,
        payment_method_types:       ["card"],
        billing_address_collection: "auto",
        metadata: {
          order_id:     order.id,
          order_number: order.order_number,
          facility_id:  order.facility_id,
          user_id:      user.id,
        },
        payment_intent_data: {
          description: `Payment for Order ${order.order_number}`,
          metadata: { order_id: order.id, order_number: order.order_number },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              product_data: {
                name:        `${firstItem.product_name} x ${firstItem.quantity}`,
                description: `Order ${order.order_number} • SKU: ${firstItem.product_sku}`,
              },
              unit_amount: toStripeAmount(amount),
            },
          },
        ],
      });

      if (!session.url) {
        return { success: false, error: "Stripe Checkout URL was not returned." };
      }

      await adminClient.from("payments").insert({
        order_id:                   order.id,
        provider:                   "stripe",
        payment_type:               "checkout",
        status:                     "pending",
        amount,
        currency:                   "USD",
        stripe_checkout_session_id: session.id,
      });

      await adminClient
        .from("orders")
        .update({ payment_status: "pending" })
        .eq("id", orderId);

      await insertOrderHistory(
        adminClient, orderId,
        "Payment initiated (Pay Now)",
        null, null, user.id,
        `Initiated by: ${initiatorName}`,
      );
      createNotifications({
        adminClient,
        orderId,
        orderNumber:   order.order_number,
        facilityId:    order.facility_id,
        type:          "payment_initiated",
        title:         "Payment initiated",
        body:          `${initiatorName} initiated a Pay Now payment for order ${order.order_number}.`,
        oldStatus:     null,
        newStatus:     null,
        notifyRoles:   ["admin", "support_staff"],
        excludeUserId: user.id,
      }).catch(() => {});

      revalidatePath(ORDERS_PATH);
      return { success: true, error: null, paymentType: "pay_now", checkoutUrl: session.url };
    }

    // ── net_30 ─────────────────────────────────────────────────────────────────
    if (order.payment_method === "net_30") {
      const draftInvoice = await stripe.invoices.create({
        customer:          stripeCustomerId,
        collection_method: "send_invoice",
        days_until_due:    30,
        auto_advance:      false,
        metadata: {
          order_id:     order.id,
          order_number: order.order_number,
          facility_id:  order.facility_id,
          user_id:      user.id,
        },
        description: `Net 30 invoice for order ${order.order_number}`,
      });

      await stripe.invoiceItems.create({
        customer:    stripeCustomerId,
        invoice:     draftInvoice.id,
        amount:      toStripeAmount(amount),
        currency:    "usd",
        description: `${firstItem.product_name} x ${firstItem.quantity} • Order ${order.order_number} • SKU: ${firstItem.product_sku}`,
        metadata: {
          order_id:     order.id,
          order_number: order.order_number,
          facility_id:  order.facility_id,
          user_id:      user.id,
        },
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);

      const dueAt = finalizedInvoice.due_date
        ? new Date(finalizedInvoice.due_date * 1000).toISOString()
        : null;
      const issuedAt = finalizedInvoice.status_transitions?.finalized_at
        ? new Date(finalizedInvoice.status_transitions.finalized_at * 1000).toISOString()
        : new Date().toISOString();
      const paidAt = finalizedInvoice.status_transitions?.paid_at
        ? new Date(finalizedInvoice.status_transitions.paid_at * 1000).toISOString()
        : null;
      const invoiceNumber = finalizedInvoice.number ?? `INV-${order.order_number}`;
      const amountDue  = (finalizedInvoice.amount_due  ?? 0) / 100;
      const amountPaid = (finalizedInvoice.amount_paid ?? 0) / 100;

      await adminClient.from("invoices").upsert(
        {
          order_id:            order.id,
          invoice_number:      invoiceNumber,
          provider:            "stripe",
          provider_invoice_id: finalizedInvoice.id,
          status:              "issued",
          amount_due:          amountDue,
          amount_paid:         amountPaid,
          currency:            (finalizedInvoice.currency ?? "usd").toUpperCase(),
          due_at:              dueAt,
          issued_at:           issuedAt,
          paid_at:             paidAt,
          hosted_invoice_url:  finalizedInvoice.hosted_invoice_url,
        },
        { onConflict: "order_id" },
      );

      await adminClient
        .from("orders")
        .update({ invoice_status: "issued", payment_status: "pending" })
        .eq("id", orderId);

      await adminClient.from("payments").insert({
        order_id:     orderId,
        provider:     "stripe",
        payment_type: "invoice",
        status:       "pending",
        amount,
        currency:     "USD",
      });

      await insertOrderHistory(
        adminClient, orderId,
        `Invoice created — Net 30 (due ${dueAt ? new Date(dueAt).toLocaleDateString() : "30 days"})`,
        null, null, user.id,
        `Invoice: ${invoiceNumber} | Initiated by: ${initiatorName}`,
      );
      createNotifications({
        adminClient,
        orderId,
        orderNumber:   order.order_number,
        facilityId:    order.facility_id,
        type:          "payment_initiated",
        title:         "Net-30 Invoice created",
        body:          `Invoice ${invoiceNumber} created by ${initiatorName} for order ${order.order_number}${dueAt ? `. Due: ${new Date(dueAt).toLocaleDateString()}` : ""}.`,
        oldStatus:     null,
        newStatus:     null,
        notifyRoles:   ["admin", "support_staff"],
        excludeUserId: user.id,
      }).catch(() => {});

      revalidatePath(ORDERS_PATH);
      return { success: true, error: null, paymentType: "net_30" };
    }

    return { success: false, error: "Unknown payment method." };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// Backwards-compatible alias
export const initiateRepPayment = initiatePayment;

/* -------------------------------------------------------------------------- */
/* getOrderPayment                                                             */
/* -------------------------------------------------------------------------- */

export async function getOrderPayment(orderId: string): Promise<IPayment | null> {
  await requireOrderAccess(orderId);
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id:                      data.id,
    orderId:                 data.order_id,
    provider:                data.provider,
    paymentType:             data.payment_type,
    status:                  data.status,
    amount:                  Number(data.amount),
    currency:                data.currency,
    stripeCheckoutSessionId: data.stripe_checkout_session_id,
    stripePaymentIntentId:   data.stripe_payment_intent_id,
    receiptUrl:              data.receipt_url,
    paidAt:                  data.paid_at,
    createdAt:               data.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* getOrderInvoice                                                             */
/* -------------------------------------------------------------------------- */

export async function getOrderInvoice(orderId: string): Promise<IInvoice | null> {
  await requireOrderAccess(orderId);
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("invoices")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id:              data.id,
    orderId:         data.order_id,
    invoiceNumber:   data.invoice_number,
    provider:        data.provider,
    status:          data.status,
    amountDue:       Number(data.amount_due),
    amountPaid:      Number(data.amount_paid),
    currency:        data.currency,
    dueAt:           data.due_at,
    issuedAt:        data.issued_at,
    paidAt:          data.paid_at,
    hostedInvoiceUrl: data.hosted_invoice_url,
    createdAt:       data.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Legacy stubs                                                               */
/* -------------------------------------------------------------------------- */

export async function createOrderCheckout(orderId: string): Promise<{ url: string | null }> {
  throw new Error("Stripe checkout is not available in the new workflow.");
}

export async function startOrderNet30(orderId: string): Promise<DashboardOrder> {
  throw new Error("Stripe Net 30 is not available in the new workflow.");
}

export async function submitOrderPaymentChoice(
  input: FormData | { id: string; payment_method: string },
): Promise<DashboardOrder> {
  throw new Error("submitOrderPaymentChoice is not supported in the new workflow.");
}
