import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { stripe, getAppUrl, toStripeAmount } from "../stripe";
import {
  CheckoutFacilityRecord,
  CreateOrderCheckoutSessionResult,
  CheckoutOrderRecord,
} from "@/utils/interfaces/stripe";

async function getOrCreateStripeCustomer(
  facility: CheckoutFacilityRecord,
  userEmail?: string | null,
) {
  if (facility.stripe_customer_id) {
    return facility.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    name: facility.name,
    email: userEmail ?? undefined,
    phone: facility.phone || undefined,
    metadata: {
      facility_id: facility.id,
      facility_contact: facility.contact,
    },
    address: {
      line1: facility.address_line_1,
      line2: facility.address_line_2 ?? undefined,
      city: facility.city,
      state: facility.state,
      postal_code: facility.postal_code,
      country: facility.country,
    },
  });

  const admin = await createAdminClient();

  const { error: facilityUpdateError } = await admin
    .from("facilities")
    .update({
      stripe_customer_id: customer.id,
    })
    .eq("id", facility.id);

  if (facilityUpdateError) {
    console.error(
      "[payments.getOrCreateStripeCustomer] Facility update error:",
      facilityUpdateError,
    );
    throw new Error("Failed to save Stripe customer to facility.");
  }

  return customer.id;
}

type PendingCheckoutPaymentLookup = {
  id: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

async function getLatestPendingCheckoutPayment(orderId: string) {
  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select("id, stripe_checkout_session_id, created_at")
    .eq("order_id", orderId)
    .eq("provider", "stripe")
    .eq("payment_type", "checkout")
    .eq("status", "pending")
    .not("stripe_checkout_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[payments.getLatestPendingCheckoutPayment] Error:", error);
    throw new Error(error.message || "Failed to fetch latest pending payment.");
  }

  return (data?.[0] as PendingCheckoutPaymentLookup | undefined) ?? null;
}

export async function createOrResumeOrderCheckout(
  orderId: string,
): Promise<CreateOrderCheckoutSessionResult> {
  const admin = await createAdminClient();

  const pendingPayment = await getLatestPendingCheckoutPayment(orderId);

  if (pendingPayment?.stripe_checkout_session_id) {
    let existingSession: Awaited<
      ReturnType<typeof stripe.checkout.sessions.retrieve>
    > | null = null;

    try {
      existingSession = await stripe.checkout.sessions.retrieve(
        pendingPayment.stripe_checkout_session_id,
      );
    } catch (error) {
      console.warn(
        "[payments.createOrResumeOrderCheckout] Failed to retrieve existing Checkout Session:",
        error,
      );
    }

    if (existingSession) {
      const hasUrl =
        typeof existingSession.url === "string" &&
        existingSession.url.trim().length > 0;

      const isOpen = existingSession.status === "open";
      const isUnpaid = existingSession.payment_status === "unpaid";
      const isNotExpired =
        typeof existingSession.expires_at !== "number" ||
        existingSession.expires_at * 1000 > Date.now();

      if (isOpen && isUnpaid && isNotExpired && hasUrl) {
        return {
          url: existingSession.url,
          sessionId: existingSession.id,
        };
      }

      if (
        existingSession.status === "complete" ||
        existingSession.payment_status === "paid"
      ) {
        throw new Error(
          "This payment has already been completed. Please refresh the portal.",
        );
      }

      const { error: stalePaymentUpdateError } = await admin
        .from("payments")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingPayment.id);

      if (stalePaymentUpdateError) {
        console.error(
          "[payments.createOrResumeOrderCheckout] Failed to cancel stale pending payment:",
          stalePaymentUpdateError,
        );
        throw new Error(
          stalePaymentUpdateError.message ||
            "Failed to close stale payment attempt.",
        );
      }
    }
  }

  return await createOrderCheckoutSession(orderId);
}

export async function createOrderCheckoutSession(
  orderId: string,
): Promise<CreateOrderCheckoutSessionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      `
        id,
        order_number,
        facility_id,
        payment_method,
        payment_status,
        order_status,
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          product_sku,
          unit_price,
          quantity,
          shipping_amount,
          tax_amount,
          subtotal,
          total_amount
        )
      `,
    )
    .eq("id", orderId)
    .single<CheckoutOrderRecord>();

  if (orderError || !order) {
    console.error(
      "[payments.createOrderCheckoutSession] Order error:",
      orderError,
    );
    throw new Error("Order not found.");
  }

  const { data: facility, error: facilityError } = await admin
    .from("facilities")
    .select(
      `
        id,
        user_id,
        name,
        contact,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        stripe_customer_id
      `,
    )
    .eq("id", order.facility_id)
    .single<CheckoutFacilityRecord>();

  if (facilityError || !facility) {
    console.error(
      "[payments.createOrderCheckoutSession] Facility error:",
      facilityError,
    );
    throw new Error("Facility not found.");
  }

  if (facility.user_id !== user.id) {
    throw new Error("You are not allowed to create checkout for this order.");
  }

  if (order.order_status === "canceled") {
    throw new Error("Canceled orders cannot be paid.");
  }

  if ((order.order_status as string) !== "submitted") {
    throw new Error("Order must be submitted before checkout.");
  }

  if (order.payment_method !== "pay_now") {
    throw new Error("This order is not set to Pay Now.");
  }

  if (order.payment_status === "paid") {
    throw new Error("This order is already paid.");
  }

  const firstItem = order.order_items[0];
  if (!firstItem) {
    throw new Error("Order has no items.");
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    facility,
    user.email,
  );

  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: order.id,
    success_url: `${appUrl}/dashboard/orders?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/orders?payment=cancelled`,
    payment_method_types: ["card"],
    billing_address_collection: "auto",
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      facility_id: order.facility_id,
      user_id: user.id,
    },
    payment_intent_data: {
      description: `Payment for Order ${order.order_number}`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: `${firstItem.product_name} x ${firstItem.quantity}`,
            description: `Order ${order.order_number} • SKU: ${firstItem.product_sku}`,
          },
          unit_amount: toStripeAmount(firstItem.total_amount),
        },
      },
    ],
  });

  if (!session.url) {
    throw new Error("Stripe Checkout URL was not returned.");
  }

  const { error: paymentInsertError } = await admin.from("payments").insert({
    order_id: order.id,
    provider: "stripe",
    payment_type: "checkout",
    status: "pending",
    amount: firstItem.total_amount,
    currency: "USD",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: null,
    provider_payment_id: null,
    paid_at: null,
  });

  if (paymentInsertError) {
    console.error(
      "[payments.createOrderCheckoutSession] Payment insert error:",
      paymentInsertError,
    );
    throw new Error(
      paymentInsertError.message || "Failed to create payment record.",
    );
  }

  const { error: orderUpdateError } = await admin
    .from("orders")
    .update({
      payment_status: "pending",
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    console.error(
      "[payments.createOrderCheckoutSession] Order update error:",
      orderUpdateError,
    );
    throw new Error(
      orderUpdateError.message || "Failed to update order payment status.",
    );
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}
