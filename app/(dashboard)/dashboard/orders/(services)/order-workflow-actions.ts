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
  isSupport,
} from "@/utils/helpers/role";
import {
  ORDERS_PATH,
  requireClinicRole,
  insertOrderHistory,
  createNotifications,
} from "./_shared";
import { safeLogError } from "@/lib/logging/safe-log";

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
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft") return { success: false, error: "Only draft orders can be submitted." };

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "pending_signature" })
      .eq("id", orderId);

    if (error) {
      safeLogError("submitForSignature", error, { orderId });
      return { success: false, error: "Failed to submit order." };
    }

    await insertOrderHistory(adminClient, orderId, "Submitted for signature", "draft", "pending_signature", userId);
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_submitted",
      title:       "Order ready for signature",
      body:        `Order ${order.order_number} has been submitted and requires your signature.`,
      oldStatus:   "draft",
      newStatus:   "pending_signature",
      notifyRoles:    ["clinical_provider"],
      excludeUserId:  userId,
    }).catch(() => {});
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
      .select("id, order_status, facility_id, order_number")
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
      safeLogError("recallOrder", error, { orderId });
      return { success: false, error: "Failed to recall order." };
    }

    await insertOrderHistory(adminClient, orderId, "Order recalled to draft", "pending_signature", "draft", userId);
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_recalled",
      title:       "Order recalled to draft",
      body:        `Order ${order.order_number} has been recalled and returned to draft status.`,
      oldStatus:   "pending_signature",
      newStatus:   "draft",
      notifyRoles:    ["clinical_staff", "clinical_provider"],
      excludeUserId:  userId,
    }).catch(() => {});
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
    const { data: creds, error: credError } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (credError) {
      safeLogError("signOrder", credError, { phase: "credentials lookup", userId: user.id });
    }

    if (!creds?.pin_hash) {
      return { success: false, error: "No PIN set. Please set up your provider PIN.", noPinSet: true };
    }

    const { data: isValid, error: rpcError } = await adminClient.rpc("verify_pin", {
      input_pin:   pin,
      stored_hash: creds.pin_hash,
    });

    if (rpcError || !isValid) {
      return { success: false, error: "Incorrect PIN. Please try again." };
    }

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
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
      safeLogError("signOrder", error, { orderId });
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
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_signed",
      title:       "Order signed and submitted",
      body:        `Order ${order.order_number} has been signed and is ready for review.`,
      oldStatus:   "pending_signature",
      newStatus:   "manufacturer_review",
      notifyRoles:    ["admin", "support_staff"],
      excludeUserId:  user.id,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* signAndSubmitOrder                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One-step sign & submit for clinical_provider on draft orders.
 * Goes directly draft → manufacturer_review (skipping pending_signature).
 */
export async function signAndSubmitOrder(
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

    const adminClient = createAdminClient();

    // Verify PIN
    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creds?.pin_hash) {
      return { success: false, error: "No PIN set. Please set up your provider PIN.", noPinSet: true };
    }

    const { data: isValid, error: rpcError } = await adminClient.rpc("verify_pin", {
      input_pin:   pin,
      stored_hash: creds.pin_hash,
    });

    if (rpcError || !isValid) {
      return { success: false, error: "Incorrect PIN. Please try again." };
    }

    // Fetch order
    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft") {
      return { success: false, error: "Only draft orders can be signed and submitted." };
    }

    // Verify provider is a member of this facility
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

    // Atomically move draft → manufacturer_review with signature
    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "manufacturer_review",
        signed_by:    user.id,
        signed_at:    new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      safeLogError("signAndSubmitOrder", error, { orderId });
      return { success: false, error: "Failed to sign and submit order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Order signed and submitted by provider",
      "draft",
      "manufacturer_review",
      user.id,
    );
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_signed",
      title:       "Order signed and submitted",
      body:        `Order ${order.order_number} has been signed and submitted for review.`,
      oldStatus:   "draft",
      newStatus:   "manufacturer_review",
      notifyRoles: ["admin", "support_staff"],
      excludeUserId: user.id,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* verifyProviderPin                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Pure PIN verification — no DB writes.  Used by all form-level Sign buttons
 * to authenticate the provider before marking the form signed in local state.
 */
