"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, dbSelect } from "@/utils/supabase/db";
import { stripe } from "@/utils/stripe/server";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";
import { createStripeNet30Invoice as createStripeNet30InvoiceService } from "./create-stripe-net30-invoice";
import { syncPaidOrderToShipStation } from "@/lib/actions/shipstation";

const ORDER_TABLE = "orders";
const ORDERS_PATH = "/dashboard/orders";

const ORDER_COLUMNS = `
  id,
  created_at,
  order_id,
  facility_id,
  product_id,
  amount,
  quantity,
  status,
  user_id,
  payment_provider,
  payment_mode,
  payment_status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_invoice_id,
  stripe_checkout_url,
  stripe_customer_id,
  stripe_invoice_number,
  stripe_invoice_status,
  stripe_invoice_hosted_url,
  receipt_email,
  stripe_receipt_url,
  paid_at,
  invoice_due_date,
  invoice_sent_at,
  invoice_paid_at,
  invoice_amount_due,
  invoice_amount_remaining,
  tracking_number,
  carrier_code,
  shipstation_sync_status,
  shipstation_order_id,
  shipstation_shipment_id,
  shipstation_status,
  shipstation_label_url,
  shipped_at,
  facilities(name, stripe_customer_id, phone),
  products(name, price)
`;

type RawOrder = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  status: string;
  user_id?: string | null;

  payment_provider?: "stripe" | null;
  payment_mode?: "pay_now" | "net_30" | null;
  payment_status?:
    | "paid"
    | "unpaid"
    | "invoice_sent"
    | "overdue"
    | "payment_failed"
    | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_checkout_url?: string | null;
  stripe_customer_id?: string | null;

  stripe_invoice_number?: string | null;
  stripe_invoice_status?: string | null;
  stripe_invoice_hosted_url?: string | null;

  receipt_email?: string | null;
  stripe_receipt_url?: string | null;

  paid_at?: string | null;
  invoice_due_date?: string | null;
  invoice_sent_at?: string | null;
  invoice_paid_at?: string | null;
  invoice_amount_due?: number | null;
  invoice_amount_remaining?: number | null;

  tracking_number?: string | null;
  carrier_code?: string | null;
  shipstation_sync_status?: string | null;
  shipstation_order_id?: string | null;
  shipstation_shipment_id?: string | null;
  shipstation_status?: string | null;
  shipstation_label_url?: string | null;
  shipped_at?: string | null;

  facilities?: {
    name?: string | null;
    stripe_customer_id?: string | null;
    phone?: string | null;
  } | null;

  products?: {
    name?: string | null;
    price?: number | string | null;
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
    | "paid"
    | "unpaid"
    | "invoice_sent"
    | "overdue"
    | "payment_failed"
    | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  stripe_invoice_id: string | null;
  facilities: {
    id?: string;
    name?: string | null;
    stripe_customer_id?: string | null;
    phone?: string | null;
  } | null;
  products: {
    id?: string;
    name?: string | null;
    price?: number | string | null;
  } | null;
};

