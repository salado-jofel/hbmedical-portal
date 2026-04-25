"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserOrThrow,
  getUserRole,
} from "@/lib/supabase/auth";
import {
  isAdmin,
  isClinicSide,
  isSupport,
} from "@/utils/helpers/role";
import type { IPatient, ProductRecord } from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  requireClinicRole,
  getUserFacilityId,
  insertOrderHistory,
  createNotifications,
  generateOrderPDFs,
} from "./_shared";
import { isItemsEditable } from "@/utils/constants/orders";

/* -------------------------------------------------------------------------- */
/* addShippingInfo                                                            */
/* -------------------------------------------------------------------------- */

export async function addShippingInfo(
  orderId: string,
  data: {
    carrier: string;
    trackingNumber: string;
    shippedAt: string;
    estimatedDeliveryAt?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role) && !isSupport(role)) {
      return { success: false, error: "Only admins and support staff can add shipping info." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "approved") {
      return { success: false, error: "Order must be approved before shipping." };
    }

    // Insert into shipments
    const { error: shipErr } = await adminClient.from("shipments").insert({
      order_id: orderId,
      carrier: data.carrier || null,
      tracking_number: data.trackingNumber || null,
      status: "in_transit",
      shipped_at: data.shippedAt || null,
      estimated_delivery_at: data.estimatedDeliveryAt || null,
    });

    if (shipErr) {
      console.error("[addShippingInfo] shipments insert:", JSON.stringify(shipErr));
      // Non-fatal, continue
    }

    // Update order
    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "shipped",
        tracking_number: data.trackingNumber || null,
        delivery_status: "in_transit",
        fulfillment_status: "fulfilled",
      })
      .eq("id", orderId);

    if (error) {
      console.error("[addShippingInfo]", JSON.stringify(error));
      return { success: false, error: "Failed to update order shipping info." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `Order shipped — ${data.carrier} ${data.trackingNumber}`,
      "approved",
      "shipped",
      user.id,
    );
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_shipped",
      title:       "Order shipped",
      body:        `Order ${order.order_number} has shipped.${data.trackingNumber ? ` Tracking: ${data.carrier} #${data.trackingNumber}` : ""}`,
      oldStatus:   "approved",
      newStatus:   "shipped",
      notifyRoles:    ["clinical_staff", "clinical_provider"],
      excludeUserId:  user.id,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* addOrderItems                                                               */
/* -------------------------------------------------------------------------- */

export async function addOrderItems(
  orderId: string,
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    hcpcs_code?: string | null;
    unit_price: number;
    quantity: number;
  }>,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (!isItemsEditable(order.order_status)) {
      return {
        success: false,
        error:
          "Products can only be added while the order is a draft, awaiting signature, or in Needs More Info.",
      };
    }

    const itemPayloads = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      // Snapshot HCPCS at order time so historical orders survive a product
      // edit. Mirrors the same pattern used for product_sku/product_name.
      hcpcs_code: item.hcpcs_code ?? null,
      unit_price: item.unit_price,
      quantity: item.quantity,
      shipping_amount: 0,
      tax_amount: 0,
    }));

    const { error } = await adminClient.from("order_items").insert(itemPayloads);

    if (error) {
      console.error("[addOrderItems]", JSON.stringify(error));
      return { success: false, error: "Failed to add products." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `${items.length} product${items.length !== 1 ? "s" : ""} added to order`,
      null,
      null,
      userId,
      items.map((i) => `${i.product_name} ×${i.quantity}`).join(", "),
    );
    // Keep the invoice PDF in sync with the current order items.
    generateOrderPDFs(orderId, ["delivery_invoice"]).catch((err) =>
      console.error("[addOrderItems] invoice PDF regen:", err),
    );
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[addOrderItems] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* updateOrderItemQuantity                                                     */
/* -------------------------------------------------------------------------- */

export async function updateOrderItemQuantity(
  itemId: string,
  quantity: number,
): Promise<{ success: boolean; error: string | null }> {
  if (quantity < 1) {
    return { success: false, error: "Quantity must be at least 1." };
  }
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: item } = await adminClient
      .from("order_items")
      .select("order_id, orders!order_items_order_id_fkey(order_status)")
      .eq("id", itemId)
      .single();

    if (!item) return { success: false, error: "Item not found." };
    const rawOrders = (item as { orders: unknown }).orders;
    const orderRecord = Array.isArray(rawOrders) ? rawOrders[0] : rawOrders;
    const status = (orderRecord as { order_status: string } | null)?.order_status;
    if (!isItemsEditable(status)) {
      return {
        success: false,
        error: "Items are locked once the order moves into manufacturer review or beyond.",
      };
    }

    const { error } = await adminClient
      .from("order_items")
      .update({ quantity })
      .eq("id", itemId);

    if (error) {
      console.error("[updateOrderItemQuantity]", JSON.stringify(error));
      return { success: false, error: "Failed to update quantity." };
    }

    await insertOrderHistory(adminClient, (item as { order_id: string }).order_id, "Item quantity updated", null, null, userId);
    generateOrderPDFs((item as { order_id: string }).order_id, ["delivery_invoice"]).catch((err) =>
      console.error("[updateOrderItemQuantity] invoice PDF regen:", err),
    );
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[updateOrderItemQuantity] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteOrderItem                                                             */
/* -------------------------------------------------------------------------- */

export async function deleteOrderItem(
  itemId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: item } = await adminClient
      .from("order_items")
      .select("order_id, orders!order_items_order_id_fkey(order_status)")
      .eq("id", itemId)
      .single();

    if (!item) return { success: false, error: "Item not found." };
    const rawOrders2 = (item as { orders: unknown }).orders;
    const orderRecord2 = Array.isArray(rawOrders2) ? rawOrders2[0] : rawOrders2;
    const status2 = (orderRecord2 as { order_status: string } | null)?.order_status;
    if (!isItemsEditable(status2)) {
      return {
        success: false,
        error: "Items are locked once the order moves into manufacturer review or beyond.",
      };
    }

    const { error } = await adminClient
      .from("order_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("[deleteOrderItem]", JSON.stringify(error));
      return { success: false, error: "Failed to remove item." };
    }

    await insertOrderHistory(adminClient, (item as { order_id: string }).order_id, "Item removed from order", null, null, userId);
    generateOrderPDFs((item as { order_id: string }).order_id, ["delivery_invoice"]).catch((err) =>
      console.error("[deleteOrderItem] invoice PDF regen:", err),
    );
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteOrderItem] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getPatients                                                                */
/* -------------------------------------------------------------------------- */

