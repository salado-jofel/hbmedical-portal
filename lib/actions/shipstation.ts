"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { getShipStationClient } from "../shipstation/server";

const ORDERS_PATH = "/dashboard/orders";

type AdminShipStationOrderRow = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number;
  payment_status:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "canceled"
    | "refunded"
    | null;
  status: string;
  tracking_number: string | null;
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

export async function syncPaidOrderToShipStation(orderId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: rawOrder, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      created_at,
      order_id,
      facility_id,
      product_id,
      amount,
      quantity,
      payment_status,
      status,
      tracking_number,
      carrier_code,
      shipstation_order_id,
      shipstation_shipment_id,
      shipstation_status,
      shipstation_label_url,
      facilities(name, phone),
      products(name, price)
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !rawOrder) {
    throw new Error("Order not found");
  }

  const order = rawOrder as unknown as AdminShipStationOrderRow;

  if (order.payment_status !== "paid") {
    throw new Error("Order must be paid before syncing to ShipStation");
  }

  if (order.shipstation_order_id) {
    return {
      alreadySynced: true,
      shipstationOrderId: order.shipstation_order_id,
      status: order.shipstation_status ?? "awaiting_shipment",
    };
  }

  const shipstation = getShipStationClient();

  const result = await shipstation.syncOrder({
    localOrderId: order.id,
    orderNumber: order.order_id,
    createdAt: order.created_at,
    amount: Number(order.amount ?? 0),
    quantity: Number(order.quantity ?? 1),
    facilityId: order.facility_id,
    facilityName: order.facilities?.name ?? "Unknown Facility",
    recipientPhone: order.facilities?.phone ?? null,
    productName: order.products?.name ?? `Order ${order.order_id}`,
  });

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      shipstation_order_id: result.externalOrderId,
      shipstation_status: result.status,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(ORDERS_PATH);

  return {
    alreadySynced: false,
    shipstationOrderId: result.externalOrderId,
    status: result.status,
  };
}

export async function markOrderDeliveredViaShipStation(orderId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: rawOrder, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      created_at,
      order_id,
      facility_id,
      product_id,
      amount,
      quantity,
      payment_status,
      status,
      tracking_number,
      carrier_code,
      shipstation_order_id,
      shipstation_shipment_id,
      shipstation_status,
      shipstation_label_url,
      facilities(name, phone),
      products(name, price)
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !rawOrder) {
    throw new Error("Order not found");
  }

  const order = rawOrder as unknown as AdminShipStationOrderRow;

  if (order.payment_status !== "paid") {
    throw new Error("Order must be paid before fulfillment");
  }

  if (
    order.shipstation_shipment_id &&
    order.tracking_number &&
    order.carrier_code
  ) {
    return {
      alreadyFulfilled: true,
      shipmentId: order.shipstation_shipment_id,
      trackingNumber: order.tracking_number,
      carrierCode: order.carrier_code,
      labelUrl: order.shipstation_label_url,
      status: order.shipstation_status ?? "label_purchased_mock",
    };
  }

  const shipstation = getShipStationClient();

  let shipstationOrderId = order.shipstation_order_id;
  let shipstationStatus = order.shipstation_status ?? "awaiting_shipment";

  if (!shipstationOrderId) {
    const syncResult = await shipstation.syncOrder({
      localOrderId: order.id,
      orderNumber: order.order_id,
      createdAt: order.created_at,
      amount: Number(order.amount ?? 0),
      quantity: Number(order.quantity ?? 1),
      facilityId: order.facility_id,
      facilityName: order.facilities?.name ?? "Unknown Facility",
      recipientPhone: order.facilities?.phone ?? null,
      productName: order.products?.name ?? `Order ${order.order_id}`,
    });

    shipstationOrderId = syncResult.externalOrderId;
    shipstationStatus = syncResult.status;
  }

  const label = await shipstation.purchaseLabel({
    localOrderId: order.id,
    orderNumber: order.order_id,
    amount: Number(order.amount ?? 0),
    quantity: Number(order.quantity ?? 1),
    facilityId: order.facility_id,
    facilityName: order.facilities?.name ?? "Unknown Facility",
    productName: order.products?.name ?? `Order ${order.order_id}`,
  });

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "Delivered",
      tracking_number: label.trackingNumber,
      carrier_code: label.carrierCode,
      shipstation_order_id: shipstationOrderId,
      shipstation_shipment_id: label.shipmentId,
      shipstation_status: label.status || shipstationStatus,
      shipstation_label_url: label.labelUrl,
      shipped_at: now,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(ORDERS_PATH);

  return {
    alreadyFulfilled: false,
    shipmentId: label.shipmentId,
    trackingNumber: label.trackingNumber,
    carrierCode: label.carrierCode,
    labelUrl: label.labelUrl,
    status: label.status,
  };
}
