"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { STATUS_COLORS, TYPE_ICONS } from "@/utils/constants/notifications";
import { cn } from "@/utils/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/app/(dashboard)/dashboard/orders/(services)/order-read-actions";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/dashboard/orders/(services)/order-messaging-actions";
import type { INotification } from "@/utils/interfaces/orders";
import { useRouter, usePathname } from "next/navigation";

export function NotificationBell({
  currentUserId,
  collapsed = false,
}: {
  currentUserId: string;
  collapsed?: boolean;
}) {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  console.log("[NotificationBell] render", { currentUserId, unreadCount, notifications: notifications.length });

  // Load when userId arrives
  useEffect(() => {
    if (!currentUserId) return;
    console.log("[NotificationBell] userId ready, loading...");
    loadNotifications();
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close panel on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Realtime: new notifications for this user
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log("[NotificationBell] realtime event:", payload);
          const n = payload.new as Record<string, unknown>;

          const notif: INotification = {
            id:          n.id as string,
            userId:      n.user_id as string,
            orderId:     n.order_id as string,
            type:        n.type as string,
            title:       n.title as string,
            body:        n.body as string,
            orderNumber: n.order_number as string,
            oldStatus:   n.old_status as string | null,
            newStatus:   n.new_status as string | null,
            isRead:      false,
            readAt:      null,
            createdAt:   n.created_at as string,
          };

          setNotifications((prev) => [notif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  async function loadNotifications() {
    console.log("[NotificationBell] loading notifications...");
    setLoading(true);
    const [notifs, count] = await Promise.all([
      getNotifications(),
      getUnreadNotificationCount(),
    ]);
    console.log("[NotificationBell] loaded:", { notifs: notifs.length, count });
    setNotifications(notifs);
    setUnreadCount(count);
    setLoading(false);
  }

  async function handleBellClick() {
    const next = !open;
    setOpen(next);
    if (next && currentUserId) {
      await loadNotifications();
    }
  }

  async function handleMarkRead(notifId: string) {
    await markNotificationRead(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Nav-item styled button */}
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="Notifications"
        className={cn(
          "relative flex items-center text-sm font-normal transition-all duration-150 select-none outline-none rounded-lg w-full",
          collapsed
            ? "justify-center w-10 h-10 mx-auto"
            : "gap-2.5 px-3 py-[7px]",
          open
            ? "bg-[#EBF4FF] text-[#15689E] font-medium"
            : "text-[#475569] hover:bg-[#F5F8FB] hover:text-[#0F172A]",
        )}
      >
        <Bell
          className={cn(
            "shrink-0 transition-colors duration-150",
            collapsed ? "w-[17px] h-[17px]" : "w-[15px] h-[15px]",
            open ? "text-[#15689E]" : "text-[#94A3B8]",
          )}
          strokeWidth={open ? 2.2 : 1.8}
        />

        {!collapsed && (
          <span className="truncate leading-none tracking-[-0.01em]">
            Notifications
          </span>
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none",
              collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed, floats to the right of sidebar */}
      {open && (
        <div className={cn(
          "fixed top-4 w-80 max-h-[480px]",
          "bg-white rounded-2xl shadow-2xl",
          "border border-gray-100 overflow-hidden",
          "flex flex-col z-[100]",
          collapsed ? "left-[72px]" : "left-[228px]",
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#15689E] font-semibold hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-[#15689E] rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-300 mt-1">Order updates will appear here</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) handleMarkRead(notif.id);
                    setOpen(false);
                    const tab = notif.type === "message_received"
                      ? "conversation"
                      : "overview";
                    const isOnOrdersPage =
                      window.location.pathname === "/dashboard/orders";
                    if (isOnOrdersPage) {
                      window.dispatchEvent(
                        new CustomEvent("open-order-modal", {
                          detail: { orderId: notif.orderId, tab },
                        }),
                      );
                    } else {
                      sessionStorage.setItem(
                        "pending-order-open",
                        JSON.stringify({ orderId: notif.orderId, tab }),
                      );
                      router.push("/dashboard/orders");
                    }
                  }}
                  className={cn(
                    "flex gap-3 px-4 py-3 cursor-pointer",
                    "border-b border-gray-50 last:border-0",
                    "hover:bg-gray-50 transition-colors",
                    !notif.isRead && "bg-blue-50/40",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0",
                      STATUS_COLORS[notif.type] ?? "bg-gray-100 text-gray-600",
                    )}
                  >
                    {TYPE_ICONS[notif.type] ?? <Bell className="w-4 h-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm text-gray-800 leading-snug", !notif.isRead && "font-semibold")}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {notif.body}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#15689E] shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
