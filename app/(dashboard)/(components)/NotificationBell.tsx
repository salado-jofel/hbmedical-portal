"use client";

import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Load when userId arrives
  useEffect(() => {
    if (!currentUserId) return;
    loadNotifications();
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLoading(true);
    const [notifs, count] = await Promise.all([
      getNotifications(),
      getUnreadNotificationCount(),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
    setLoading(false);
  }

  async function handleOpenChange(next: boolean) {
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

  // The collapsed (TopBar) variant is rendered inside a navy-bg header that
  // applies !important text/svg color overrides via parent CSS — see
  // TopBar.tsx's `[&_svg]:!text-white/60`. The open-state styles for that
  // variant therefore use a dark translucent bg (`bg-white/15`) that reads
  // correctly with the parent's forced-white icon, instead of the light-blue
  // sidebar bg which made the white icon invisible against a near-white bg.
  const bellButton = (
    <button
      type="button"
      aria-label="Notifications"
      className={cn(
        "relative flex items-center text-sm font-normal transition-all duration-150 select-none outline-none rounded-lg w-full",
        collapsed
          ? "justify-center w-10 h-10 mx-auto"
          : "gap-2.5 px-3 py-[7px]",
        open
          ? collapsed
            ? "bg-white/15 font-medium"
            : "bg-[#EBF4FF] text-[var(--navy)] font-medium"
          : "text-[#475569] hover:bg-[#F5F8FB] hover:text-[var(--navy)]",
      )}
    >
      <Bell
        className={cn(
          "shrink-0 transition-colors duration-150",
          collapsed ? "w-5 h-5" : "w-[15px] h-[15px]",
          // In collapsed mode the parent header forces the SVG color via
          // !important — leave it alone so the override wins consistently.
          // Sidebar (non-collapsed) variant: explicit color tracking open state.
          !collapsed && (open ? "text-[var(--navy)]" : "text-[var(--text3)]"),
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
            "min-w-[18px] h-[18px] px-1 bg-[#dc2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none",
            collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto",
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  // Before client mount: render trigger only (no Popover to avoid hydration mismatch)
  if (!mounted) {
    return bellButton;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {bellButton}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[calc(100vw-32px)] max-w-[360px] p-0 rounded-[10px] border border-[#e2e8f0] bg-white shadow-lg flex flex-col overflow-hidden"
        style={{ maxHeight: "480px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0] shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-[var(--navy)]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-[var(--teal)] text-white text-xs font-semibold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[12px] text-[var(--teal)] font-medium hover:opacity-75 transition-opacity"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#e2e8f0] border-t-[var(--navy)] rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-8 h-8 text-[#cbd5e1] mb-3" />
              <p className="text-[13px] text-[#64748b]">No notifications</p>
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
                  "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[#f1f5f9] last:border-0",
                  "hover:bg-[#f8fafc] transition-colors",
                  !notif.isRead && "bg-[#f0fdf4]",
                )}
              >
                {/* Dot indicator */}
                <div
                  className="mt-[5px] w-2 h-2 rounded-full shrink-0"
                  style={{ background: notif.isRead ? "transparent" : "var(--teal)" }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-[13px] leading-snug text-[var(--navy)]",
                    !notif.isRead && "font-semibold",
                  )}>
                    {notif.title}
                  </p>
                  <p className="text-[12px] text-[#64748b] mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.body}
                  </p>
                  <p className="text-[11px] text-[#64748b] mt-1">
                    {new Date(notif.createdAt).toLocaleString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
