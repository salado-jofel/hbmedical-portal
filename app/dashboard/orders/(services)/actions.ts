"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, dbSelect } from "@/utils/supabase/db";
import { stripe } from "@/utils/stripe/server";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";
import { getShipStationClient } from "@/lib/shipstation/server";
import { assertOrderingAllowedByUserId } from "@/lib/billing/net30";
import { PaymentProvider, PaymentStatus } from "@/app/(interfaces)/payment";

const ORDER_TABLE = "orders";

const ORDER_COLUMNS = `
  id,
  created_at,
  order_id,
  facility_id,
  product_id,
  amount,
  quantity,
  status,
  payment_mode,
  payment_provider,
  payment_status,
  receipt_email,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_invoice_id,
  stripe_invoice_number,
  stripe_invoice_status,
  stripe_invoice_hosted_url,
  stripe_checkout_url,
  stripe_customer_id,
  stripe_receipt_url,
  paid_at,
  invoice_due_date,
  invoice_sent_at,
  invoice_paid_at,
  invoice_amount_due,
  invoice_amount_remaining,
  invoice_overdue_at,
  tracking_number,
  carrier_code,
  shipstation_order_id,
  shipstation_shipment_id,
  shipstation_status,
  shipstation_sync_status,
  shipstation_label_url,
  shipped_at,
  facilities(name, stripe_customer_id, phone),
  products(name, price)
`;

const ORDERS_PATH = "/dashboard/orders";

type RawOrder = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  status: string;
  payment_mode: "pay_now" | "net_30" | null;
  payment_provider: PaymentProvider | null;
  payment_status: PaymentStatus;
  receipt_email: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_number: string | null;
  stripe_invoice_status: string | null;
  stripe_invoice_hosted_url: string | null;
  stripe_checkout_url: string | null;
  stripe_customer_id: string | null;
  stripe_receipt_url: string | null;
  paid_at: string | null;
  invoice_due_date: string | null;
  invoice_sent_at: string | null;
  invoice_paid_at: string | null;
  invoice_amount_due: number | null;
  invoice_amount_remaining: number | null;
  invoice_overdue_at: string | null;
  tracking_number: string | null;
  shipstation_sync_status: string | null;
  carrier_code: string | null;
  shipstation_order_id: string | null;
  shipstation_shipment_id: string | null;
  shipstation_status: string | null;
  shipstation_label_url: string | null;
  shipped_at: string | null;
  facilities: {
    name: string;
    stripe_customer_id: string | null;
    phone: string | null;
  } | null;
  products: {
    name: string;
    price: number | string;
  } | null;
};

type RawCheckoutOrder = {
  id: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  payment_mode: "pay_now" | "net_30" | null;
  payment_status:
    | "unpaid"
    | "invoice_sent"
    | "paid"
    | "overdue"
    | "payment_failed"
    | null;
  facilities: {
    id?: string;
    name: string;
    stripe_customer_id: string | null;
    phone: string | null;
  } | null;
  products: {
    id?: string;
    name: string;
    price: number | string;
  } | null;
};

type RawShipStationOrder = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  payment_mode: "pay_now" | "net_30" | null;
  payment_status:
    | "unpaid"
    | "invoice_sent"
    | "paid"
    | "overdue"
    | "payment_failed"
    | null;
  status: string;
  tracking_number: string | null;
  shipstation_sync_status: string | null;
  carrier_code: string | null;
  shipstation_order_id: string | null;
  shipstation_shipment_id: string | null;
  shipstation_status: string | null;
  shipstation_label_url: string | null;
  facilities: {
    name: string;
    phone: string | null;
  } | null;
  products: {
    name: string;
    price: number | string;
  } | null;
};

