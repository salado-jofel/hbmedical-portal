// Shared by OrderCard, KanbanColumn, MobileKanbanTabs, KanBoard
export const BOARD_STATUSES = ["Processing", "Shipped", "Delivered"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const STATUS_CONFIG: Record<
  BoardStatus,
  { badge: string; dot: string; tab: string; next?: BoardStatus }
> = {
  Processing: {
    badge: "bg-[#f5a255]/15 text-[#f5a255]",
    dot: "bg-[#f5a255]",
    tab: "text-[#f5a255]",
    next: "Shipped",
  },
  Shipped: {
    badge: "bg-[#15689E]/10 text-[#15689E]",
    dot: "bg-[#15689E]",
    tab: "text-[#15689E]",
    next: "Delivered",
  },
  Delivered: {
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
    tab: "text-slate-500",
    next: undefined,
  },
};
