"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import type { Order } from "@/app/(interfaces)/order";
import { BOARD_STATUSES, BoardStatus } from "./kanban-config";
import { MobileKanbanTabs } from "./MobileKanbanTabs";
import { KanbanColumn } from "./KanbanColumn";

export default function KanbanBoard() {
  const items = useAppSelector((state) => state.orders.items);

  const grouped = useMemo(
    () =>
      BOARD_STATUSES.reduce<Record<BoardStatus, Order[]>>(
        (acc, status) => {
          acc[status] = items.filter((o) => o.status === status);
          return acc;
        },
        {} as Record<BoardStatus, Order[]>,
      ),
    [items],
  );

  return (
    <>
      <div className="md:hidden">
        <MobileKanbanTabs grouped={grouped} />
      </div>

      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} orders={grouped[status]} />
        ))}
      </div>
    </>
  );
}
