"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import {
  FACILITY_SELECT,
  FACILITY_TABLE,
  ORDER_ITEMS_TABLE,
  ORDER_TABLE,
  ORDER_WITH_RELATIONS_SELECT,
  ORDERS_PATH,
  PRODUCT_SELECT,
  PRODUCT_TABLE,
  DEFAULT_DELIVERY_STATUS,
  DEFAULT_FULFILLMENT_STATUS,
  DEFAULT_INVOICE_STATUS,
  DEFAULT_ORDER_STATUS,
  DEFAULT_PAYMENT_STATUS,
} from "@/utils/constants/orders";

import {
  calculateOrderAmounts,
  generateOrderNumber,
  getDeliveredAtForStatus,
  getInvoiceStatusForSubmittedPaymentMethod,
  getPaidAtForStatus,
  mapDashboardOrder,
  mapDashboardOrders,
  parseCancelOrderInput,
  parseCreateOrderInput,
  parseEditOrderInput,
  parseSubmitOrderPaymentChoiceInput,
  parseUpdateOrderStatusInput,
  toNullableString,
} from "@/utils/helpers/orders";

import type {
  CancelOrderInput,
  CancelOrderPayload,
  CreateOrderInput,
  DashboardOrder,
  EditOrderInput,
  EditOrderPayload,
  ExistingOrderRecord,
  FacilityRecord,
  InsertOrderItemPayload,
  InsertOrderPayload,
  ProductRecord,
  RawOrderRecord,
  SubmitOrderPaymentChoiceInput,
  SubmitOrderPaymentChoicePayload,
  UpdateOrderStatusInput,
  UpdateOrderStatusPayload,
} from "@/utils/interfaces/orders";
import {
  SupabaseServerClient,
  getCurrentUserOrThrow,
} from "@/lib/supabase/auth";
import {
  createOrderCheckoutSession,
  createOrResumeOrderCheckout,
} from "@/lib/stripe/payments/create-order-checkout-session";
import { createStripeNet30Invoice } from "@/lib/stripe/invoices/create-order-net30-invoice";

async function getUserFacilityRecord(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<FacilityRecord | null> {
  const { data, error } = await supabase
    .from(FACILITY_TABLE)
    .select(FACILITY_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[orders.getUserFacilityRecord] Error:", error);
    throw new Error(error.message || "Failed to fetch your facility.");
  }

  return (data as FacilityRecord | null) ?? null;
}

async function getUserFacilityOrThrow(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<FacilityRecord> {
  const facility = await getUserFacilityRecord(supabase, userId);

  if (!facility) {
    throw new Error("No facility is assigned to your account.");
  }

  if (facility.status !== "active") {
    throw new Error("Your facility is inactive.");
  }

  return facility;
}

async function getProductByIdOrThrow(
  supabase: SupabaseServerClient,
  productId: string,
): Promise<ProductRecord> {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq("id", productId)
    .single();

  if (error || !data) {
    console.error("[orders.getProductByIdOrThrow] Error:", error);
    throw new Error("Selected product was not found.");
  }

  const product = data as ProductRecord;

  if (!product.is_active) {
    throw new Error("Selected product is inactive.");
  }

  if (!product.sku?.trim()) {
    throw new Error("Selected product is missing a SKU.");
  }

  return product;
}

async function getFacilityOwnedOrderByIdOrThrow(
  supabase: SupabaseServerClient,
  orderId: string,
  facilityId: string,
): Promise<ExistingOrderRecord> {
  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .select(
      `
      id,
      facility_id,
      order_status,
      payment_method,
      payment_status,
      invoice_status,
      fulfillment_status,
      delivery_status,
      tracking_number,
      notes,
      paid_at,
      delivered_at
    `,
    )
    .eq("id", orderId)
    .eq("facility_id", facilityId)
    .single();

  if (error || !data) {
    console.error("[orders.getFacilityOwnedOrderByIdOrThrow] Error:", error);
    throw new Error("Order was not found.");
  }

  return data as ExistingOrderRecord;
}

async function getFacilityOwnedDashboardOrderByIdOrThrow(
  supabase: SupabaseServerClient,
  orderId: string,
  facilityId: string,
): Promise<DashboardOrder> {
  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("id", orderId)
    .eq("facility_id", facilityId)
    .single();

  if (error || !data) {
    console.error(
      "[orders.getFacilityOwnedDashboardOrderByIdOrThrow] Error:",
      error,
    );
    throw new Error("Order was not found.");
  }

  return mapDashboardOrder(data as unknown as RawOrderRecord);
}

export async function getUserFacility(): Promise<FacilityRecord | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  return getUserFacilityRecord(supabase, user.id);
}

export async function getActiveProducts(): Promise<ProductRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[getActiveProducts] Error:", error);
    throw new Error(error.message || "Failed to fetch products.");
  }

  return (data ?? []) as ProductRecord[];
}

