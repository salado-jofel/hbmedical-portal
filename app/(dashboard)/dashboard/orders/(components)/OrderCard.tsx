"use client";

import type { DashboardOrder } from "@/utils/interfaces/orders";
import { User, Package, CalendarDays, FileText, MessageSquare } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { cn } from "@/utils/utils";

interface OrderCardProps {
  order: DashboardOrder;
  onClick?: () => void;
  unreadCount?: number;
  statusOverride?: string;
}

export function OrderCard({ order, onClick, unreadCount, statusOverride }: OrderCardProps) {
  return (
    <div
      className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15689E]">
            Order
          </p>
          <h3 className="text-sm font-bold text-[#0F172A]">{order.order_number}</h3>
        </div>
        {statusOverride === "paid" ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-green-100 text-green-700 border-green-200">
            ✓ Paid
          </span>
        ) : (
          <OrderStatusBadge status={order.order_status} />
        )}
      </div>

      {/* Info rows */}
      <div className="mt-3 space-y-1.5">
        {order.patient_full_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{order.patient_full_name}</span>
          </div>
        )}
        {order.wound_type && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="capitalize">{order.wound_type.replace("_", " ")} wound</span>
          </div>
        )}
        {order.date_of_service && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>DOS: {order.date_of_service}</span>
          </div>
        )}
        {order.product_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {order.product_name} × {order.quantity}
            </span>
          </div>
        )}
      </div>

      {statusOverride === "paid" ? (
        /* Paid column — show paid date only */
        order.paid_at && (
          <div className="mt-1">
            <span className="text-[9px] text-gray-400">
              Paid {new Date(order.paid_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              })}
            </span>
          </div>
        )
      ) : (
        <>
          {/* Payment badge — approved / shipped / delivered orders */}
          {(order.order_status === "approved" ||
            order.order_status === "shipped" ||
            order.order_status === "delivered") &&
            order.payment_method && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  order.payment_status === "paid"
                    ? "bg-green-100 text-green-700"
                    : order.payment_method === "pay_now"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-purple-100 text-purple-700",
                )}>
                  {order.payment_status === "paid"
                    ? "✓ Paid"
                    : order.payment_method === "pay_now"
                    ? "💳 Pay Now"
                    : "📄 Net-30"}
                </span>
                {order.payment_method === "net_30" &&
                  order.payment_status !== "paid" &&
                  order.invoice_due_at && (
                    <span className="text-[9px] text-red-500 font-semibold">
                      Due {new Date(order.invoice_due_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </span>
                  )}
              </div>
            )}

          {/* No payment yet badge for approved orders */}
          {order.order_status === "approved" && !order.payment_method && (
            <div className="mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                💳 Payment Pending
              </span>
            </div>
          )}
        </>
      )}

      {(unreadCount ?? 0) > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0] flex items-center gap-1 text-xs text-[#15689E] font-semibold">
          <MessageSquare className="w-3 h-3" />
          <span>{unreadCount} unread</span>
        </div>
      )}
    </div>
  );
}
