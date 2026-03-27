"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { CreateOrderModal } from "./CreateOrderModal";
import { KanbanColumn } from "./KanbanColumn";
import { MobileKanbanTabs } from "./MobileKanbanTabs";
import { BOARD_STATUSES, type BoardStatus } from "./kanban-config";
import Header from "./Header";
import { createClient } from "@/lib/supabase/client";

function sortOrdersDesc(orders: DashboardOrder[]) {
  return [...orders].sort((a, b) => {
    const aTime = a.placed_at
      ? new Date(a.placed_at).getTime()
      : a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

    const bTime = b.placed_at
      ? new Date(b.placed_at).getTime()
      : b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

    return bTime - aTime;
  });
}

function groupOrdersByBoardStatus(
  orders: DashboardOrder[],
): Record<BoardStatus, DashboardOrder[]> {
  return sortOrdersDesc(orders).reduce<Record<BoardStatus, DashboardOrder[]>>(
    (acc, order) => {
      acc[order.board_status].push(order);
      return acc;
    },
    {
      "New Orders": [],
      Delivered: [],
    },
  );
}

export function OrdersPageClient() {
  const router = useRouter();
  const orders = useAppSelector((state) => state.orders.items);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grouped = useMemo(
    () => groupOrdersByBoardStatus(orders ?? []),
    [orders],
  );

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 800);
    };

    const channel = supabase
      .channel("orders-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          scheduleRefresh();
        },
      )
      .subscribe();

    const handleFocusRefresh = () => {
      router.refresh();
    };

    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        router.refresh();
      }
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="space-y-6">
      <Header />
      <div className="md:hidden">
        <MobileKanbanTabs grouped={grouped} />
      </div>

      <div className="hidden gap-4 overflow-x-auto pb-2 md:flex">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            orders={grouped[status] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