export async function getAllOrders(): Promise<DashboardOrder[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const facility = await getUserFacilityRecord(supabase, user.id);

  if (!facility) {
    return [];
  }

  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("facility_id", facility.id)
    .order("placed_at", { ascending: false });

  if (error) {
    console.error("[getAllOrders] Error:", error);
    throw new Error(error.message || "Failed to fetch orders.");
  }

  return mapDashboardOrders((data ?? []) as unknown as RawOrderRecord[]);
}

export async function createOrder(
  input: FormData | CreateOrderInput,
): Promise<DashboardOrder> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const parsed = parseCreateOrderInput(input);

  const facility = await getUserFacilityOrThrow(supabase, user.id);
  const product = await getProductByIdOrThrow(supabase, parsed.product_id);
  const amounts = calculateOrderAmounts(product.unit_price, parsed.quantity);

  const orderPayload: InsertOrderPayload = {
    order_number: generateOrderNumber(),
    facility_id: facility.id,
    order_status: DEFAULT_ORDER_STATUS,
    payment_method: null,
    payment_status: DEFAULT_PAYMENT_STATUS,
    invoice_status: DEFAULT_INVOICE_STATUS,
    fulfillment_status: DEFAULT_FULFILLMENT_STATUS,
    delivery_status: DEFAULT_DELIVERY_STATUS,
    tracking_number: null,
    notes: toNullableString(parsed.notes),
    placed_at: new Date().toISOString(),
    paid_at: null,
    delivered_at: null,
  };

  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .insert(orderPayload)
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createOrder] Order insert error:", error);
    throw new Error(error?.message || "Failed to create draft order.");
  }

  const itemPayload: InsertOrderItemPayload = {
    order_id: data.id,
    product_id: product.id,
    product_name: product.name,
    product_sku: product.sku,
    unit_price: amounts.unit_price,
    quantity: parsed.quantity,
    shipping_amount: amounts.shipping_amount,
    tax_amount: amounts.tax_amount,
  };

  const { error: itemError } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .insert(itemPayload);

  if (itemError) {
    console.error("[createOrder] Order item insert error:", itemError);
    // Roll back the order row so we don't leave orphaned records
    await supabase.from(ORDER_TABLE).delete().eq("id", data.id);
    throw new Error(itemError.message || "Failed to create order item.");
  }

  revalidatePath(ORDERS_PATH);

  return getFacilityOwnedDashboardOrderByIdOrThrow(
    supabase,
    data.id,
    facility.id,
  );
}

export async function deleteOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const facility = await getUserFacilityOrThrow(supabase, user.id);
  const existing = await getFacilityOwnedOrderByIdOrThrow(
    supabase,
    orderId,
    facility.id,
  );

  if (existing.order_status === "canceled") {
    throw new Error("Canceled orders cannot be deleted.");
  }

  if (
    existing.payment_status === "paid" ||
    existing.payment_status === "refunded" ||
    existing.payment_status === "partially_refunded"
  ) {
    throw new Error("Paid or refunded orders cannot be deleted.");
  }

  if (existing.invoice_status !== "not_applicable") {
    throw new Error("Orders with invoices cannot be deleted.");
  }

  const { error } = await supabase
    .from(ORDER_TABLE)
    .delete()
    .eq("id", orderId)
    .eq("facility_id", facility.id);

  if (error) {
    console.error("[deleteOrder] Error:", error);
    throw new Error(error.message || "Failed to delete order.");
  }

  revalidatePath(ORDERS_PATH);
}

export async function submitOrderPaymentChoice(
  input: FormData | SubmitOrderPaymentChoiceInput,
): Promise<DashboardOrder> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const parsed = parseSubmitOrderPaymentChoiceInput(input);

  const facility = await getUserFacilityOrThrow(supabase, user.id);

  const { data: membership } = await supabase
    .from("facility_members")
    .select("can_sign_orders")
    .eq("user_id", user.id)
    .eq("facility_id", facility.id)
    .single();

  if (!membership?.can_sign_orders) {
    throw new Error("You are not authorized to sign orders.");
  }

  const existing = await getFacilityOwnedOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );

  if (existing.order_status === "canceled") {
    throw new Error("Canceled orders cannot be submitted.");
  }

  if (existing.order_status === "submitted") {
    if (existing.payment_method === parsed.payment_method) {
      return getFacilityOwnedDashboardOrderByIdOrThrow(
        supabase,
        parsed.id,
        facility.id,
      );
    }

    throw new Error("This order has already been submitted.");
  }

  const payload: SubmitOrderPaymentChoicePayload = {
    order_status: "submitted",
    payment_method: parsed.payment_method,
    payment_status: "pending",
    invoice_status: getInvoiceStatusForSubmittedPaymentMethod(
      parsed.payment_method,
    ),
  };

  const { error } = await supabase
    .from(ORDER_TABLE)
    .update(payload)
    .eq("id", parsed.id)
    .eq("facility_id", facility.id);

  if (error) {
    console.error("[submitOrderPaymentChoice] Error:", error);
    throw new Error(error.message || "Failed to submit payment choice.");
  }

  revalidatePath(ORDERS_PATH);

  return getFacilityOwnedDashboardOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );
}

