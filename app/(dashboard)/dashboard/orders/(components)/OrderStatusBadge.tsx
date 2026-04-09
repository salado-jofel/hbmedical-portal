"use client";

import { cn } from "@/utils/utils";
import type { OrderStatus } from "@/utils/interfaces/orders";

const STATUS_CONFIG: Record<
  OrderStatus | "processed",
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-[var(--gold-lt)] text-[var(--gold)] border-[var(--gold-border)]",
  },
  pending_signature: {
    label: "Pending Signature",
    className: "bg-[var(--blue-lt)] text-[var(--blue)] border-[var(--blue-lt)]",
  },
  manufacturer_review: {
    label: "Mfr. Review",
    className: "bg-[var(--purple-lt)] text-[var(--purple)] border-[var(--purple-lt)]",
  },
  additional_info_needed: {
    label: "Info Needed",
    className: "bg-[var(--red-lt)] text-[var(--red)] border-[var(--red-lt)]",
  },
  approved: {
    label: "Approved",
    className: "bg-[var(--green-lt)] text-[var(--green)] border-[var(--green-lt)]",
  },
  shipped: {
    label: "Shipped",
    className: "bg-[var(--teal-lt)] text-[var(--teal)] border-[var(--teal-lt)]",
  },
  delivered: {
    label: "Delivered",
    className: "bg-[var(--green-lt)] text-[var(--green)] border-[var(--green-lt)]",
  },
  canceled: {
    label: "Canceled",
    className: "bg-[var(--border)] text-[var(--text3)] border-[var(--border)]",
  },
  processed: {
    label: "Processed",
    className: "bg-[var(--green-lt)] text-[var(--green)] border-[var(--green-lt)]",
  },
};

interface OrderStatusBadgeProps {
  status: OrderStatus | "processed";
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-[var(--border)] text-[var(--text3)] border-[var(--border)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap text-center",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
