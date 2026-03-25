import type { Order } from "@/lib/interfaces/order";
import {
  BOARD_STATUSES,
  BoardStatus,
  mapOrderToBoardStatus,
} from "@/app/dashboard/orders/(sections)/kanban-config";

export function groupOrdersByBoardStatus(
  orders: Order[],
): Record<BoardStatus, Order[]> {
  const grouped = BOARD_STATUSES.reduce(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as Record<BoardStatus, Order[]>,
  );

  for (const order of orders) {
    const boardStatus = mapOrderToBoardStatus(order);
    grouped[boardStatus].push(order);
  }

  return grouped;
}