export async function updateOrderStatus(
  input: FormData | UpdateOrderStatusInput,
): Promise<DashboardOrder> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const parsed = parseUpdateOrderStatusInput(input);

  const facility = await getUserFacilityOrThrow(supabase, user.id);
  const existing = await getFacilityOwnedOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );

  if (existing.order_status === "draft") {
    throw new Error(
      "Draft orders must be submitted before their statuses can be updated.",
    );
  }

  if (existing.order_status === "canceled") {
    throw new Error("Canceled orders cannot be updated.");
  }

  const nextPaymentStatus = parsed.payment_status ?? existing.payment_status;
  const nextInvoiceStatus = parsed.invoice_status ?? existing.invoice_status;
  const nextFulfillmentStatus =
    parsed.fulfillment_status ?? existing.fulfillment_status;
  const nextDeliveryStatus = parsed.delivery_status ?? existing.delivery_status;
  const nextTrackingNumber =
    parsed.tracking_number !== undefined
      ? toNullableString(parsed.tracking_number)
      : existing.tracking_number;

  const payload: UpdateOrderStatusPayload = {
    payment_status: nextPaymentStatus,
    invoice_status: nextInvoiceStatus,
    fulfillment_status: nextFulfillmentStatus,
    delivery_status: nextDeliveryStatus,
    tracking_number: nextTrackingNumber,
    paid_at:
      parsed.payment_status !== undefined
        ? getPaidAtForStatus(nextPaymentStatus, existing.paid_at)
        : existing.paid_at,
    delivered_at:
      parsed.delivery_status !== undefined
        ? getDeliveredAtForStatus(nextDeliveryStatus, existing.delivered_at)
        : existing.delivered_at,
    ...(Object.prototype.hasOwnProperty.call(parsed, "notes")
      ? { notes: toNullableString(parsed.notes) }
      : {}),
  };

  const { error } = await supabase
    .from(ORDER_TABLE)
    .update(payload)
    .eq("id", parsed.id)
    .eq("facility_id", facility.id);

  if (error) {
    console.error("[updateOrderStatus] Error:", error);
    throw new Error(error.message || "Failed to update order status.");
  }

  revalidatePath(ORDERS_PATH);

  return getFacilityOwnedDashboardOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );
}

export async function editOrder(
  input: FormData | EditOrderInput,
): Promise<DashboardOrder> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const parsed = parseEditOrderInput(input);

  const facility = await getUserFacilityOrThrow(supabase, user.id);
  const existing = await getFacilityOwnedOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );

  if (existing.order_status === "canceled") {
    throw new Error("Canceled orders cannot be edited.");
  }

  if (
    existing.payment_status === "paid" ||
    existing.payment_status === "refunded" ||
    existing.payment_status === "partially_refunded"
  ) {
    throw new Error("Paid or refunded orders cannot be edited.");
  }

  if (existing.invoice_status !== "not_applicable") {
    throw new Error("Orders with invoices cannot be edited.");
  }

  const product = await getProductByIdOrThrow(supabase, parsed.product_id);
  const amounts = calculateOrderAmounts(product.unit_price, parsed.quantity);

  const payload: EditOrderPayload = {
    product_id: product.id,
    product_name: product.name,
    product_sku: product.sku,
    quantity: parsed.quantity,
    unit_price: amounts.unit_price,
    shipping_amount: amounts.shipping_amount,
    tax_amount: amounts.tax_amount,
  };

  const { error } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .update(payload)
    .eq("order_id", parsed.id);

  if (error) {
    console.error("[editOrder] Error:", error);
    throw new Error(error.message || "Failed to edit order.");
  }

  revalidatePath(ORDERS_PATH);

  return getFacilityOwnedDashboardOrderByIdOrThrow(
    supabase,
    parsed.id,
    facility.id,
  );
}

export async function createOrderCheckout(orderId: string) {
  return createOrResumeOrderCheckout(orderId);
}

export async function startOrderNet30(
  orderId: string,
): Promise<DashboardOrder> {
  return createStripeNet30Invoice(orderId);
}
