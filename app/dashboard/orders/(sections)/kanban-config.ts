import type { Order } from "@/lib/interfaces/order";

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

function isFulfillmentEligible(order: Order): boolean {
  return order.payment_status === "paid" || order.payment_mode === "net_30";
}

// Move to Delivered column when the order is delivered and is eligible for fulfillment.
// For pay_now => must be paid
// For net_30 => can move through fulfillment without requiring payment first
export function mapOrderToBoardStatus(order: Order): BoardStatus {
  const isDelivered = order.status === "Delivered";

  return isDelivered && isFulfillmentEligible(order)
    ? "Delivered"
    : "New Orders";
}

// What to show on the right side of the card footer
export function getFulfillmentLabel(order: Order): string {
  const eligible = isFulfillmentEligible(order);

  if (!eligible) {
    if (order.payment_status === "payment_failed") return "Payment failed";
    if (order.payment_status === "overdue") return "Invoice overdue";
    if (order.payment_status === "invoice_sent") return "Invoice sent";
    return "Awaiting payment";
  }

  if (order.shipstation_sync_status === "failed") {
    return "ShipStation sync failed";
  }

  if (order.shipstation_sync_status === "syncing") {
    return "Syncing to ShipStation";
  }

  if (order.shipstation_sync_status === "sent") {
    return "Synced to ShipStation";
  }

  if (order.shipstation_sync_status === "ready") {
    return "Ready for ShipStation sync";
  }

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
      return order.payment_mode === "net_30"
        ? "Ready for fulfillment"
        : "Ready for ShipStation sync";
  }
}