function centsToDollars(value: number | null): number | null {
  if (typeof value !== "number") return null;
  return value / 100;
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function flattenOrder(row: RawOrder): Order {
  return {
    id: row.id,
    created_at: row.created_at,
    order_id: row.order_id,
    facility_id: row.facility_id,
    product_id: row.product_id,
    amount: Number(row.amount),
    quantity: row.quantity,
    status: row.status as Order["status"],
    facility_name: row.facilities?.name ?? "—",
    product_name: row.products?.name ?? "—",

    payment_mode: row.payment_mode,
    payment_provider: row.payment_provider ?? "stripe",
    payment_status: row.payment_status ?? "unpaid",
    receipt_email: row.receipt_email,

    stripe_checkout_session_id: row.stripe_checkout_session_id,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    stripe_invoice_id: row.stripe_invoice_id,
    stripe_invoice_number: row.stripe_invoice_number,
    stripe_invoice_status: row.stripe_invoice_status,
    stripe_invoice_hosted_url: row.stripe_invoice_hosted_url,
    stripe_checkout_url: row.stripe_checkout_url,
    stripe_customer_id: row.stripe_customer_id,
    stripe_receipt_url: row.stripe_receipt_url,

    paid_at: row.paid_at,
    invoice_due_date: row.invoice_due_date,
    invoice_sent_at: row.invoice_sent_at,
    invoice_paid_at: row.invoice_paid_at,
    invoice_amount_due: centsToDollars(row.invoice_amount_due),
    invoice_amount_remaining: centsToDollars(row.invoice_amount_remaining),
    invoice_overdue_at: row.invoice_overdue_at,

    shipstation_sync_status: row.shipstation_sync_status,
    tracking_number: row.tracking_number,
    carrier_code: row.carrier_code,
    shipstation_order_id: row.shipstation_order_id,
    shipstation_shipment_id: row.shipstation_shipment_id,
    shipstation_status: row.shipstation_status,
    shipstation_label_url: row.shipstation_label_url,
    shipped_at: row.shipped_at,
  };
}

async function getCurrentUserFacilityIds(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("facilities")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getCurrentUserFacilityIds] Supabase error:", error.message);
    return [];
  }

  return (data ?? []).map((f) => f.id);
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  try {
    const supabase = await getSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getAllOrders] Auth error:", authError?.message);
      return [];
    }

    const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

    if (facilityIds.length === 0) return [];

    const { data, error } = await supabase
      .from(ORDER_TABLE)
      .select(ORDER_COLUMNS)
      .in("facility_id", facilityIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getAllOrders] Supabase error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => flattenOrder(row as unknown as RawOrder));
  } catch (err) {
    console.error("[getAllOrders] Unexpected error:", err);
    return [];
  }
}

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addOrder(formData: FormData): Promise<Order> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  // Net 30 / credit hold backend enforcement
  await assertOrderingAllowedByUserId(user.id);

  const order_id = formData.get("order_id") as string;
  const facility_id = formData.get("facility_id") as string;
  const product_id = formData.get("product_id") as string;
  const quantity = Math.max(
    1,
    parseInt(String(formData.get("quantity") ?? "1"), 10) || 1,
  );

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(facility_id)) {
    throw new Error(
      "You do not have permission to create orders for this facility.",
    );
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    console.error("[addOrder] Product lookup error:", productError?.message);
    throw new Error("Selected product not found.");
  }

  const amount = Number(product.price) * quantity;

  const { data: insertedRow, error: insertError } = await supabase
    .from(ORDER_TABLE)
    .insert({
      order_id,
      facility_id,
      product_id,
      amount,
      quantity,
      status: "Processing",
      payment_provider: "stripe",
      payment_status: "unpaid",
      receipt_email: user.email ?? null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (insertError || !insertedRow) {
    console.error("[addOrder] DB insert error:", insertError?.message);
    throw new Error("Failed to save order to database.");
  }

  const { data: row, error: fetchError } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_COLUMNS)
    .eq("id", insertedRow.id)
    .single();

  if (fetchError || !row) {
    console.error("[addOrder] Fetch after insert failed:", fetchError?.message);
    throw new Error("Order saved but could not be retrieved.");
  }

  revalidatePath(ORDERS_PATH);
  return flattenOrder(row as unknown as RawOrder);
}

// ── STRIPE CUSTOMER ───────────────────────────────────────────────────────────