export async function verifyProviderPin(
  pin: string,
): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role)) {
      return { success: false, error: "Only clinical providers can sign." };
    }

    const adminClient = createAdminClient();

    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creds?.pin_hash) {
      return { success: false, error: "No PIN set. Please set up your provider PIN.", noPinSet: true };
    }

    const { data: isValid, error: rpcError } = await adminClient.rpc("verify_pin", {
      input_pin:   pin,
      stored_hash: creds.pin_hash,
    });

    if (rpcError || !isValid) {
      return { success: false, error: "Incorrect PIN. Please try again." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getUnsignedForms                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Returns the names of forms that have not yet been physician-signed.
 * Used by the footer Sign Order / Sign & Submit handlers to block submission
 * until all 3 forms are signed.
 */
export async function getUnsignedForms(
  orderId: string,
): Promise<{ unsignedForms: string[] }> {
  try {
    const adminClient = createAdminClient();

    const [{ data: orderForm }, { data: ivr }] = await Promise.all([
      adminClient
        .from("order_form")
        .select("physician_signed_at")
        .eq("order_id", orderId)
        .maybeSingle(),
      adminClient
        .from("order_ivr")
        .select("physician_signed_at")
        .eq("order_id", orderId)
        .maybeSingle(),
    ]);

    const unsigned: string[] = [];
    if (!orderForm?.physician_signed_at) unsigned.push("Order Form");
    if (!ivr?.physician_signed_at) unsigned.push("IVR Form");

    return { unsignedForms: unsigned };
  } catch {
    return { unsignedForms: ["Order Form", "IVR Form"] };
  }
}

/* -------------------------------------------------------------------------- */
/* submitSignedOrder                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Submits an order for review after verifying all 3 forms are physician-signed.
 * No PIN required — the form-level PIN signing already authenticated the provider.
 * Works for both draft → manufacturer_review and pending_signature → manufacturer_review.
 */
export async function submitSignedOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role)) {
      return { success: false, error: "Only clinical providers can submit orders." };
    }

    const adminClient = createAdminClient();

    // Re-validate all required form signatures server-side
    const [{ data: orderForm }, { data: ivr }] = await Promise.all([
      adminClient
        .from("order_form")
        .select("physician_signed_at")
        .eq("order_id", orderId)
        .maybeSingle(),
      adminClient
        .from("order_ivr")
        .select("physician_signed_at")
        .eq("order_id", orderId)
        .maybeSingle(),
    ]);

    if (!orderForm?.physician_signed_at) {
      return { success: false, error: "Order Form is not signed." };
    }
    if (!ivr?.physician_signed_at) {
      return { success: false, error: "IVR Form is not signed." };
    }

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "draft" && order.order_status !== "pending_signature") {
      return { success: false, error: "Order cannot be submitted in its current status." };
    }

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

    const prevStatus = order.order_status as string;

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "manufacturer_review",
        signed_by:    user.id,
        signed_at:    new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      safeLogError("submitSignedOrder", error, { orderId });
      return { success: false, error: "Failed to submit order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Order signed and submitted by provider",
      prevStatus,
      "manufacturer_review",
      user.id,
    );
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_signed",
      title:       "Order signed and submitted",
      body:        `Order ${order.order_number} has been signed and submitted for review.`,
      oldStatus:   prevStatus,
      newStatus:   "manufacturer_review",
      notifyRoles: ["admin", "support_staff"],
      excludeUserId: user.id,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* signOrderFormPhysician                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Verifies the provider's PIN and records the physician signature on the
 * order form (physician_signed_at + physician_signed_by).  Does not change
 * the order status — use signOrder / signAndSubmitOrder for that.
 */
