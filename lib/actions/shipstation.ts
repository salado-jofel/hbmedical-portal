"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { getShipStationClient } from "../shipstation/server";
import type {
  ShipStationPaymentMode,
  ShipStationPaymentStatus,
} from "../shipstation/types";

const ORDERS_PATH = "/dashboard/orders";
const DEFAULT_ORDER_STATUS = "awaiting_shipment";
const DEFAULT_LOCAL_STATUS = "Processing";

export type ShipStationSyncStatus = "ready" | "syncing" | "sent" | "failed";

export type SyncPaidOrderToShipStationResult = {
  alreadySynced: boolean;
  shipstationOrderId: string | null;
  shipstationStatus: string | null;
  syncStatus: ShipStationSyncStatus | null;
};

type AdminShipStationOrderRow = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number | string;
  quantity: number | null;
  receipt_email: string | null;
  payment_mode: ShipStationPaymentMode | null;
  payment_status: ShipStationPaymentStatus | null;
  stripe_invoice_id: string | null;
  status: string | null;

  tracking_number: string | null;
  carrier_code: string | null;
  shipstation_order_id: string | null;
  shipstation_shipment_id: string | null;
  shipstation_status: string | null;
  shipstation_sync_status: string | null;
  shipstation_label_url: string | null;
  shipped_at: string | null;

  facilities: {
    name: string | null;
    phone: string | null;
    location: string | null;
  } | null;

  products: {
    name: string | null;
    price: number | string | null;
  } | null;
};

function isMockLikeValue(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith("mock-") ||
    normalized.includes("/mock-label/") ||
    normalized.includes("mock-usps") ||
    normalized.includes("label_purchased_mock")
  );
}

function hasLegacyMockArtifacts(order: AdminShipStationOrderRow) {
  return (
    isMockLikeValue(order.tracking_number) ||
    isMockLikeValue(order.carrier_code) ||
    isMockLikeValue(order.shipstation_order_id) ||
    isMockLikeValue(order.shipstation_shipment_id) ||
    isMockLikeValue(order.shipstation_label_url) ||
    (order.status ?? "").trim().toLowerCase() === "shipped"
  );
}

function getNextLocalStatus(order: AdminShipStationOrderRow) {
  if (hasLegacyMockArtifacts(order) && order.status === "Shipped") {
    return DEFAULT_LOCAL_STATUS;
  }

  return order.status ?? DEFAULT_LOCAL_STATUS;
}

export async function syncOrderToShipStation(
  orderId: string,
): Promise<SyncPaidOrderToShipStationResult> {
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
      receipt_email,
      payment_mode,
      payment_status,
      stripe_invoice_id,
      status,
      tracking_number,
      carrier_code,
      shipstation_order_id,
      shipstation_shipment_id,
      shipstation_status,
      shipstation_sync_status,
      shipstation_label_url,
      shipped_at,
      facilities(name, phone, location),
      products(name, price)
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !rawOrder) {
    throw new Error("Order not found");
  }

  const order = rawOrder as unknown as AdminShipStationOrderRow;

  const canSyncToShipStation =
    order.payment_status === "paid" ||
    (order.payment_mode === "net_30" && !!order.stripe_invoice_id);

  if (!canSyncToShipStation) {
    throw new Error(
      "Order must be paid or have a Net 30 invoice before syncing to ShipStation",
    );
  }

  const hasRealSyncedOrder =
    !!order.shipstation_order_id &&
    order.shipstation_sync_status === "sent" &&
    !isMockLikeValue(order.shipstation_order_id);

  if (hasRealSyncedOrder) {
    return {
      alreadySynced: true,
      shipstationOrderId: order.shipstation_order_id,
      shipstationStatus: order.shipstation_status ?? DEFAULT_ORDER_STATUS,
      syncStatus: "sent",
    };
  }

  const { error: markSyncingError } = await supabaseAdmin
    .from("orders")
    .update({
      shipstation_sync_status: "syncing",
    })
    .eq("id", order.id);

  if (markSyncingError) {
    throw new Error(markSyncingError.message);
  }

  try {
    const shipstation = getShipStationClient();

    const syncedOrder = await shipstation.syncOrder({
      localOrderId: order.id,
      orderNumber: order.order_id,
      createdAt: order.created_at,
      amount: Number(order.amount ?? 0),
      quantity: Number(order.quantity ?? 1),
      facilityId: order.facility_id,
      facilityName: order.facilities?.name ?? "Unknown Facility",
      facilityContact: order.facilities?.name ?? null,
      facilityLocation: order.facilities?.location ?? null,
      recipientPhone: order.facilities?.phone ?? null,
      receiptEmail: order.receipt_email ?? null,
      productName: order.products?.name ?? `Order ${order.order_id}`,
      paymentMode: order.payment_mode,
      paymentStatus: order.payment_status,
      existingShipStationOrderId: null,
      existingShipStationOrderKey: null,
    });

    const clearLegacyMockFields = hasLegacyMockArtifacts(order);

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        shipstation_order_id: syncedOrder.externalOrderId,
        shipstation_status: syncedOrder.status ?? DEFAULT_ORDER_STATUS,
        shipstation_sync_status: "sent",

        tracking_number: clearLegacyMockFields ? null : order.tracking_number,
        carrier_code: clearLegacyMockFields ? null : order.carrier_code,
        shipstation_shipment_id: clearLegacyMockFields
          ? null
          : order.shipstation_shipment_id,
        shipstation_label_url: clearLegacyMockFields
          ? null
          : order.shipstation_label_url,
        shipped_at: clearLegacyMockFields ? null : order.shipped_at,

        status: getNextLocalStatus(order),
      })
      .eq("id", order.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(ORDERS_PATH);

    return {
      alreadySynced: false,
      shipstationOrderId: syncedOrder.externalOrderId,
      shipstationStatus: syncedOrder.status ?? DEFAULT_ORDER_STATUS,
      syncStatus: "sent",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to sync order to ShipStation";

    await supabaseAdmin
      .from("orders")
      .update({
        shipstation_sync_status: "failed",
      })
      .eq("id", order.id);

    revalidatePath(ORDERS_PATH);
    throw new Error(message);
  }
}

export const syncPaidOrderToShipStation = syncOrderToShipStation;

export async function markOrderDeliveredViaShipStation(orderId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, shipstation_order_id")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Order not found");
  }

  if (
    !order.shipstation_order_id ||
    isMockLikeValue(order.shipstation_order_id)
  ) {
    throw new Error("Missing valid ShipStation order ID");
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "Delivered",
      delivered_at: now,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(ORDERS_PATH);

  return {
    success: true,
    orderId: order.id,
    status: "Delivered",
  };
}
