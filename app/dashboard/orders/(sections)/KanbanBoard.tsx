import type { Order } from "@/app/(interfaces)/order";
import { BOARD_STATUSES } from "./kanban-config";
import { KanbanColumn } from "./KanbanColumn";
import { groupOrdersByBoardStatus } from "@/utils/group-orders-by-status";

export function KanbanBoard({ orders }: { orders: Order[] }) {
    const grouped = groupOrdersByBoardStatus(orders);

    return (
        <div className="flex gap-4 overflow-x-auto">
            {BOARD_STATUSES.map((status) => (
                <KanbanColumn key={status} status={status} orders={grouped[status]} />
            ))}
        </div>
    );
}