function flattenOrder(row: RawOrder): Order {
  return {
    id: row.id,
    created_at: row.created_at,
    order_id: row.order_id,
    facility_id: row.facility_id,
    product_id: row.product_id,
    amount: Number(row.amount ?? 0),
    quantity: row.quantity ?? 1,
    status: row.status as Order["status"],
    facility_name: row.facilities?.name ?? "—",
    product_name: row.products?.name ?? "—",

    payment_provider: row.payment_provider ?? "stripe",
    payment_mode: row.payment_mode ?? null,
    payment_status: row.payment_status ?? "unpaid",

    stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
    stripe_invoice_id: row.stripe_invoice_id ?? null,
    stripe_checkout_url: row.stripe_checkout_url ?? null,
    stripe_customer_id: row.stripe_customer_id ?? null,

    stripe_invoice_number: row.stripe_invoice_number ?? null,
    stripe_invoice_status: row.stripe_invoice_status ?? null,
    stripe_invoice_hosted_url: row.stripe_invoice_hosted_url ?? null,

    receipt_email: row.receipt_email ?? null,
    stripe_receipt_url: row.stripe_receipt_url ?? null,

    paid_at: row.paid_at ?? null,
    invoice_due_date: row.invoice_due_date ?? null,
    invoice_sent_at: row.invoice_sent_at ?? null,
    invoice_paid_at: row.invoice_paid_at ?? null,
    invoice_amount_due: row.invoice_amount_due ?? null,
    invoice_amount_remaining: row.invoice_amount_remaining ?? null,

    tracking_number: row.tracking_number ?? null,
    carrier_code: row.carrier_code ?? null,
    shipstation_sync_status: row.shipstation_sync_status ?? null,
    shipstation_order_id: row.shipstation_order_id ?? null,
    shipstation_shipment_id: row.shipstation_shipment_id ?? null,
    shipstation_status: row.shipstation_status ?? null,
    shipstation_label_url: row.shipstation_label_url ?? null,
    shipped_at: row.shipped_at ?? null,
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

  return (data ?? []).map((row) => row.id);
}

function toCents(amount: number) {
  return Math.round(amount * 100);
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

  const order_id = String(formData.get("order_id") ?? "").trim();
  const facility_id = String(formData.get("facility_id") ?? "").trim();
  const product_id = String(formData.get("product_id") ?? "").trim();
  const quantity = Math.max(
    1,
    parseInt(String(formData.get("quantity") ?? "1"), 10) || 1,
  );

  if (!order_id) throw new Error("Order number is required.");
  if (!facility_id) throw new Error("Facility is required.");
  if (!product_id) throw new Error("Product is required.");

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
      user_id: user.id,

      payment_provider: "stripe",
      payment_mode: null,
      payment_status: "unpaid",

      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_invoice_id: null,
      stripe_checkout_url: null,
      paid_at: null,
      receipt_email: user.email ?? null,
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

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: rawOrder, error: orderError } = await supabase
    .from(ORDER_TABLE)
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
      stripe_checkout_session_id,
      stripe_checkout_url,
      stripe_invoice_id,
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

  if (order.payment_mode === "net_30" && order.stripe_invoice_id) {
    throw new Error(
      "This order already has a Net 30 invoice. Use the invoice link instead.",
    );
  }

  if (
    order.payment_mode === "pay_now" &&
    order.stripe_checkout_url &&
    order.stripe_checkout_session_id
  ) {
    return order.stripe_checkout_url;
  }

  const stripeCustomerId = await ensureStripeCustomerForFacility(
    order.facility_id,
  );

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
              order_db_id: order.id,
              order_number: order.order_id,
              product_id: order.product_id,
              facility_id: order.facility_id,
            },
          },
        },
      },
    ],
    metadata: {
      order_id: order.id,
      order_db_id: order.id,
      order_number: order.order_id,
      facility_id: order.facility_id,
      product_id: order.product_id,
      user_id: user.id,
      payment_mode: "pay_now",
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  const { error: updateError } = await supabase
    .from(ORDER_TABLE)
    .update({
      payment_provider: "stripe",
      payment_mode: "pay_now",
      payment_status: "unpaid",
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
      stripe_customer_id: stripeCustomerId,
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

// ── NET 30 WRAPPER ────────────────────────────────────────────────────────────

export async function createStripeNet30Invoice(
  orderId: string,
): Promise<Order> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  await createStripeNet30InvoiceService(orderId);

  let { data: rawOrder, error: orderError } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .single();

  if (orderError || !rawOrder) {
    console.error(
      "[createStripeNet30Invoice] Fetch updated order error:",
      orderError?.message,
    );
    throw new Error(
      "Invoice created but updated order could not be retrieved.",
    );
  }

  const order = rawOrder as unknown as RawOrder;

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(order.facility_id)) {
    throw new Error("You do not have permission to access this order.");
  }

  if (
    order.payment_mode === "net_30" &&
    order.stripe_invoice_id &&
    !order.shipstation_shipment_id
  ) {
    try {
      await syncPaidOrderToShipStation(order.id);
    } catch (shipstationError) {
      console.error(
        "[createStripeNet30Invoice] ShipStation sync failed:",
        shipstationError,
      );

      await supabase
        .from(ORDER_TABLE)
        .update({
          shipstation_sync_status: "failed",
        })
        .eq("id", order.id);
    }

    const refetch = await supabase
      .from(ORDER_TABLE)
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .single();

    rawOrder = refetch.data ?? rawOrder;
    orderError = refetch.error ?? null;

    if (orderError || !rawOrder) {
      console.error(
        "[createStripeNet30Invoice] Refetch after ShipStation sync failed:",
        orderError?.message,
      );
      throw new Error(
        "Invoice created, but final order state could not be retrieved.",
      );
    }
  }

  revalidatePath(ORDERS_PATH);
  return flattenOrder(rawOrder as unknown as RawOrder);
}

export type ShipOrderWithShipStationResult = {
  alreadyShipped: boolean;
  carrierCode: string;
  trackingNumber: string;
};

export async function shipOrderWithShipStation(
  orderId: string,
): Promise<ShipOrderWithShipStationResult> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select(
      `
      id,
      order_id,
      facility_id,
      payment_mode,
      payment_status,
      stripe_invoice_id,
      tracking_number,
      carrier_code,
      shipstation_sync_status,
      shipstation_order_id,
      shipstation_shipment_id,
      shipstation_status,
      shipstation_label_url,
      shipped_at
    `,
    )
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) {
    throw new Error("Order not found.");
  }

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to access this order.");
  }

  const canShip =
    current.payment_status === "paid" ||
    (current.payment_mode === "net_30" && !!current.stripe_invoice_id);

  if (!canShip) {
    throw new Error(
      "Only paid orders or Net 30 invoiced orders can be synced to ShipStation.",
    );
  }

  if (current.shipstation_shipment_id && current.tracking_number) {
    return {
      alreadyShipped: true,
      carrierCode: current.carrier_code ?? "mock-ups",
      trackingNumber: current.tracking_number,
    };
  }

  const trackingNumber = `MOCK-${current.order_id}-${Date.now().toString().slice(-6)}`;
  const carrierCode = "mock-ups";
  const shippedAt = new Date().toISOString();
  const mockShipmentId = `mock-shipment-${current.id}`;
  const mockOrderId = `mock-order-${current.id}`;
  const mockLabelUrl = `https://example.com/mock-label/${current.order_id}`;

  const { error: updateErr } = await supabase
    .from(ORDER_TABLE)
    .update({
      status: "Shipped",
      shipstation_sync_status: "sent",
      shipstation_order_id: mockOrderId,
      shipstation_shipment_id: mockShipmentId,
      shipstation_status: "label_purchased",
      tracking_number: trackingNumber,
      carrier_code: carrierCode,
      shipstation_label_url: mockLabelUrl,
      shipped_at: shippedAt,
    })
    .eq("id", orderId);

  if (updateErr) {
    console.error("[shipOrderWithShipStation] DB error:", updateErr.message);
    throw new Error("Failed to sync mock ShipStation shipment.");
  }

  revalidatePath(ORDERS_PATH);

  return {
    alreadyShipped: false,
    carrierCode,
    trackingNumber,
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

// ── DROPDOWN HELPERS ──────────────────────────────────────────────────────────

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

    return data as Facility;
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
