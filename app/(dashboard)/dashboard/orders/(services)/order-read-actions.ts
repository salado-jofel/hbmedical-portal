"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserOrThrow,
  getUserRole,
} from "@/lib/supabase/auth";
import { isClinicSide } from "@/utils/helpers/role";
import type {
  DashboardOrder,
  INotification,
  IOrderDocument,
  IOrderHistory,
  IOrderMessage,
  RawOrderRecord,
} from "@/utils/interfaces/orders";
import { mapOrder, mapOrders } from "@/utils/interfaces/orders";
import {
  ORDER_WITH_RELATIONS_SELECT,
  getUserFacilityId,
} from "./_shared";

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
/* getOrdersByFacility                                                        */
/* -------------------------------------------------------------------------- */

export async function getOrdersByFacility(
  facilityId: string,
): Promise<DashboardOrder[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("orders")
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("facility_id", facilityId)
    .order("placed_at", { ascending: false });

  if (error) {
    console.error("[getOrdersByFacility]", JSON.stringify(error));
    return [];
  }

  return mapOrders((data ?? []) as unknown as RawOrderRecord[]);
}

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
/* Notification read actions                                                  */
/* -------------------------------------------------------------------------- */

export async function getNotifications(): Promise<INotification[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  console.log("[getNotifications] user id:", user.id);

  // Use adminClient with explicit user_id filter — auth.uid() is unreliable
  // in server action context with publishable key (same issue as getOrderMessages)
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  console.log("[getNotifications] data:", data?.length, "error:", error?.message ?? null);

  if (error) {
    console.error("[getNotifications] error:", JSON.stringify(error));
    return [];
  }

  return (data ?? []).map((n) => ({
    id:          n.id,
    userId:      n.user_id,
    orderId:     n.order_id,
    type:        n.type,
    title:       n.title,
    body:        n.body,
    orderNumber: n.order_number,
    oldStatus:   n.old_status,
    newStatus:   n.new_status,
    isRead:      n.is_read,
    readAt:      n.read_at,
    createdAt:   n.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  console.log("[getUnreadCount] user:", user.id);

  const admin = createAdminClient();
  const { count } = await admin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  console.log("[getUnreadCount] count:", count);
  return count ?? 0;
}
