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
import type {
  DashboardOrder,
  IOrderFormState,
  OrderStatus,
} from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  generateOrderNumber,
  requireClinicRole,
  requireIVREditRole,
  generateOrderPDFs,
  insertOrderHistory,
} from "./_shared";

/* -------------------------------------------------------------------------- */
/* createOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function createOrder(data: {
  wound_type: "chronic" | "post_surgical";
  date_of_service: string;
  notes?: string | null;
  order_type?: "non_omeza" | "omeza" | null;
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
        order_type: data.order_type ?? null,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      console.error("[createOrder] order insert:", JSON.stringify(orderErr));
      return { success: false, error: "Failed to create order." };
    }

    const orderId = orderRow.id;
    await insertOrderHistory(adminClient, orderId, "Order created as draft", null, "draft", userId);

    // For Omeza/Non-Omeza orders, generate blank IVR + HCFA PDFs immediately
    // (IVR and HCFA are manual-only; order_form PDF comes after AI extraction)
    if (data.order_type) {
      generateOrderPDFs(orderId, ["ivr", "hcfa_1500"]).catch((err) =>
        console.error("[createOrder] PDF generation:", err),
      );
    }

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

    // Only clinic, admin, and support staff can cancel orders
    if (!isClinicSide(role) && !isAdmin(role) && !isSupport(role)) {
      return { success: false, error: "Unauthorized." };
    }

    // Clinic side can only cancel their own facility's orders in draft/pending/additional_info
    if (!isAdmin(role) && !isSupport(role)) {
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
/* saveOrderForm                                                               */
/* -------------------------------------------------------------------------- */

export async function saveOrderForm(
  orderId: string,
  data: {
    wound_visit_number?: number | null;
    chief_complaint?: string | null;
    has_vasculitis_or_burns?: boolean;
    is_receiving_home_health?: boolean;
    is_patient_at_snf?: boolean;
    icd10_code?: string | null;
    followup_days?: number | null;
    wound_site?: string | null;
    wound_stage?: string | null;
    wound_length_cm?: number | null;
    wound_width_cm?: number | null;
    wound_depth_cm?: number | null;
    subjective_symptoms?: string[];
    clinical_notes?: string | null;
    condition_decreased_mobility?: boolean;
    condition_diabetes?: boolean;
    condition_infection?: boolean;
    condition_cvd?: boolean;
    condition_copd?: boolean;
    condition_chf?: boolean;
    condition_anemia?: boolean;
    use_blood_thinners?: boolean;
    blood_thinner_details?: string | null;
    wound_location_side?: string | null;
    granulation_tissue_pct?: number | null;
    exudate_amount?: string | null;
    third_degree_burns?: boolean;
    active_vasculitis?: boolean;
    active_charcot?: boolean;
    skin_condition?: string | null;
    wound2_length_cm?: number | null;
    wound2_width_cm?: number | null;
    wound2_depth_cm?: number | null;
    surgical_dressing_type?: string | null;
    anticipated_length_days?: number | null;
    followup_weeks?: number | null;
    wound_type?: string | null;
    drainage_description?: string | null;
    treatment_plan?: string | null;
    patient_name?: string | null;
    patient_date?: string | null;
    physician_signature?: string | null;
    physician_signature_date?: string | null;
    physician_signed_at?: string | null;
    physician_signed_by?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    // wound_type lives on the orders table — separate update
    const { wound_type, ...formData } = data;

    const { error } = await adminClient
      .from("order_form")
      .upsert({ order_id: orderId, ...formData }, { onConflict: "order_id" });

    if (error) {
      console.error("[saveOrderForm]", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save." };
    }

    if (wound_type !== undefined) {
      await adminClient
        .from("orders")
        .update({ wound_type })
        .eq("id", orderId);
    }

    revalidatePath(ORDERS_PATH);
    generateOrderPDFs(orderId, ["order_form"]).catch((err) =>
      console.error("[OrderForm PDF]", err),
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
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

export async function updateOrderStatus(
  input: FormData | { id: string },
): Promise<DashboardOrder> {
  throw new Error("updateOrderStatus is not supported in the new workflow.");
}
