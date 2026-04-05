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
  isClinicalProvider,
  isClinicalStaff,
  isClinicSide,
} from "@/utils/helpers/role";
import type {
  DashboardOrder,
  IOrderDocument,
  IOrderHistory,
  IOrderIVR,
  IOrderMessage,
  IPatient,
  IOrderFormState,
  InsertOrderPayload,
  InsertOrderItemPayload,
  ProductRecord,
  RawOrderRecord,
  WoundType,
  OrderStatus,
  IOrderForm,
} from "@/utils/interfaces/orders";
import { mapOrder, mapOrders } from "@/utils/interfaces/orders";

const ORDERS_PATH = "/dashboard/orders";
const BUCKET = "hbmedical-bucket-private";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HBM-${year}${month}${day}-${rand}`;
}

async function getUserFacilityId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facility_members")
    .select("facility_id")
    .eq("user_id", userId)
    .in("role_type", ["clinical_provider", "clinical_staff"])
    .maybeSingle();
  return data?.facility_id ?? null;
}

async function requireClinicRole(): Promise<{
  userId: string;
  facilityId: string;
  role: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isClinicSide(role)) {
    throw new Error("Only clinical providers and staff can perform this action.");
  }

  const facilityId = await getUserFacilityId(user.id);
  if (!facilityId) {
    throw new Error("No facility is assigned to your account.");
  }

  return { userId: user.id, facilityId, role: role! };
}

async function requireIVREditRole(): Promise<{
  userId: string;
  role: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const allowed =
    isClinicSide(role) ||
    role === "support_staff";
  if (!allowed) {
    throw new Error("Only clinical staff, providers, or support staff can edit IVR records.");
  }

  return { userId: user.id, role: role! };
}

function getDocumentLabel(type: string): string {
  const labels: Record<string, string> = {
    facesheet: "Facesheet",
    clinical_docs: "Clinical Documentation",
    order_form: "Order Form",
    additional_ivr: "Additional IVR Info",
    form_1500: "CMS-1500 Form",
    wound_pictures: "Wound Photos",
    other: "Additional Documentation",
  };
  return labels[type] ?? type;
}

async function insertOrderHistory(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
  action: string,
  oldStatus: string | null,
  newStatus: string | null,
  performedBy: string | null,
  notes?: string | null,
): Promise<void> {
  const { error } = await adminClient.from("order_history").insert({
    order_id: orderId,
    action,
    old_status: oldStatus,
    new_status: newStatus,
    performed_by: performedBy,
    notes: notes ?? null,
  });
  if (error) {
    console.error("[insertOrderHistory]", JSON.stringify(error));
  }
}

const ORDER_WITH_RELATIONS_SELECT = `
  id, order_number, facility_id, order_status,
  payment_method, payment_status, invoice_status,
  fulfillment_status, delivery_status, tracking_number,
  notes, placed_at, paid_at, delivered_at, created_at, updated_at,
  created_by, signed_by, signed_at, wound_type, date_of_service,
  patient_id, assigned_provider_id,
  wound_visit_number, chief_complaint,
  has_vasculitis_or_burns, is_receiving_home_health,
  is_patient_at_snf, icd10_code, followup_days, symptoms,
  ai_extracted, ai_extracted_at, order_form_locked,
  patients (id, facility_id, first_name, last_name, date_of_birth, patient_ref, notes, is_active, created_at, updated_at),
  order_items (id, order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal, total_amount, created_at, updated_at),
  order_documents (id, document_type, file_name, file_path, mime_type, file_size, uploaded_by, created_at),
  facilities!orders_facility_id_fkey (id, name)
