"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import {
  ORDERS_PATH,
  createNotifications,
} from "./_shared";
import { requireOrderAccess } from "@/lib/supabase/order-access";
import { safeLogError } from "@/lib/logging/safe-log";

/* -------------------------------------------------------------------------- */
/* sendOrderMessage                                                           */
/* -------------------------------------------------------------------------- */

export async function sendOrderMessage(
  orderId: string,
  message: string,
): Promise<{ success: boolean; error: string | null }> {
  const { userId } = await requireOrderAccess(orderId);
  const user = { id: userId };

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
    safeLogError("sendOrderMessage", insertError, { orderId });
    return {
      error:   insertError?.message ?? "Failed to send message.",
      success: false,
    };
  }

  // Mark sender's own message as read immediately — awaited so it always completes
  await adminClient
    .from("message_reads")
    .insert({ message_id: newMsg.id, user_id: user.id });

  // Notify other facility members + admins about the new message (non-blocking)
  void Promise.resolve(
    adminClient
      .from("orders")
      .select("facility_id, order_number, order_status")
      .eq("id", orderId)
      .single(),
  ).then(async ({ data: orderData }) => {
      if (!orderData) return;

      const { data: senderProfile } = await adminClient
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const senderName = senderProfile
        ? `${senderProfile.first_name ?? ""} ${senderProfile.last_name ?? ""}`.trim()
        : "Someone";

      const preview = message.trim().length > 60
        ? message.trim().slice(0, 60) + "..."
        : message.trim();

      // Only include admin in message notifications for orders they need to act on
      const adminStatuses = ["manufacturer_review", "additional_info_needed"];
      const notifyRoles = adminStatuses.includes(orderData.order_status)
        ? ["clinical_staff", "clinical_provider", "admin"]
        : ["clinical_staff", "clinical_provider"];

      await createNotifications({
        adminClient,
        orderId,
        orderNumber:   orderData.order_number,
        facilityId:    orderData.facility_id,
        type:          "message_received",
        title:         `New message on ${orderData.order_number}`,
        body:          `${senderName}: ${preview}`,
        oldStatus:     null,
        newStatus:     null,
        notifyRoles,
        excludeUserId: user.id,
      });
    }).catch(() => {});

  // Log history (non-blocking)
  void Promise.resolve(
    adminClient.from("order_history").insert({
      order_id:     orderId,
      performed_by: user.id,
      action:       "Message sent",
      old_status:   null,
      new_status:   null,
      notes:        null,
    }),
  ).catch(() => {});

  revalidatePath(ORDERS_PATH);
  return { success: true, error: null };
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
/* markNotificationRead                                                       */
/* -------------------------------------------------------------------------- */

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
}

/* -------------------------------------------------------------------------- */
/* markAllNotificationsRead                                                   */
/* -------------------------------------------------------------------------- */

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false);
}
