import type { DashboardOrder } from "@/utils/interfaces/orders";
import { BOARD_STATUSES } from "../(components)/kanban-config";
import { KanbanColumn } from "./KanbanColumn";
import { groupOrdersByBoardStatus } from "@/utils/helpers/group-orders-by-status";

export function KanbanBoard({ orders, canSign }: { orders: DashboardOrder[]; canSign: boolean }) {
  const grouped = groupOrdersByBoardStatus(orders);

  return (
    <div className="flex gap-4 overflow-x-auto">
      {BOARD_STATUSES.map((status) => (
        <KanbanColumn key={status} status={status} orders={grouped[status]} canSign={canSign} />
      ))}
    </div>
  );
}
