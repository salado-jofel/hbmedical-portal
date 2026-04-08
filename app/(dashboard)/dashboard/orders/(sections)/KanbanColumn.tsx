"use client";

import { Package } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { EmptyState } from "@/app/(components)/EmptyState";
import { KanbanColumn as KanbanColumnShell } from "@/app/(components)/KanbanColumn";
import { OrderCard } from "../(components)/OrderCard";
import { STATUS_CONFIG, type BoardStatus } from "../(components)/kanban-config";

export function KanbanColumn({
  status,
  orders,
  canSign,
}: {
  status: BoardStatus;
  orders: DashboardOrder[];
  canSign: boolean;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <KanbanColumnShell
      label={status}
      count={orders.length}
      dot={config.dot}
      className="min-w-55 flex-1"
      bodyClassName="max-h-[calc(100vh-280px)]"
    >
      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-[#E2E8F0]" />}
          message="No orders"
        />
      ) : (
        orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
          />
        ))
      )}
    </KanbanColumnShell>
  );
}
