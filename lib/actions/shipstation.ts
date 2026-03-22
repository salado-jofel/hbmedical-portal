"use server";

import { getShipStationService } from "@/lib/shipstation";
import { createAdminClient } from "@/utils/supabase/admin";

export async function syncPaidOrderToShipStation(orderId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Order not found");
  }

  if (order.payment_status !== "paid") {
    throw new Error("Order must be paid before syncing to ShipStation");
  }

  const shipstation = getShipStationService();

  const result = await shipstation.createShipment({
    orderId: order.id,
    orderNumber: order.order_doc_number ?? order.id,
    customerName: order.customer_name ?? "Customer",
    customerPhone: order.customer_phone ?? "",
    address1: order.address_line1 ?? "Unknown",
    city: order.city ?? "Unknown",
    state: order.state ?? "Unknown",
    postalCode: order.postal_code ?? "00000",
    countryCode: order.country_code ?? "US",
    productName: order.product_name ?? "Product",
    quantity: Number(order.quantity ?? 1),
    unitPrice: Number(order.total_amount ?? order.price ?? 0),
  });

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      shipstation_sync_status: "sent",
      shipstation_shipment_id: result.shipmentId ?? null,
      shipstation_raw: result.raw,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return result;
}

export async function markOrderDeliveredViaShipStation(orderId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Order not found");
  }

  if (order.payment_status !== "paid") {
    throw new Error("Order must be paid before fulfillment");
  }

  if (!order.shipstation_shipment_id) {
    throw new Error("Missing ShipStation shipment ID");
  }

  const shipstation = getShipStationService();
  const trackingNumber = order.tracking_number || `MOCK-${Date.now()}`;
  const carrierCode = order.carrier_code || "mock-carrier";

  const result = await shipstation.createFulfillment({
    shipmentId: order.shipstation_shipment_id,
    trackingNumber,
    carrierCode,
  });

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "Delivered",
      shipstation_sync_status: "fulfilled",
      shipstation_fulfillment_id: result.fulfillmentId ?? null,
      tracking_number: trackingNumber,
      carrier_code: carrierCode,
      shipped_at: now,
      delivered_at: now,
      shipstation_raw: result.raw,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return result;
}
