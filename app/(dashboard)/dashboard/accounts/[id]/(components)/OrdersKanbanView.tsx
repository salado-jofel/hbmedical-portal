"use client";

import { OrderCard } from "@/app/(dashboard)/dashboard/orders/(components)/OrderCard";
import {
  groupOrdersByStatus,
  KANBAN_STATUS_CONFIG,
  PAID_COLUMN_CONFIG,
  STATUS_COLUMN_STYLES,
} from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

const ADMIN_VISIBLE_STATUSES: OrderStatus[] = [
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
];

type KanbanCol =
  | { type: "status"; status: OrderStatus }
  | { type: "processed" };

const COLUMNS: KanbanCol[] = ADMIN_VISIBLE_STATUSES.flatMap(
  (status): KanbanCol[] =>
    status === "approved"
      ? [
          { type: "status" as const, status },
          { type: "processed" as const },
        ]
      : [{ type: "status" as const, status }],
);

export function OrdersKanbanView({
  orders,
  onOrderClick,
}: {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  const grouped = groupOrdersByStatus(orders);
  const approvedPending = (grouped["approved"] ?? []).filter((o) => !o.payment_method);
  const approvedProcessed = (grouped["approved"] ?? []).filter((o) => !!o.payment_method);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const isProcessed = col.type === "processed";
        const key = isProcessed ? "processed" : col.status;
        const config = isProcessed ? PAID_COLUMN_CONFIG : KANBAN_STATUS_CONFIG[col.status];
        const colOrders = isProcessed
          ? approvedProcessed
          : col.status === "approved"
            ? approvedPending
            : (grouped[col.status] ?? []);

        const style = STATUS_COLUMN_STYLES[isProcessed ? "paid" : col.status] ?? STATUS_COLUMN_STYLES.draft;
        return (
          <div
            key={key}
            className={cn("flex-shrink-0 w-72 rounded-xl p-2.5 min-h-[200px]", style.bg)}
          >
            <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg mb-3", style.headerBg)}>
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#334155]">{config.label}</span>
              </div>
              <span className="text-xs font-medium text-[#64748b] bg-white rounded-full px-2 py-0.5 shadow-sm">
                {colOrders.length}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {colOrders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-gray-400">No orders</p>
                </div>
              ) : (
                colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusOverride={isProcessed ? "processed" : undefined}
                    onClick={() => onOrderClick(order.id)}
                    unreadCount={0}
                    className="bg-white border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#cbd5e1]"
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