export async function ensureStripeCustomerForFacility(
  facilityId: string,
): Promise<string> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(facilityId)) {
    throw new Error("You do not have permission to access this facility.");
  }

  const { data: facility, error: facilityError } = await supabase
    .from("facilities")
    .select("id, name, phone, stripe_customer_id")
    .eq("id", facilityId)
    .single();

  if (facilityError || !facility) {
    throw new Error("Facility not found.");
  }

  if (facility.stripe_customer_id) {
    return facility.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    name: facility.name,
    email: user.email ?? undefined,
    phone: facility.phone ?? undefined,
    metadata: {
      facility_id: facility.id,
      user_id: user.id,
    },
  });

  const { error: updateError } = await supabase
    .from("facilities")
    .update({
      stripe_customer_id: customer.id,
      stripe_synced_at: new Date().toISOString(),
    })
    .eq("id", facility.id);

  if (updateError) {
    console.error(
      "[ensureStripeCustomerForFacility] DB update error:",
      updateError.message,
    );
    throw new Error("Failed to save Stripe customer.");
  }

  return customer.id;
}

// ── CREATE CHECKOUT SESSION ───────────────────────────────────────────────────

export async function createStripeCheckoutSession(
  orderId: string,
): Promise<string> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    throw new Error("Not authenticated.");
  }

  const { data: rawOrder, error: orderError } = await supabase
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
      payment_status,
      facilities(id, name, stripe_customer_id, phone),
      products(id, name, price)
    `,
    )
    .eq("id", orderId)
    .single();

  if (orderError || !rawOrder) {
    throw new Error("Order not found.");
  }

  const order = rawOrder as unknown as RawCheckoutOrder;

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(order.facility_id)) {
    throw new Error("You do not have permission to access this order.");
  }

  if (order.payment_status === "paid") {
    throw new Error("This order has already been paid.");
  }

  if (order.payment_mode === "net_30" && order.payment_status !== "paid") {
    throw new Error(
      "This order uses Net 30 billing. Please pay through the invoice link.",
    );
  }

  const stripeCustomerId = await ensureStripeCustomerForFacility(
    order.facility_id,
  );

  await stripe.customers.update(stripeCustomerId, {
    email: user.email,
    phone: order.facilities?.phone ?? undefined,
    metadata: {
      facility_id: order.facility_id,
      user_id: user.id,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  }

  const totalAmount = Number(order.amount);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: order.id,
    success_url: `${appUrl}/dashboard/orders?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/orders?payment=cancelled`,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: toCents(totalAmount),
          product_data: {
            name: order.products?.name ?? `Order ${order.order_id}`,
            description: `Order ${order.order_id} • Qty ${order.quantity}`,
            metadata: {
              order_id: order.id,
              product_id: order.product_id,
              facility_id: order.facility_id,
            },
          },
        },
      },
    ],
    metadata: {
      order_id: order.id,
      order_doc_number: order.order_id,
      facility_id: order.facility_id,
      product_id: order.product_id,
      user_id: user.id,
      user_email: user.email,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_provider: "stripe",
      payment_mode: "pay_now",
      payment_status: "unpaid",
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
      stripe_customer_id: stripeCustomerId,
      receipt_email: user.email,
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(
      "[createStripeCheckoutSession] DB update error:",
      updateError.message,
    );
    throw new Error("Failed to save Stripe checkout session.");
  }

  revalidatePath(ORDERS_PATH);
  return session.url;
}

// ── SHIPSTATION MOCK / DEV INTEGRATION ───────────────────────────────────────

export async function shipOrderWithShipStation(orderId: string): Promise<{
  trackingNumber: string;
  carrierCode: string;
  labelUrl: string | null;
  status: string;
  alreadyShipped: boolean;
}> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: rawOrder, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select(
      `
      id,
      created_at,
      order_id,
      facility_id,
      product_id,
      amount,
      quantity,
      payment_mode,
      payment_status,
      status,
      tracking_number,
      carrier_code,
      shipstation_order_id,
      shipstation_shipment_id,
      shipstation_status,
      shipstation_sync_status,
      shipstation_label_url,
      facilities(name, phone),
      products(name, price)
    `,
    )
    .eq("id", orderId)
    .single();

  if (fetchErr || !rawOrder) {
    throw new Error("Order not found.");
  }

  const order = rawOrder as unknown as RawShipStationOrder;

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(order.facility_id)) {
    throw new Error("You do not have permission to update this order.");
  }

  const canFulfill =
    order.payment_status === "paid" || order.payment_mode === "net_30";

  if (!canFulfill) {
    throw new Error("Only paid orders or Net 30 orders can be fulfilled.");
  }

  if (
    order.shipstation_shipment_id &&
    order.tracking_number &&
    order.carrier_code
  ) {
    return {
      trackingNumber: order.tracking_number,
      carrierCode: order.carrier_code,
      labelUrl: order.shipstation_label_url,
      status: order.shipstation_status ?? "label_purchased_mock",
      alreadyShipped: true,
    };
  }

  const shipstation = getShipStationClient();

  const syncedOrder = await shipstation.syncOrder({
    localOrderId: order.id,
    orderNumber: order.order_id,
    createdAt: order.created_at,
    amount: Number(order.amount),
    quantity: Number(order.quantity),
    facilityId: order.facility_id,
    facilityName: order.facilities?.name ?? "Unknown Facility",
    recipientPhone: order.facilities?.phone ?? null,
    productName: order.products?.name ?? `Order ${order.order_id}`,
  });

  const label = await shipstation.purchaseLabel({
    localOrderId: order.id,
    orderNumber: order.order_id,
    amount: Number(order.amount),
    quantity: Number(order.quantity),
    facilityId: order.facility_id,
    facilityName: order.facilities?.name ?? "Unknown Facility",
    productName: order.products?.name ?? `Order ${order.order_id}`,
  });

  const { error: updateErr } = await supabase
    .from(ORDER_TABLE)
    .update({
      status: "Shipped",
      tracking_number: label.trackingNumber,
      carrier_code: label.carrierCode,
      shipstation_order_id: syncedOrder.externalOrderId,
      shipstation_shipment_id: label.shipmentId,
      shipstation_status: label.status,
      shipstation_sync_status: "sent",
      shipstation_label_url: label.labelUrl,
      shipped_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateErr) {
    console.error("[shipOrderWithShipStation] DB error:", updateErr.message);
    throw new Error("Failed to save ShipStation fulfillment data.");
  }

  revalidatePath(ORDERS_PATH);

  return {
    trackingNumber: label.trackingNumber,
    carrierCode: label.carrierCode,
    labelUrl: label.labelUrl,
    status: label.status,
    alreadyShipped: false,
  };
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const status = formData.get("status") as Order["status"];

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, status, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to update this order.");
  }

  const { error: updateErr } = await supabase
    .from(ORDER_TABLE)
    .update({ status })
    .eq("id", orderId);

  if (updateErr) {
    console.error("[updateOrderStatus] DB error:", updateErr.message);
    throw new Error("Failed to update order status.");
  }

  revalidatePath(ORDERS_PATH);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteOrder(orderId: string): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, order_id, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to delete this order.");
  }

  const { error: deleteErr } = await supabase
    .from(ORDER_TABLE)
    .delete()
    .eq("id", orderId);

  if (deleteErr) {
    console.error("[deleteOrder] DB error:", deleteErr.message);
    throw new Error("Failed to delete order from database.");
  }

  revalidatePath(ORDERS_PATH);
}

// ── Dropdown helpers ──────────────────────────────────────────────────────────

export async function getUserFacility(): Promise<Facility | null> {
  try {
    const supabase = await getSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getUserFacility] Auth error:", authError?.message);
      return null;
    }

    const { data, error } = await supabase
      .from("facilities")
      .select(
        "id, name, location, status, stripe_customer_id, stripe_synced_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[getUserFacility] Supabase error:", error.message);
      return null;
    }

    if (!data) {
      console.warn("[getUserFacility] No facility found for user:", user.id);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[getUserFacility] Unexpected error:", err);
    return null;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await dbSelect<Product>({
    table: "products",
    columns: "id, name, price",
    order: { column: "name", ascending: true },
  });

  if (error) {
    console.error("[getAllProducts] Supabase error:", error.message);
    return [];
  }

  return data ?? [];
}
