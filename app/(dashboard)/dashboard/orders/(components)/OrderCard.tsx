"use client";

import type { DashboardOrder } from "@/utils/interfaces/orders";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";
import {
  User,
  Package,
  CalendarDays,
  FileText,
  MessageSquare,
} from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PillBadge } from "@/app/(components)/PillBadge";
import { cn } from "@/utils/utils";

interface OrderCardProps {
  order: DashboardOrder;
  onClick?: () => void;
  unreadCount?: number;
  statusOverride?: string;
  className?: string;
}

export function OrderCard({
  order,
  onClick,
  unreadCount,
  statusOverride,
  className,
}: OrderCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[12px] font-medium text-[var(--text2)] leading-snug"
          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
        >
          {order.order_number}
        </p>
        {statusOverride === "processed" ? (
          <PillBadge
            label={
              order.payment_status === "paid"
                ? "Paid"
                : order.payment_method === "pay_now"
                  ? "Pay Now"
                  : "Net-30"
            }
            variant={
              order.payment_status === "paid"
                ? "green"
                : order.payment_method === "pay_now"
                  ? "blue"
                  : "purple"
            }
          />
        ) : (
          <OrderStatusBadge status={getDisplayOrderStatus(order)} />
        )}
      </div>

      {/* Patient name */}
      {order.patient_full_name && (
        <p className="mt-1.5 text-[13px] font-medium text-[var(--navy)] truncate">
          {order.patient_full_name}
        </p>
      )}

      {/* Info rows */}
      <div className="mt-2 space-y-1">
        {order.wound_type && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text2)]">
            <FileText className="w-3 h-3 text-[var(--text3)] shrink-0" />
            <span className="capitalize">
              {order.wound_type.replace("_", " ")} wound
            </span>
          </div>
        )}
        {order.date_of_service && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text2)]">
            <CalendarDays className="w-3 h-3 text-[var(--text3)] shrink-0" />
            <span>DOS: {order.date_of_service}</span>
          </div>
        )}
        {order.product_name && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text2)]">
            <Package className="w-3 h-3 text-[var(--text3)] shrink-0" />
            <span className="truncate">
              {order.product_name} × {order.quantity}
            </span>
          </div>
        )}
      </div>

      {statusOverride === "processed" ? (
        <div className="flex items-center gap-1.5 mt-1.5">
          {order.payment_method === "net_30" &&
            order.payment_status !== "paid" &&
            order.invoice_due_at && (
              <span className="text-[10px] text-[var(--red)] font-medium">
                Due{" "}
                {new Date(order.invoice_due_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          {order.payment_status === "paid" && order.paid_at && (
            <span className="text-[10px] text-[var(--text3)]">
              Paid{" "}
              {new Date(order.paid_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Payment badge — approved / shipped / delivered orders */}
          {(order.order_status === "approved" ||
            order.order_status === "shipped" ||
            order.order_status === "delivered") &&
            order.payment_method && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <PillBadge
                  label={
                    order.payment_status === "paid"
                      ? "Paid"
                      : order.payment_method === "pay_now"
                        ? "Pay Now"
                        : "Net-30"
                  }
                  variant={
                    order.payment_status === "paid"
                      ? "green"
                      : order.payment_method === "pay_now"
                        ? "blue"
                        : "purple"
                  }
                />
                {order.payment_method === "net_30" &&
                  order.payment_status !== "paid" &&
                  order.invoice_due_at && (
                    <span className="text-[10px] text-[var(--red)] font-medium">
                      Due{" "}
                      {new Date(order.invoice_due_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  )}
              </div>
            )}

          {/* No payment yet badge for approved orders */}
          {order.order_status === "approved" && !order.payment_method && (
            <div className="mt-1.5">
              <PillBadge label="Payment Pending" variant="gold" />
            </div>
          )}
        </>
      )}

      {(unreadCount ?? 0) > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-1 text-[12px] text-[var(--navy)] font-semibold">
          <MessageSquare className="w-3 h-3" />
          <span>{unreadCount} unread</span>
        </div>
      )}
    </div>
  );
}
