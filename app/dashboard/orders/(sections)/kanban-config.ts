import type { Order } from "@/app/(interfaces)/order";

// The board only shows fulfillment buckets
export const BOARD_STATUSES = ["New Orders", "Delivered"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const STATUS_CONFIG: Record<
  BoardStatus,
  { badge: string; dot: string; tab: string }
> = {
  "New Orders": {
    badge: "bg-[#f5a255]/15 text-[#f5a255]",
    dot: "bg-[#f5a255]",
    tab: "text-[#f5a255]",
  },
  Delivered: {
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
    tab: "text-slate-500",
  },
};

// Move to Delivered column ONLY if paid + delivered
export function mapOrderToBoardStatus(order: Order): BoardStatus {
  const isPaid = order.payment_status === "paid";
  const isDelivered = order.status === "Delivered";

  return isPaid && isDelivered ? "Delivered" : "New Orders";
}

// What to show on the right side of the card footer
export function getFulfillmentLabel(order: Order): string {
  const isPaid = order.payment_status === "paid";

  // Unpaid orders should never show shipstation progress
  if (!isPaid) return "Awaiting payment";

  switch (order.status) {
    case "Delivered":
      return "Delivered";
    case "Shipped":
      return "Shipped";
    case "Approved":
      return "Approved";
    case "Processing":
      return "Processing";
    case "Submitted":
      return "Submitted";
    case "Draft":
      return "Draft";
    default:
      return "Awaiting ShipStation";
  }
}
