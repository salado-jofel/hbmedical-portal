import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

export const CLINICAL_STATUSES: OrderStatus[] = [
  "draft",
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "canceled",
];

export type KanbanStatus = OrderStatus;

export const KANBAN_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draft",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  pending_signature: {
    label: "Pending Signature",
    badge: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  manufacturer_review: {
    label: "Mfr. Review",
    badge: "bg-purple-50 text-purple-700",
    dot: "bg-purple-500",
  },
  additional_info_needed: {
    label: "Info Needed",
    badge: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  approved: {
    label: "Approved",
    badge: "bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
  shipped: {
    label: "Shipped",
    badge: "bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
  canceled: {
    label: "Canceled",
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
};

export function groupOrdersByStatus(
  orders: DashboardOrder[],
): Record<OrderStatus, DashboardOrder[]> {
  const grouped: Record<OrderStatus, DashboardOrder[]> = {
    draft: [],
    pending_signature: [],
    manufacturer_review: [],
    additional_info_needed: [],
    approved: [],
    shipped: [],
    canceled: [],
  };

  for (const order of orders) {
    const s = order.order_status;
    if (s in grouped) {
      grouped[s].push(order);
    }
  }

  return grouped;
}

/* ── Keep legacy types/exports for backwards compat ── */
export const BOARD_STATUSES = ["New Orders", "Delivered"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];
export const STATUS_CONFIG: Record<BoardStatus, { badge: string; dot: string; tab: string }> = {
  "New Orders": { badge: "bg-amber-50 text-amber-700", dot: "bg-[#E8821A]", tab: "text-[#E8821A]" },
  Delivered: { badge: "bg-[#F1F5F9] text-[#64748B]", dot: "bg-[#94A3B8]", tab: "text-[#64748B]" },
};
export function mapOrderToBoardStatus(order: DashboardOrder): BoardStatus {
  return order.board_status ?? "New Orders";
}
export function getFulfillmentLabel(order: DashboardOrder): string {
  return order.order_status;
}