`;

/* -------------------------------------------------------------------------- */
/* getOrders                                                                  */
/* -------------------------------------------------------------------------- */

export async function getOrders(): Promise<DashboardOrder[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  let query = supabase
    .from("orders")
    .select(ORDER_WITH_RELATIONS_SELECT)
    .order("placed_at", { ascending: false });

  // Clinic side: scope to their facility
  if (isClinicSide(role)) {
    const facilityId = await getUserFacilityId(user.id);
    if (!facilityId) return [];
    query = query.eq("facility_id", facilityId);
  }
  // Admin/rep/support: see all orders (no facility filter)

  const { data, error } = await query;

  if (error) {
    console.error("[getOrders]", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to fetch orders.");
  }

  return mapOrders((data ?? []) as unknown as RawOrderRecord[]);
}

// Legacy alias
export const getAllOrders = getOrders;

/* -------------------------------------------------------------------------- */
/* getOrderById                                                               */
/* -------------------------------------------------------------------------- */

export async function getOrderById(orderId: string): Promise<DashboardOrder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[getOrderById]", JSON.stringify(error));
    return null;
  }

  if (!data) return null;
  return mapOrder(data as unknown as RawOrderRecord);
}

/* -------------------------------------------------------------------------- */
/* createOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function createOrder(data: {
  wound_type: "chronic" | "post_surgical";
  date_of_service: string;
  notes?: string | null;
}): Promise<IOrderFormState> {
  try {
    const { userId, facilityId } = await requireClinicRole();

    if (!data.wound_type) return { success: false, error: "Wound type is required." };
    if (!data.date_of_service) return { success: false, error: "Date of service is required." };

    const adminClient = createAdminClient();
    const orderNumber = generateOrderNumber();

    const { data: orderRow, error: orderErr } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        facility_id: facilityId,
        order_status: "draft",
        payment_method: null,
        payment_status: "pending",
        invoice_status: "not_applicable",
        fulfillment_status: "pending",
        delivery_status: "not_shipped",
        tracking_number: null,
        notes: data.notes?.trim() || null,
        placed_at: new Date().toISOString(),
        paid_at: null,
        delivered_at: null,
        created_by: userId,
        wound_type: data.wound_type,
        date_of_service: data.date_of_service,
        patient_id: null,
        assigned_provider_id: null,
        ai_extracted: false,
        order_form_locked: false,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      console.error("[createOrder] order insert:", JSON.stringify(orderErr));
      return { success: false, error: "Failed to create order." };
    }

    const orderId = orderRow.id;
    await insertOrderHistory(adminClient, orderId, "Order created as draft", null, "draft", userId);

    revalidatePath(ORDERS_PATH);
    return { success: true, error: null, orderId };
  } catch (err) {
    console.error("[createOrder] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* assignProvider                                                             */
/* -------------------------------------------------------------------------- */

export async function assignProvider(
  orderId: string,
  providerId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    // Get the order to find its facility
    const { data: order } = await adminClient
      .from("orders")
      .select("id, facility_id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft") return { success: false, error: "Only draft orders can be reassigned." };

    // Verify provider is in the same facility
    const { data: member } = await adminClient
      .from("facility_members")
      .select("id")
      .eq("user_id", providerId)
      .eq("facility_id", order.facility_id)
      .eq("role_type", "clinical_provider")
      .maybeSingle();

    if (!member) return { success: false, error: "Provider not found in this facility." };

    const { error } = await adminClient
      .from("orders")
      .update({ assigned_provider_id: providerId })
      .eq("id", orderId);

    if (error) {
      console.error("[assignProvider]", JSON.stringify(error));
      return { success: false, error: "Failed to assign provider." };
    }

    await insertOrderHistory(adminClient, orderId, "Provider assigned", null, null, userId);
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* submitForSignature                                                         */
/* -------------------------------------------------------------------------- */

export async function submitForSignature(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft") return { success: false, error: "Only draft orders can be submitted." };

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "pending_signature" })
      .eq("id", orderId);

    if (error) {
      console.error("[submitForSignature]", JSON.stringify(error));
      return { success: false, error: "Failed to submit order." };
    }

    await insertOrderHistory(adminClient, orderId, "Submitted for signature", "draft", "pending_signature", userId);
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* recallOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function recallOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "pending_signature") {
      return { success: false, error: "Only pending_signature orders can be recalled." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "draft" })
      .eq("id", orderId);

    if (error) {
      console.error("[recallOrder]", JSON.stringify(error));
      return { success: false, error: "Failed to recall order." };
    }

    await insertOrderHistory(adminClient, orderId, "Order recalled to draft", "pending_signature", "draft", userId);
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* signOrder                                                                  */
/* -------------------------------------------------------------------------- */

export async function signOrder(
  orderId: string,
  pin: string,
): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role)) {
      return { success: false, error: "Only clinical providers can sign orders." };
    }

    // Get PIN hash
    const adminClient = createAdminClient();
    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creds?.pin_hash) {
      return { success: false, error: "No PIN set. Please set up your provider PIN.", noPinSet: true };
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(pin, creds.pin_hash);
    if (!valid) {
      return { success: false, error: "Incorrect PIN. Please try again." };
    }

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "pending_signature") {
      return { success: false, error: "Order is not pending signature." };
    }

    // Verify the signing user is a clinical_provider in this order's facility
    const { data: membership } = await adminClient
      .from("facility_members")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("facility_id", order.facility_id)
      .eq("role_type", "clinical_provider")
      .maybeSingle();

    if (!membership) {
      return { success: false, error: "You are not a clinical provider for this facility." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "manufacturer_review",
        signed_by: user.id,
        signed_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      console.error("[signOrder]", JSON.stringify(error));
      return { success: false, error: "Failed to sign order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Order signed by provider",
      "pending_signature",
      "manufacturer_review",
      user.id,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* approveOrder                                                               */
/* -------------------------------------------------------------------------- */

export async function approveOrder(
  orderId: string,
  paymentMethod: "pay_now" | "net_30",
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role)) {
      return { success: false, error: "Only admins can approve orders." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "manufacturer_review") {
      return { success: false, error: "Order must be in manufacturer_review to approve." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "approved",
        payment_method: paymentMethod,
        invoice_status: paymentMethod === "net_30" ? "draft" : "not_applicable",
      })
      .eq("id", orderId);

    if (error) {
      console.error("[approveOrder]", JSON.stringify(error));
      return { success: false, error: "Failed to approve order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `Order approved — payment: ${paymentMethod}`,
      "manufacturer_review",
      "approved",
      user.id,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* requestAdditionalInfo                                                      */
/* -------------------------------------------------------------------------- */

export async function requestAdditionalInfo(
  orderId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role)) {
      return { success: false, error: "Only admins can request additional info." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "manufacturer_review") {
      return { success: false, error: "Order must be in manufacturer_review." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "additional_info_needed",
        notes: notes ?? null,
      })
      .eq("id", orderId);

    if (error) {
      console.error("[requestAdditionalInfo]", JSON.stringify(error));
      return { success: false, error: "Failed to update order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Additional info requested",
      "manufacturer_review",
      "additional_info_needed",
      user.id,
      notes,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* resubmitForReview                                                          */
/* -------------------------------------------------------------------------- */

export async function resubmitForReview(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireClinicRole();
    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "additional_info_needed") {
      return { success: false, error: "Order must be in additional_info_needed to resubmit." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "manufacturer_review" })
      .eq("id", orderId);

    if (error) {
      console.error("[resubmitForReview]", JSON.stringify(error));
      return { success: false, error: "Failed to resubmit order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Resubmitted for manufacturer review",
      "additional_info_needed",
      "manufacturer_review",
      userId,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

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

    if (!isAdmin(role)) {
      return { success: false, error: "Only admins can add shipping info." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status")
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
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* cancelOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function cancelOrder(
  orderId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, created_by")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status === "canceled") return { success: false, error: "Order is already canceled." };
    if (order.order_status === "shipped") return { success: false, error: "Shipped orders cannot be canceled." };

    // Clinic side can only cancel their own facility's orders in draft/pending/additional_info
    if (!isAdmin(role)) {
      const allowedStatuses: OrderStatus[] = ["draft", "pending_signature", "additional_info_needed"];
      if (!allowedStatuses.includes(order.order_status as OrderStatus)) {
        return { success: false, error: "You cannot cancel an order at this stage." };
      }
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "canceled",
        fulfillment_status: "canceled",
        delivery_status: "canceled",
        notes: notes ?? null,
      })
      .eq("id", orderId);

    if (error) {
      console.error("[cancelOrder]", JSON.stringify(error));
      return { success: false, error: "Failed to cancel order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Order canceled",
      order.order_status,
      "canceled",
      user.id,
      notes,
    );
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function deleteOrder(orderId: string): Promise<void> {
  const { userId, facilityId } = await requireClinicRole();
  const adminClient = createAdminClient();

  const { data: order } = await adminClient
    .from("orders")
    .select("id, order_status, facility_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new Error("Order not found.");
  if (order.facility_id !== facilityId) throw new Error("You can only delete orders for your facility.");
  if (order.order_status !== "draft") throw new Error("Only draft orders can be deleted.");

  // Delete related records
  await adminClient.from("order_items").delete().eq("order_id", orderId);
  await adminClient.from("order_history").delete().eq("order_id", orderId);
  await adminClient.from("order_messages").delete().eq("order_id", orderId);
  await adminClient.from("order_documents").delete().eq("order_id", orderId);

  const { error } = await adminClient.from("orders").delete().eq("id", orderId);

  if (error) {
    console.error("[deleteOrder]", JSON.stringify(error));
    throw new Error("Failed to delete order.");
  }

  revalidatePath(ORDERS_PATH);
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
/* uploadOrderDocument                                                        */
/* -------------------------------------------------------------------------- */

export async function uploadOrderDocument(
  orderId: string,
  documentType: string,
  file: FormData,
): Promise<{ success: boolean; error?: string; document?: IOrderDocument }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const fileEntry = file.get("file") as File | null;
    if (!fileEntry) return { success: false, error: "No file provided." };

    const timestamp = Date.now();
    const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `order-documents/${orderId}/${documentType}/${timestamp}-${safeName}`;

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(filePath, fileEntry, {
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[uploadOrderDocument] storage:", JSON.stringify(uploadErr));
      return { success: false, error: "Failed to upload file." };
    }

    const { data: docRow, error: dbErr } = await adminClient
      .from("order_documents")
      .insert({
        order_id: orderId,
        document_type: documentType,
        bucket: BUCKET,
        file_path: filePath,
        file_name: fileEntry.name,
        mime_type: fileEntry.type || null,
        file_size: fileEntry.size || null,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (dbErr || !docRow) {
      console.error("[uploadOrderDocument] db:", JSON.stringify(dbErr));
      // Clean up storage
      await adminClient.storage.from(BUCKET).remove([filePath]);
      return { success: false, error: "Failed to save document record." };
    }

    // Non-blocking AI extraction for facesheet and clinical_docs
    if (["facesheet", "clinical_docs"].includes(documentType)) {
      triggerAiExtraction(orderId, documentType, filePath).catch((err) =>
        console.error("[uploadOrderDocument] AI trigger:", err),
      );
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `Document uploaded: ${getDocumentLabel(documentType)}`,
      null,
      null,
      user.id,
      fileEntry.name,
    );
    revalidatePath(ORDERS_PATH);
    return {
      success: true,
      document: {
        id: docRow.id,
        orderId: docRow.order_id,
        documentType: docRow.document_type,
        bucket: docRow.bucket,
        filePath: docRow.file_path,
        fileName: docRow.file_name,
        mimeType: docRow.mime_type,
        fileSize: docRow.file_size,
        uploadedBy: docRow.uploaded_by,
        createdAt: docRow.created_at,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getDocumentSignedUrl                                                       */
/* -------------------------------------------------------------------------- */

export async function getDocumentSignedUrl(
  filePath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error("[getDocumentSignedUrl]", JSON.stringify(error));
      return { url: null, error: "Failed to generate signed URL." };
    }

    return { url: data.signedUrl };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteOrderDocument                                                        */
/* -------------------------------------------------------------------------- */

export async function deleteOrderDocument(
  docId: string,
  filePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    const { error: storageErr } = await adminClient.storage
      .from(BUCKET)
      .remove([filePath]);

    if (storageErr) {
      console.error("[deleteOrderDocument] storage:", JSON.stringify(storageErr));
      // Non-fatal
    }

    const { error } = await adminClient
      .from("order_documents")
      .delete()
      .eq("id", docId);

    if (error) {
      console.error("[deleteOrderDocument] db:", JSON.stringify(error));
      return { success: false, error: "Failed to delete document." };
    }

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* sendOrderMessage                                                           */
/* -------------------------------------------------------------------------- */

export async function sendOrderMessage(
  orderId: string,
  message: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  if (!message.trim()) {
    return { error: "Message cannot be empty.", success: false };
  }

  const adminClient = createAdminClient();

  // INSERT and get the ID back in one query
  const { data: newMsg, error: insertError } = await adminClient
    .from("order_messages")
    .insert({
      order_id:  orderId,
      sender_id: user.id,
      message:   message.trim(),
    })
    .select("id")
    .single();

  if (insertError || !newMsg) {
    console.error("[sendOrderMessage]", JSON.stringify(insertError));
    return {
      error:   insertError?.message ?? "Failed to send message.",
      success: false,
    };
  }

  // Mark sender's own message as read immediately — awaited so it always completes
  await adminClient
    .from("message_reads")
    .insert({ message_id: newMsg.id, user_id: user.id });

  // Log history (non-blocking)
  adminClient.from("order_history").insert({
    order_id:     orderId,
    performed_by: user.id,
    action:       "Message sent",
    old_status:   null,
    new_status:   null,
    notes:        null,
  }).then(() => {}).catch(() => {});

  revalidatePath(ORDERS_PATH);
  return { success: true, error: null };
}

/* -------------------------------------------------------------------------- */
/* getOrderMessages                                                           */
/* -------------------------------------------------------------------------- */

export async function getOrderMessages(
  orderId: string,
): Promise<IOrderMessage[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  // Step 1 — fetch messages without join (sender_id → auth.users, not profiles)
  const { data, error } = await supabase
    .from("order_messages")
    .select("id, order_id, sender_id, message, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getOrderMessages]", JSON.stringify(error));
    return [];
  }
  if (!data || data.length === 0) return [];

  // Step 2 — collect unique sender IDs
  const senderIds = [
    ...new Set(
      data.map((m) => m.sender_id).filter((id): id is string => !!id),
    ),
  ];

  // Step 3 — resolve names + roles from profiles
  let nameMap: Record<string, { name: string; role: string }> = {};
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .in("id", senderIds);

    if (profiles) {
      nameMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          {
            name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown",
            role: p.role ?? "unknown",
          },
        ]),
      );
    }
  }

  // Step 4 — map with resolved names
  return data.map((m) => ({
    id:         m.id,
    orderId:    m.order_id,
    senderId:   m.sender_id,
    senderName: nameMap[m.sender_id]?.name ?? "Unknown",
    senderRole: nameMap[m.sender_id]?.role ?? "unknown",
    message:    m.message,
    createdAt:  m.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* markMessagesAsRead                                                         */
/* -------------------------------------------------------------------------- */

export async function markMessagesAsRead(orderId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  // All messages in this order not sent by current user
  const { data: allMessages } = await supabase
    .from("order_messages")
    .select("id")
    .eq("order_id", orderId)
    .neq("sender_id", user.id);

  if (!allMessages || allMessages.length === 0) return;

  // Which ones already have a read record?
  const { data: alreadyRead } = await supabase
    .from("message_reads")
    .select("message_id")
    .eq("user_id", user.id)
    .in("message_id", allMessages.map((m) => m.id));

  const alreadyReadIds = new Set((alreadyRead ?? []).map((r) => r.message_id));

  const toMark = allMessages
    .filter((m) => !alreadyReadIds.has(m.id))
    .map((m) => ({ message_id: m.id, user_id: user.id }));

  if (toMark.length === 0) return;

  const adminClient = createAdminClient();
  await adminClient
    .from("message_reads")
    .upsert(toMark, { onConflict: "message_id,user_id" });
}

/* -------------------------------------------------------------------------- */
/* getUnreadMessageCounts                                                      */
/* -------------------------------------------------------------------------- */

export async function getUnreadMessageCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .rpc("get_unread_message_counts", { p_user_id: user.id });

  if (error || !data) return {};

  return Object.fromEntries(
    (data as { order_id: string; unread_count: number }[])
      .map((row) => [row.order_id, Number(row.unread_count)]),
  );
}

/* -------------------------------------------------------------------------- */
/* getOrderHistory                                                            */
/* -------------------------------------------------------------------------- */

export async function getOrderHistory(
  orderId: string,
): Promise<IOrderHistory[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  // Step 1 — fetch history rows (no join)
  const { data, error } = await supabase
    .from("order_history")
    .select("id, order_id, performed_by, action, old_status, new_status, notes, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  // Step 2 — collect unique non-null user IDs
  const userIds = [
    ...new Set(data.map((h) => h.performed_by).filter((id): id is string => !!id)),
  ];

  // Step 3 — fetch profiles for those IDs
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);

    if (profiles) {
      nameMap = Object.fromEntries(
        profiles.map((p) => [
          p.id,
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        ]),
      );
    }
  }

  // Step 4 — map with resolved names
  return data.map((h) => ({
    id: h.id,
    orderId: h.order_id,
    action: h.action,
    oldStatus: h.old_status ?? null,
    newStatus: h.new_status ?? null,
    notes: h.notes ?? null,
    createdAt: h.created_at,
    performedBy: h.performed_by ?? null,
    performedByName: h.performed_by
      ? (nameMap[h.performed_by] ?? "Unknown")
      : "System",
  }));
}

/* -------------------------------------------------------------------------- */
/* getOrderDocuments                                                          */
/* -------------------------------------------------------------------------- */

export async function getOrderDocuments(
  orderId: string,
): Promise<IOrderDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("order_documents")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getOrderDocuments]", JSON.stringify(error));
    return [];
  }

  return (data ?? []).map((d) => ({
    id: d.id,
    orderId: d.order_id,
    documentType: d.document_type,
    bucket: d.bucket,
    filePath: d.file_path,
    fileName: d.file_name,
    mimeType: d.mime_type,
    fileSize: d.file_size,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* upsertForm1500                                                             */
/* -------------------------------------------------------------------------- */

export async function upsertForm1500(
  orderId: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("order_form_1500").upsert(
      {
        order_id: orderId,
        ...formData,
      },
      { onConflict: "order_id" },
    );

    if (error) {
      console.error("[upsertForm1500]", JSON.stringify(error));
      return { success: false, error: "Failed to save form." };
    }

    generateOrderPDFs(orderId, ["hcfa_1500"]).catch(
      err => console.error("[HCFA PDF]", err),
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getForm1500                                                                */
/* -------------------------------------------------------------------------- */

export async function getForm1500(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_form_1500")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  return data ?? null;
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
    .select("id, sku, name, category, unit_price, is_active, sort_order, created_at, updated_at")
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
/* Legacy stubs — kept for backwards compat with EditOrderModal              */
/* -------------------------------------------------------------------------- */

export async function editOrder(
  input: FormData | { id: string; product_id: string; quantity: number },
): Promise<DashboardOrder> {
  throw new Error("editOrder is not supported in the new clinical workflow. Orders are read-only after creation.");
}

export async function submitOrderPaymentChoice(
  input: FormData | { id: string; payment_method: string },
): Promise<DashboardOrder> {
  throw new Error("submitOrderPaymentChoice is not supported in the new workflow.");
}

export async function updateOrderStatus(
  input: FormData | { id: string },
): Promise<DashboardOrder> {
  throw new Error("updateOrderStatus is not supported in the new workflow.");
}

export async function createOrderCheckout(orderId: string): Promise<{ url: string | null }> {
  throw new Error("Stripe checkout is not available in the new workflow.");
}

/* -------------------------------------------------------------------------- */
/* getOrderIVR                                                                 */
/* -------------------------------------------------------------------------- */

export async function getOrderIVR(
  orderId: string,
): Promise<IOrderIVR | null> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("order_ivr")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[getOrderIVR]", JSON.stringify(error));
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      orderId: data.order_id,
      insuranceProvider: data.insurance_provider,
      insurancePhone: data.insurance_phone,
      memberId: data.member_id,
      groupNumber: data.group_number,
      planName: data.plan_name,
      planType: data.plan_type,
      subscriberName: data.subscriber_name,
      subscriberDob: data.subscriber_dob,
      subscriberRelationship: data.subscriber_relationship,
      coverageStartDate: data.coverage_start_date,
      coverageEndDate: data.coverage_end_date,
      deductibleAmount: data.deductible_amount != null ? Number(data.deductible_amount) : null,
      deductibleMet: data.deductible_met != null ? Number(data.deductible_met) : null,
      outOfPocketMax: data.out_of_pocket_max != null ? Number(data.out_of_pocket_max) : null,
      outOfPocketMet: data.out_of_pocket_met != null ? Number(data.out_of_pocket_met) : null,
      copayAmount: data.copay_amount != null ? Number(data.copay_amount) : null,
      coinsurancePercent: data.coinsurance_percent != null ? Number(data.coinsurance_percent) : null,
      dmeCovered: data.dme_covered ?? false,
      woundCareCovered: data.wound_care_covered ?? false,
      priorAuthRequired: data.prior_auth_required ?? false,
      priorAuthNumber: data.prior_auth_number,
      priorAuthStartDate: data.prior_auth_start_date,
      priorAuthEndDate: data.prior_auth_end_date,
      unitsAuthorized: data.units_authorized,
      verifiedBy: data.verified_by,
      verifiedDate: data.verified_date,
      verificationReference: data.verification_reference,
      notes: data.notes,
      aiExtracted: data.ai_extracted ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("[getOrderIVR] unexpected:", err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* upsertOrderIVR                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertOrderIVR(
  orderId: string,
  data: Partial<IOrderIVR>,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    const payload: Record<string, unknown> = { order_id: orderId };
    if (data.insuranceProvider !== undefined) payload.insurance_provider = data.insuranceProvider;
    if (data.insurancePhone !== undefined) payload.insurance_phone = data.insurancePhone;
    if (data.memberId !== undefined) payload.member_id = data.memberId;
    if (data.groupNumber !== undefined) payload.group_number = data.groupNumber;
    if (data.planName !== undefined) payload.plan_name = data.planName;
    if (data.planType !== undefined) payload.plan_type = data.planType;
    if (data.subscriberName !== undefined) payload.subscriber_name = data.subscriberName;
    if (data.subscriberDob !== undefined) payload.subscriber_dob = data.subscriberDob;
    if (data.subscriberRelationship !== undefined) payload.subscriber_relationship = data.subscriberRelationship;
    if (data.coverageStartDate !== undefined) payload.coverage_start_date = data.coverageStartDate;
    if (data.coverageEndDate !== undefined) payload.coverage_end_date = data.coverageEndDate;
    if (data.deductibleAmount !== undefined) payload.deductible_amount = data.deductibleAmount;
    if (data.deductibleMet !== undefined) payload.deductible_met = data.deductibleMet;
    if (data.outOfPocketMax !== undefined) payload.out_of_pocket_max = data.outOfPocketMax;
    if (data.outOfPocketMet !== undefined) payload.out_of_pocket_met = data.outOfPocketMet;
    if (data.copayAmount !== undefined) payload.copay_amount = data.copayAmount;
    if (data.coinsurancePercent !== undefined) payload.coinsurance_percent = data.coinsurancePercent;
    if (data.dmeCovered !== undefined) payload.dme_covered = data.dmeCovered;
    if (data.woundCareCovered !== undefined) payload.wound_care_covered = data.woundCareCovered;
    if (data.priorAuthRequired !== undefined) payload.prior_auth_required = data.priorAuthRequired;
    if (data.priorAuthNumber !== undefined) payload.prior_auth_number = data.priorAuthNumber;
    if (data.priorAuthStartDate !== undefined) payload.prior_auth_start_date = data.priorAuthStartDate;
    if (data.priorAuthEndDate !== undefined) payload.prior_auth_end_date = data.priorAuthEndDate;
    if (data.unitsAuthorized !== undefined) payload.units_authorized = data.unitsAuthorized;
    if (data.verifiedBy !== undefined) payload.verified_by = data.verifiedBy;
    if (data.verifiedDate !== undefined) payload.verified_date = data.verifiedDate;
    if (data.verificationReference !== undefined) payload.verification_reference = data.verificationReference;
    if (data.notes !== undefined) payload.notes = data.notes;

    const { error } = await adminClient
      .from("order_ivr")
      .upsert(payload, { onConflict: "order_id" });

    if (error) {
      console.error("[upsertOrderIVR]", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save IVR." };
    }

    revalidatePath(ORDERS_PATH);

    generateOrderPDFs(orderId, ["ivr"]).catch(
      err => console.error("[IVR PDF]", err),
    );

    return { success: true, error: null };
  } catch (err) {
    console.error("[upsertOrderIVR] unexpected:", err);
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
    if (order.order_status !== "draft") {
      return { success: false, error: "Products can only be added to draft orders." };
    }

    const itemPayloads = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
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
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[addOrderItems] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

export async function startOrderNet30(orderId: string): Promise<DashboardOrder> {
  throw new Error("Stripe Net 30 is not available in the new workflow.");
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
    if ((orderRecord as { order_status: string } | null)?.order_status !== "draft") {
      return { success: false, error: "Can only edit items on draft orders." };
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
    if ((orderRecord2 as { order_status: string } | null)?.order_status !== "draft") {
      return { success: false, error: "Can only remove items from draft orders." };
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
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteOrderItem] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* triggerAiExtraction                                                         */
/* -------------------------------------------------------------------------- */

export async function triggerAiExtraction(
  orderId: string,
  documentType: string,
  filePath: string,
): Promise<{ success: boolean; error: string | null; skipped?: boolean }> {
  try {
    if (!["facesheet", "clinical_docs"].includes(documentType)) {
      return { success: true, error: null, skipped: true };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/ai/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, documentType, filePath, bucket: BUCKET }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("[triggerAiExtraction]", data.error);
      return { success: false, error: data.error, skipped: false };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[triggerAiExtraction] unexpected:", err);
    // Non-fatal — upload already succeeded; user can fill form manually
    return { success: false, error: "AI extraction failed — fill form manually." };
  }
}

/* -------------------------------------------------------------------------- */
/* updateOrderClinicalFields                                                   */
/* -------------------------------------------------------------------------- */

export async function updateOrderClinicalFields(
  orderId: string,
  data: {
    chief_complaint?: string | null;
    has_vasculitis_or_burns?: boolean | null;
    is_receiving_home_health?: boolean | null;
    is_patient_at_snf?: boolean | null;
    icd10_code?: string | null;
    followup_days?: number | null;
    symptoms?: string[];
    notes?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireIVREditRole();
    const adminClient = createAdminClient();

    const payload: Record<string, unknown> = {};
    if ("chief_complaint" in data) payload.chief_complaint = data.chief_complaint;
    if ("has_vasculitis_or_burns" in data) payload.has_vasculitis_or_burns = data.has_vasculitis_or_burns;
    if ("is_receiving_home_health" in data) payload.is_receiving_home_health = data.is_receiving_home_health;
    if ("is_patient_at_snf" in data) payload.is_patient_at_snf = data.is_patient_at_snf;
    if ("icd10_code" in data) payload.icd10_code = data.icd10_code;
    if ("followup_days" in data) payload.followup_days = data.followup_days;
    if ("symptoms" in data) payload.symptoms = data.symptoms;
    if ("notes" in data) payload.notes = data.notes;

    if (!Object.keys(payload).length) return { success: true };

    const { error } = await adminClient
      .from("orders")
      .update(payload)
      .eq("id", orderId);

    if (error) throw new Error(error.message);

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getOrderAiStatus                                                            */
/* -------------------------------------------------------------------------- */

export async function getOrderAiStatus(
  orderId: string,
): Promise<{ aiExtracted: boolean; orderForm: IOrderForm | null }> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data: order } = await supabase
    .from("orders")
    .select("ai_extracted")
    .eq("id", orderId)
    .single();

  if (!order?.ai_extracted) {
    return { aiExtracted: false, orderForm: null };
  }

  const { data: form } = await supabase
    .from("order_form")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (!form) {
    return { aiExtracted: true, orderForm: null };
  }

  return {
    aiExtracted: true,
    orderForm: {
      id:                    form.id,
      orderId:               form.order_id,
      woundVisitNumber:      form.wound_visit_number ?? null,
      chiefComplaint:        form.chief_complaint ?? null,
      hasVasculitisOrBurns:  form.has_vasculitis_or_burns ?? false,
      isReceivingHomeHealth: form.is_receiving_home_health ?? false,
      isPatientAtSnf:        form.is_patient_at_snf ?? false,
      icd10Code:             form.icd10_code ?? null,
      followupDays:          form.followup_days ?? null,
      woundSite:             form.wound_site ?? null,
      woundStage:            form.wound_stage ?? null,
      woundLengthCm:         form.wound_length_cm ?? null,
      woundWidthCm:          form.wound_width_cm ?? null,
      woundDepthCm:          form.wound_depth_cm ?? null,
      subjectiveSymptoms:    form.subjective_symptoms ?? [],
      clinicalNotes:         form.clinical_notes ?? null,
      aiExtracted:           form.ai_extracted ?? false,
      aiExtractedAt:         form.ai_extracted_at ?? null,
      isLocked:              form.is_locked ?? false,
      lockedAt:              form.locked_at ?? null,
      lockedBy:              form.locked_by ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* generateOrderPDFs                                                           */
/* -------------------------------------------------------------------------- */

export async function generateOrderPDFs(
  orderId: string,
  formTypes: ("order_form" | "ivr" | "hcfa_1500")[],
): Promise<{ success: boolean; error: string | null }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await Promise.allSettled(
      formTypes.map(formType =>
        fetch(`${baseUrl}/api/generate-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, formType }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error) {
              console.error(`[PDF] ${formType} failed:`, data.error);
            }
          }),
      ),
    );

    return { success: true, error: null };
  } catch (err) {
    return { error: String(err), success: false };
  }
}
