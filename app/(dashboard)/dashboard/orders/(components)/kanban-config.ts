import type { DashboardOrder } from "@/utils/interfaces/orders";

export const BOARD_STATUSES = ["New Orders", "Delivered"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const STATUS_CONFIG: Record<
  BoardStatus,
  { badge: string; dot: string; tab: string }
> = {
  "New Orders": {
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-[#E8821A]",
    tab: "text-[#E8821A]",
  },
  Delivered: {
    badge: "bg-[#F1F5F9] text-[#64748B]",
    dot: "bg-[#94A3B8]",
    tab: "text-[#64748B]",
  },
};

export function mapOrderToBoardStatus(order: DashboardOrder): BoardStatus {
  return order.board_status;
}

export function getFulfillmentLabel(order: DashboardOrder): string {
  if (order.order_status === "draft") return "Draft";
  if (order.order_status === "canceled") return "Canceled";

  if (order.delivery_status === "delivered") return "Delivered";
  if (order.delivery_status === "in_transit") return "In transit";
  if (order.delivery_status === "label_created") return "Label created";
  if (order.delivery_status === "returned") return "Returned";
  if (order.delivery_status === "exception") return "Delivery issue";
  if (order.delivery_status === "canceled") return "Canceled";

  if (order.fulfillment_status === "fulfilled") return "Fulfilled";
  if (order.fulfillment_status === "processing") return "Processing";
  if (order.fulfillment_status === "canceled") return "Canceled";

  if (order.payment_status === "failed") return "Payment failed";
  if (order.payment_status === "pending") return "Awaiting payment";
  if (order.payment_status === "paid") return "Paid";
  if (order.payment_status === "refunded") return "Refunded";
  if (order.payment_status === "partially_refunded")
    return "Partially refunded";
  if (order.payment_status === "canceled") return "Canceled";

  return "Pending";
}
