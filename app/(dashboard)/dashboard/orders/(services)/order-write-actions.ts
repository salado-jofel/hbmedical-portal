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
import { safeLogError } from "@/lib/logging/safe-log";

/* -------------------------------------------------------------------------- */
/* createOrder                                                                */
/* -------------------------------------------------------------------------- */

export async function createOrder(data: {
  wound_type: "chronic" | "post_surgical";
  date_of_service: string;
  notes?: string | null;
  order_type?: "surgical_collagen" | "omeza" | null;
  manual_input?: boolean;
  patient_first_name?: string | null;
  patient_last_name?: string | null;
}): Promise<IOrderFormState> {
  try {
    const { userId, facilityId } = await requireClinicRole();

    if (!data.wound_type) return { success: false, error: "Wound type is required." };
    if (!data.date_of_service) return { success: false, error: "Date of service is required." };

    const adminClient = createAdminClient();
    const orderNumber = generateOrderNumber();

    // Manual-input orders collect a patient name up-front (AI would otherwise
    // populate this). Create a new patients row and link it to the order.
    // Duplicates are intentional — we always insert, no find-or-create lookup.
    let patientId: string | null = null;
    if (data.manual_input) {
      const firstName = data.patient_first_name?.trim();
      const lastName = data.patient_last_name?.trim();
      if (!firstName || !lastName) {
        return { success: false, error: "Patient first and last name are required for manual input." };
      }
      const { data: patientRow, error: patientErr } = await adminClient
        .from("patients")
        .insert({
          facility_id: facilityId,
          first_name: firstName,
          last_name: lastName,
        })
        .select("id")
        .single();
      if (patientErr || !patientRow) {
        safeLogError("createOrder", patientErr, { phase: "patient insert" });
        return { success: false, error: "Failed to save patient information." };
      }
      patientId = patientRow.id;
    }

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
        patient_id: patientId,
        assigned_provider_id: null,
        ai_extracted: false,
        order_form_locked: false,
        order_type: data.order_type ?? null,
        manual_input: data.manual_input ?? false,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      safeLogError("createOrder", orderErr, { phase: "order insert" });
      return { success: false, error: "Failed to create order." };
    }

    const orderId = orderRow.id;
    await insertOrderHistory(adminClient, orderId, "Order created as draft", null, "draft", userId);

    // PDF generation strategy:
    //   manual_input = true → all three forms stay blank; generate all three PDFs up-front.
    //   otherwise           → AI extraction populates everything post-upload.
    // order_type is now purely a product classification with no effect on form behavior.
    if (data.manual_input) {
      generateOrderPDFs(orderId, ["order_form", "ivr", "hcfa_1500"]).catch((err) =>
        safeLogError("createOrder", err, { phase: "PDF generation (manual)", orderId }),
      );
    }

    revalidatePath(ORDERS_PATH);
    return { success: true, error: null, orderId };
  } catch (err) {
    safeLogError("createOrder", err);
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
      safeLogError("assignProvider", error, { orderId, providerId });
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
      safeLogError("cancelOrder", error, { orderId });
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
    safeLogError("deleteOrder", error, { orderId });
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
    /* ── Fortify expansion (added 2026-04-30) ── */
    patient_mrn?: string | null;
    patient_mbi?: string | null;
    insurance_type_label?: string | null;
    anticipated_dos_start?: string | null;
    anticipated_dos_end?: string | null;
    a1c_value?: number | null;
    a1c_date?: string | null;
    condition_pad?: boolean;
    pad_details?: string | null;
    condition_venous_insufficiency?: boolean;
    condition_neuropathy?: boolean;
    condition_immunosuppression?: boolean;
    immunosuppression_details?: string | null;
    condition_malnutrition?: boolean;
    albumin_value?: number | null;
    condition_smoking?: boolean;
    condition_renal_disease?: boolean;
    egfr_value?: number | null;
    condition_other?: string | null;
    etiology_dfu?: boolean;
    etiology_venous_stasis?: boolean;
    etiology_pressure_ulcer?: boolean;
    pressure_ulcer_stage?: string | null;
    etiology_arterial?: boolean;
    etiology_surgical?: boolean;
    etiology_traumatic?: boolean;
    etiology_other?: string | null;
    wound_onset_date?: string | null;
    wound_duration_text?: string | null;
    wound_bed_slough_pct?: number | null;
    wound_bed_eschar_pct?: number | null;
    pain_level?: number | null;
    infection_signs_describe?: string | null;
    wound_photo_taken?: boolean;
    prior_treatments?: Array<{ treatment: string; dates_used: string; outcome: string }>;
    advancement_reason?: string | null;
    goal_of_therapy?: string | null;
    goal_of_therapy_other?: string | null;
    adjunct_offloading?: boolean;
    adjunct_compression?: boolean;
    adjunct_debridement?: boolean;
    adjunct_other?: string | null;
    specialty_consults?: string | null;
    application_frequency?: string | null;
    special_modifiers?: string | null;
    prior_auth_obtained?: boolean;
    lcd_reference?: string | null;
    wound_meets_lcd?: boolean | null;
    conservative_tx_period_met?: boolean | null;
    qty_within_lcd_limits?: boolean | null;
    kx_criteria_met?: string | null;
    pos_eligible?: boolean | null;
    coverage_concerns?: string | null;
    physician_npi?: string | null;
    attest_examined_patient?: boolean;
    attest_medically_necessary?: boolean;
    attest_conservative_tx_inadequate?: boolean;
    attest_freq_qty_clinical_judgment?: boolean;
    attest_lcd_supported?: boolean;
    office_tracking?: Record<string, unknown>;
  },
  ifMatchUpdatedAt?: string | null,
): Promise<{
  success: boolean;
  error?: string;
  conflict?: boolean;
  updatedAt?: string;
}> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    // wound_type lives on the orders table — separate update
    const { wound_type, ...formData } = data;

    if (ifMatchUpdatedAt) {
      const { data: current } = await adminClient
        .from("order_form")
        .select("updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (current && current.updated_at !== ifMatchUpdatedAt) {
        return {
          success: false,
          conflict: true,
          error:
            "Someone else saved this form while you were editing. Reload to see their changes.",
        };
      }
    }

    const nowIso = new Date().toISOString();
    const { data: saved, error } = await adminClient
      .from("order_form")
      .upsert(
        { order_id: orderId, ...formData, updated_at: nowIso },
        { onConflict: "order_id" },
      )
      .select("updated_at")
      .single();

    if (error) {
      safeLogError("saveOrderForm", error, { orderId });
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
      safeLogError("OrderForm PDF", err, { orderId }),
    );
    return { success: true, updatedAt: saved?.updated_at ?? nowIso };
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
