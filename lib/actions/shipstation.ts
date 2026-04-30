"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSupport } from "@/utils/helpers/role";
import { getShipStationClient } from "../shipstation/server";
import type {
  ShipStationPaymentMode,
  ShipStationPaymentStatus,
} from "../shipstation/types";

async function requireShipStationRole(): Promise<void> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSupport(role)) {
    throw new Error("Only admins and support staff can perform ShipStation actions.");
  }
}

const ORDERS_PATH = "/dashboard/orders";

export type ShipStationSyncStatus = "ready" | "syncing" | "sent" | "failed";

export type SyncPaidOrderToShipStationResult = {
  alreadySynced: boolean;
  shipstationOrderId: string | null;
  shipstationStatus: string | null;
  syncStatus: ShipStationSyncStatus | null;
};

type OrderForShipStation = {
  id: string;
  order_number: string;
  created_at: string;
  facility_id: string;
  payment_method: ShipStationPaymentMode | null;
  payment_status: string;
  invoice_status: string;
  order_items: Array<{
    product_name: string | null;
    quantity: number;
    total_amount: number;
  }>;
  facilities: {
    name: string | null;
    phone: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
};

type ShipmentRow = {
  id: string;
  shipstation_order_id: string | null;
  status: string | null;
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

function mapToShipStationPaymentStatus(
  order: OrderForShipStation,
): ShipStationPaymentStatus {
  if (order.payment_status === "paid") return "paid";
  if (order.payment_status === "failed") return "payment_failed";
  if (
    order.payment_method === "net_30" &&
    order.invoice_status !== "not_applicable"
  ) {
    if (order.invoice_status === "overdue") return "overdue";
    return "invoice_sent";
  }
  return "unpaid";
}

export async function syncOrderToShipStation(
  orderId: string,
): Promise<SyncPaidOrderToShipStationResult> {
  await requireShipStationRole();
  const admin = createAdminClient();

  const { data: rawOrder, error } = await admin
    .from("orders")
    .select(
      `
      id,
      order_number,
      created_at,
      facility_id,
      payment_method,
      payment_status,
      invoice_status,
      order_items (
        product_name,
        quantity,
        total_amount
      ),
      facilities (
        name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !rawOrder) {
    throw new Error("Order not found");
  }

  const order = rawOrder as unknown as OrderForShipStation;

  const canSyncToShipStation =
    order.payment_status === "paid" ||
    (order.payment_method === "net_30" &&
      order.invoice_status !== "not_applicable");

  if (!canSyncToShipStation) {
    throw new Error(
      "Order must be paid or have a Net 30 invoice before syncing to ShipStation",
    );
  }

  // Check for existing shipment record
  const { data: existingShipment } = await admin
    .from("shipments")
    .select("id, shipstation_order_id, status")
    .eq("order_id", orderId)
    .maybeSingle<ShipmentRow>();

  if (
    existingShipment?.shipstation_order_id &&
    !isMockLikeValue(existingShipment.shipstation_order_id)
  ) {
    return {
      alreadySynced: true,
      shipstationOrderId: existingShipment.shipstation_order_id,
      shipstationStatus: existingShipment.status ?? "awaiting_shipment",
      syncStatus: "sent",
    };
  }

  try {
    const shipstation = getShipStationClient();
    const facility = order.facilities;

    if (
      !facility?.address_line_1 ||
      !facility?.city ||
      !facility?.state ||
      !facility?.postal_code
    ) {
      throw new Error("Facility address is incomplete in the database.");
    }

    const firstItem = order.order_items[0];

    const syncedOrder = await shipstation.syncOrder({
      localOrderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      amount: Number(firstItem?.total_amount ?? 0),
      quantity: Number(firstItem?.quantity ?? 1),
      facilityId: order.facility_id,
      facilityName: facility.name ?? "Unknown Facility",
      facilityContact: facility.name ?? null,
      address_line_1: facility.address_line_1,
      address_line_2: facility.address_line_2,
      city: facility.city,
      state: facility.state,
      postal_code: facility.postal_code,
      country: facility.country || "US",
      recipientPhone: facility.phone ?? null,
      receiptEmail: null,
      productName: firstItem?.product_name ?? `Order ${order.order_number}`,
      paymentMode: order.payment_method,
      paymentStatus: mapToShipStationPaymentStatus(order),
    });

    // Upsert shipment row (status: pending — label_created happens separately)
    const { error: shipmentUpsertError } = await admin
      .from("shipments")
      .upsert(
        {
          order_id: orderId,
          shipstation_order_id: syncedOrder.externalOrderId,
          status: "pending",
        },
        { onConflict: "order_id" },
      );

    if (shipmentUpsertError) {
      throw new Error(shipmentUpsertError.message);
    }

    revalidatePath(ORDERS_PATH);

    return {
      alreadySynced: false,
      shipstationOrderId: syncedOrder.externalOrderId,
      shipstationStatus: syncedOrder.status ?? "awaiting_shipment",
      syncStatus: "sent",
    };
  } catch (error) {
    revalidatePath(ORDERS_PATH);
    const message =
      error instanceof Error ? error.message : "Failed to sync to ShipStation";
    throw new Error(message);
  }
}

export const syncPaidOrderToShipStation = syncOrderToShipStation;

export async function markOrderDeliveredViaShipStation(orderId: string) {
  await requireShipStationRole();
  const admin = createAdminClient();

  const { data: shipment, error: shipmentError } = await admin
    .from("shipments")
    .select("id, shipstation_order_id")
    .eq("order_id", orderId)
    .maybeSingle<{ id: string; shipstation_order_id: string | null }>();

  if (shipmentError) throw new Error(shipmentError.message);

  if (!shipment?.shipstation_order_id || isMockLikeValue(shipment.shipstation_order_id)) {
    throw new Error("Missing valid ShipStation order ID");
  }

  const deliveredAt = new Date().toISOString();

  const { error: orderUpdateError } = await admin
    .from("orders")
    .update({
      delivery_status: "delivered",
      delivered_at: deliveredAt,
    })
    .eq("id", orderId);

  if (orderUpdateError) throw new Error(orderUpdateError.message);

  await admin
    .from("shipments")
    .update({
      status: "delivered",
      delivered_at: deliveredAt,
    })
    .eq("id", shipment.id);

  revalidatePath(ORDERS_PATH);
  return { success: true, orderId, status: "delivered" };
}