export async function getPatients(): Promise<IPatient[]> {
  const { facilityId } = await requireClinicRole();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("is_active", true)
    .order("last_name");

  if (error) {
    console.error("[getPatients]", JSON.stringify(error));
    throw new Error("Failed to fetch patients.");
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    facilityId: p.facility_id,
    firstName: p.first_name,
    lastName: p.last_name,
    dateOfBirth: p.date_of_birth,
    patientRef: p.patient_ref,
    notes: p.notes,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    fullName: `${p.first_name} ${p.last_name}`,
  }));
}

/* -------------------------------------------------------------------------- */
/* createPatient                                                              */
/* -------------------------------------------------------------------------- */

export async function createPatient(
  data: {
    first_name: string;
    last_name: string;
    date_of_birth?: string | null;
    patient_ref?: string | null;
  },
): Promise<{ success: boolean; error: string | null; patient?: IPatient }> {
  try {
    const { facilityId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const firstName = data.first_name.trim();
    const lastName = data.last_name.trim();
    const dob = data.date_of_birth || null;
    const patientRef = data.patient_ref?.trim() || null;

    if (!firstName || !lastName) {
      return { success: false, error: "First and last name are required." };
    }

    const { data: row, error } = await adminClient
      .from("patients")
      .insert({
        facility_id: facilityId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob,
        patient_ref: patientRef,
        is_active: true,
      })
      .select("id, facility_id, first_name, last_name, date_of_birth, patient_ref, notes, is_active, created_at, updated_at")
      .single();

    if (error || !row) {
      console.error("[createPatient]", JSON.stringify(error));
      return { success: false, error: "Failed to create patient." };
    }

    const patient: IPatient = {
      id: row.id,
      facilityId: row.facility_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      patientRef: row.patient_ref,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fullName: `${row.first_name} ${row.last_name}`,
    };

    return { success: true, error: null, patient };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getClinicProviders                                                         */
/* -------------------------------------------------------------------------- */

export async function getClinicProviders(): Promise<
  Array<{ id: string; name: string; npi: string | null }>
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicSide(role)) return [];

    const facilityId = await getUserFacilityId(user.id);
    if (!facilityId) return [];

    const adminClient = createAdminClient();

    const { data: members, error: membersErr } = await adminClient
      .from("facility_members")
      .select("user_id")
      .eq("facility_id", facilityId)
      .eq("role_type", "clinical_provider");

    if (membersErr || !members?.length) return [];

    const userIds = members.map((m) => m.user_id);

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);

    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      npi: null,
    }));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* getProducts (for order creation)                                          */
/* -------------------------------------------------------------------------- */

export async function getProducts(): Promise<ProductRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, category, hcpcs_code, unit_price, is_active, sort_order, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("[getProducts]", JSON.stringify(error));
    return [];
  }

  return (data ?? []) as ProductRecord[];
}

// Legacy alias
export const getActiveProducts = getProducts;

/* -------------------------------------------------------------------------- */
/* getUserFacility (legacy alias used by old CreateOrderModal)               */
/* -------------------------------------------------------------------------- */

export async function getUserFacility() {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const facilityId = await getUserFacilityId(user.id);
    if (!facilityId) return null;

    const { data } = await supabase
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .maybeSingle();

    return data ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* getOrderShipment                                                           */
/*                                                                            */
/* Returns the most recent shipment record for an order (carrier, tracking,   */
/* shipped_at, delivered_at, estimated_delivery_at). Orders that haven't been */
/* shipped yet return null.                                                   */
/* -------------------------------------------------------------------------- */

export interface OrderShipmentInfo {
  carrier: string | null;
  service_level: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  /** Shipment row creation time — useful as "Label created" when the
   *  carrier-side shipped_at hasn't been set yet. */
  created_at: string | null;
}

export async function getOrderShipment(
  orderId: string,
): Promise<OrderShipmentInfo | null> {
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("shipments")
      .select(
        "carrier, service_level, tracking_number, tracking_url, status, shipped_at, delivered_at, estimated_delivery_at, created_at",
      )
      .eq("order_id", orderId)
      .order("shipped_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return (data as OrderShipmentInfo | null) ?? null;
  } catch {
    return null;
  }
}
