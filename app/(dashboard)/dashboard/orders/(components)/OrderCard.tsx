"use client";

import type { DashboardOrder } from "@/utils/interfaces/orders";
import { User, Package, CalendarDays, FileText, MessageSquare } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface OrderCardProps {
  order: DashboardOrder;
  onClick?: () => void;
  unreadCount?: number;
}

export function OrderCard({ order, onClick, unreadCount }: OrderCardProps) {
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
        <OrderStatusBadge status={order.order_status} />
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

      {(unreadCount ?? 0) > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0] flex items-center gap-1 text-xs text-[#15689E] font-semibold">
          <MessageSquare className="w-3 h-3" />
          <span>{unreadCount} unread</span>
        </div>
      )}
    </div>
  );
}
