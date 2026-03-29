import {
  BoardStatus,
  BOARD_STATUSES,
  mapOrderToBoardStatus,
} from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { DashboardOrder } from "../interfaces/orders";

export function groupOrdersByBoardStatus(
  orders: DashboardOrder[],
): Record<BoardStatus, DashboardOrder[]> {
  const grouped = BOARD_STATUSES.reduce(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as Record<BoardStatus, DashboardOrder[]>,
  );

  for (const order of orders) {
    const boardStatus = mapOrderToBoardStatus(order);
    grouped[boardStatus].push(order);
  }

  return grouped;
}
