"use client";

import { cn } from "@/utils/utils";
import type { OrderStatus } from "@/utils/interfaces/orders";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  pending_signature: {
    label: "Pending Signature",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  manufacturer_review: {
    label: "Mfr. Review",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  additional_info_needed: {
    label: "Info Needed",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  shipped: {
    label: "Shipped",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  delivered: {
    label: "Delivered",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  canceled: {
    label: "Canceled",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
