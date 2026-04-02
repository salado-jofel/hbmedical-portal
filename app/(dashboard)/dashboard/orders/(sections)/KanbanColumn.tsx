"use client";

import { Package } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { EmptyState } from "@/app/(components)/EmptyState";
import { OrderCard } from "../(components)/OrderCard";
import { STATUS_CONFIG, type BoardStatus } from "../(components)/kanban-config";

export function KanbanColumn({
  status,
  orders,
}: {
  status: BoardStatus;
  orders: DashboardOrder[];
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl min-w-55 flex-1">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className="text-sm font-semibold text-[#0F172A]">{status}</span>
        </div>

        <span className="min-w-5.5 h-5.5 flex items-center justify-center rounded-full bg-[#15689E] text-white text-xs font-bold px-1.5">
          {orders.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        {orders.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-[#E2E8F0]" />}
            message="No orders"
          />
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}
