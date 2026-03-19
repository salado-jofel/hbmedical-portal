// Shared by OrderCard, KanbanColumn, MobileKanbanTabs, KanBoard
export const BOARD_STATUSES = ["Processing", "Shipped", "Delivered"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const STATUS_CONFIG: Record<
  BoardStatus,
  { badge: string; dot: string; tab: string; next?: BoardStatus }
> = {
  Processing: {
    badge: "bg-yellow-50 text-yellow-600",
    dot: "bg-yellow-400",
    tab: "text-yellow-600",
    next: "Shipped",
  },
  Shipped: {
    badge: "bg-purple-50 text-purple-600",
    dot: "bg-purple-400",
    tab: "text-purple-600",
    next: "Delivered",
  },
  Delivered: {
    badge: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-400",
    tab: "text-emerald-600",
    next: undefined,
  },
};