export async function signOrderFormPhysician(
  orderId: string,
  pin: string,
): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isClinicalProvider(role)) {
      return { success: false, error: "Only clinical providers can sign." };
    }

    const adminClient = createAdminClient();

    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creds?.pin_hash) {
      return { success: false, error: "No PIN set. Please set up your provider PIN.", noPinSet: true };
    }

    const { data: isValid, error: rpcError } = await adminClient.rpc("verify_pin", {
      input_pin:   pin,
      stored_hash: creds.pin_hash,
    });

    if (rpcError || !isValid) {
      return { success: false, error: "Incorrect PIN. Please try again." };
    }

    const now = new Date().toISOString();

    await adminClient
      .from("order_form")
      .update({ physician_signed_at: now, physician_signed_by: user.id })
      .eq("order_id", orderId);

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
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role) && !isSupport(role)) {
      return { success: false, error: "Only admins and support staff can approve orders." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "manufacturer_review") {
      return { success: false, error: "Order must be in manufacturer_review to approve." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "approved" })
      .eq("id", orderId);

    if (error) {
      safeLogError("approveOrder", error, { orderId });
      return { success: false, error: "Failed to approve order." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      "Order approved",
      "manufacturer_review",
      "approved",
      user.id,
    );
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_approved",
      title:       "Order approved! 🎉",
      body:        `Order ${order.order_number} has been approved and is being prepared for shipment.`,
      oldStatus:   "manufacturer_review",
      newStatus:   "approved",
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

    if (!isAdmin(role) && !isSupport(role)) {
      return { success: false, error: "Only admins and support staff can request additional info." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
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
        admin_notes:  notes ?? null,
      })
      .eq("id", orderId);

    if (error) {
      safeLogError("requestAdditionalInfo", error, { orderId });
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
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "info_requested",
      title:       "Additional information needed",
      body:        notes
        ? `Order ${order.order_number} requires additional information: "${notes}"`
        : `Order ${order.order_number} requires additional information before it can be approved.`,
      oldStatus:   "manufacturer_review",
      newStatus:   "additional_info_needed",
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
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "additional_info_needed") {
      return { success: false, error: "Order must be in additional_info_needed to resubmit." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({ order_status: "manufacturer_review", admin_notes: null })
      .eq("id", orderId);

    if (error) {
      safeLogError("resubmitForReview", error, { orderId });
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
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_resubmitted",
      title:       "Order resubmitted for review",
      body:        `Order ${order.order_number} has been resubmitted for manufacturer review.`,
      oldStatus:   "additional_info_needed",
      newStatus:   "manufacturer_review",
      notifyRoles:    ["admin", "support_staff"],
      excludeUserId:  userId,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* markOrderDelivered                                                          */
/* -------------------------------------------------------------------------- */

export async function markOrderDelivered(
  orderId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role) && !isSupport(role)) {
      return { success: false, error: "Only admins and support staff can mark orders as delivered." };
    }

    const adminClient = createAdminClient();

    const { data: order } = await adminClient
      .from("orders")
      .select("id, order_status, facility_id, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "shipped") {
      return { success: false, error: "Only shipped orders can be marked as delivered." };
    }

    const { error } = await adminClient
      .from("orders")
      .update({
        order_status: "delivered",
        delivery_status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      safeLogError("markOrderDelivered", error, { orderId });
      return { success: false, error: "Failed to mark order as delivered." };
    }

    await insertOrderHistory(adminClient, orderId, "Order marked as delivered", "shipped", "delivered", user.id);
    createNotifications({
      adminClient,
      orderId,
      orderNumber: order.order_number,
      facilityId:  order.facility_id,
      type:        "order_delivered",
      title:       "Order delivered",
      body:        `Order ${order.order_number} has been delivered.`,
      oldStatus:   "shipped",
      newStatus:   "delivered",
      notifyRoles:    ["clinical_staff", "clinical_provider"],
      excludeUserId:  user.id,
    }).catch(() => {});
    revalidatePath(ORDERS_PATH);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* signFormWithSpecimen — shared helper                                       */
/*                                                                            */
/* Combined PIN + specimen-signature commit for order_form and order_ivr.     */
/* Verifies PIN, locks the form, sets signed_at/by, then one-shot generates   */
/* the PDF with the signature image embedded in-memory. The signature PNG is  */
/* NOT persisted — consistent with "sign = final act, document frozen." If    */
/* admin later sends the order back to additional_info_needed, is_locked is   */
/* cleared and the provider re-signs with a fresh signature.                  */
/* -------------------------------------------------------------------------- */

async function signFormWithSpecimenImpl(args: {
  orderId: string;
  pin: string;
  signatureImage: string;
  formTable: "order_form" | "order_ivr";
  pdfFormType: "order_form" | "ivr";
}): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  const { orderId, pin, signatureImage, formTable, pdfFormType } = args;

  const pinResult = await verifyProviderPin(pin);
  if (!pinResult.success) return pinResult;

  if (!signatureImage || !signatureImage.startsWith("data:image/")) {
    return { success: false, error: "Specimen signature missing." };
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // physician_signed_at is the canonical "signed" signal for both tables.
    // is_locked is an additional legacy column that only exists on
    // order_form — where it's also referenced by RLS UPDATE policies, so we
    // keep writing it for that table to preserve that behavior. order_ivr
    // has no is_locked column; skip that write. The specimen PNG is stored
    // in physician_signature_image so the on-screen signature survives
    // reloads and PDF regens embed it without re-capturing.
    const updatePayload: Record<string, unknown> = {
      physician_signed_at: now,
      physician_signed_by: user.id,
      physician_signature_image: signatureImage,
    };
    if (formTable === "order_form") {
      updatePayload.is_locked = true;
    }
    const { error: updateErr } = await admin
      .from(formTable)
      .update(updatePayload)
      .eq("order_id", orderId);

    if (updateErr) {
      safeLogError(`signFormWithSpecimen:${formTable}`, updateErr, { orderId });
      return { success: false, error: updateErr.message };
    }

    // One-shot PDF regeneration with the signature image threaded in. The
    // generator reads the now-locked form row, embeds the signature at the
    // physician-signature spot, then uploads to storage + upserts
    // order_documents. No further regens happen while is_locked is true —
    // see generate-order-pdfs.tsx's lock guard.
    const { generateOrderPdf } = await import("@/lib/pdf/generate-order-pdfs");
    // ignoreLock: we just flipped is_locked=true above, so the generator's
    // normal lock guard would bail out before rendering. This is the single
    // callsite allowed to produce a PDF on a locked form — the signed one.
    const pdfResult = await generateOrderPdf(orderId, pdfFormType, admin, {
      signatureImage,
      ignoreLock: true,
    });
    if (!pdfResult.success) {
      // Log but don't fail the sign — DB state is committed. Admin can
      // re-trigger PDF generation via the Regenerate button if needed
      // (though it'll be gated by is_locked; they'd unlock first).
      safeLogError(`signFormWithSpecimen:${pdfFormType}`, pdfResult.error, { phase: "PDF gen", orderId });
    }

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    safeLogError(`signFormWithSpecimen:${formTable}`, err, { orderId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function signOrderFormWithSpecimen(
  orderId: string,
  pin: string,
  signatureImage: string,
): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  return signFormWithSpecimenImpl({
    orderId,
    pin,
    signatureImage,
    formTable: "order_form",
    pdfFormType: "order_form",
  });
}

export async function signIVRWithSpecimen(
  orderId: string,
  pin: string,
  signatureImage: string,
): Promise<{ success: boolean; error?: string; noPinSet?: boolean }> {
  return signFormWithSpecimenImpl({
    orderId,
    pin,
    signatureImage,
    formTable: "order_ivr",
    pdfFormType: "ivr",
  });
}

/* -------------------------------------------------------------------------- */
/* unsignForm — full revert                                                   */
/*                                                                            */
/* Clears physician_signed_at / physician_signed_by, unlocks the form, and    */
/* regenerates the PDF without the signature. Used by the Unsign button in    */
/* OrderFormDocument and IVRFormDocument. After this runs the form is fully   */
/* editable again and a Save / Discard bar will show on the next field edit.  */
/* -------------------------------------------------------------------------- */

async function unsignFormImpl(args: {
  orderId: string;
  formTable: "order_form" | "order_ivr";
  pdfFormType: "order_form" | "ivr";
}): Promise<{ success: boolean; error?: string }> {
  const { orderId, formTable, pdfFormType } = args;
  try {
    const supabase = await createClient();
    const role = await getUserRole(supabase);
    if (!isClinicalProvider(role)) {
      return { success: false, error: "Only clinical providers can unsign." };
    }

    const admin = createAdminClient();

    // Reverse what the sign action wrote. is_locked only exists on
    // order_form; skip that field for order_ivr. The signature image is
    // cleared so subsequent regens produce an unsigned PDF.
    const updatePayload: Record<string, unknown> = {
      physician_signed_at: null,
      physician_signed_by: null,
      physician_signature_image: null,
    };
    if (formTable === "order_form") {
      updatePayload.is_locked = false;
    }
    const { error: updateErr } = await admin
      .from(formTable)
      .update(updatePayload)
      .eq("order_id", orderId);

    if (updateErr) {
      safeLogError(`unsignForm:${formTable}`, updateErr, { orderId });
      return { success: false, error: updateErr.message };
    }

    // Regenerate the PDF to match the unsigned state (signature image drops
    // off automatically because the sign-with-specimen flow doesn't persist
    // it — and the lock guard is released now that physician_signed_at is
    // null). ignoreLock not needed but explicit for symmetry.
    const { generateOrderPdf } = await import("@/lib/pdf/generate-order-pdfs");
    const pdfResult = await generateOrderPdf(orderId, pdfFormType, admin, {
      ignoreLock: true,
    });
    if (!pdfResult.success) {
      safeLogError(`unsignForm:${pdfFormType}`, pdfResult.error, { phase: "PDF regen", orderId });
    }

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    safeLogError(`unsignForm:${formTable}`, err, { orderId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function unsignOrderForm(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  return unsignFormImpl({
    orderId,
    formTable: "order_form",
    pdfFormType: "order_form",
  });
}

export async function unsignIVR(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  return unsignFormImpl({
    orderId,
    formTable: "order_ivr",
    pdfFormType: "ivr",
  });
}
