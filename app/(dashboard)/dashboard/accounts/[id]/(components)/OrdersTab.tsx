"use client";

import { ShoppingCart, Loader2 } from "lucide-react";
import { EmptyState } from "@/app/(components)/EmptyState";
import type { DashboardOrder } from "@/utils/interfaces/orders";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#F1F5F9] text-[#64748B]",
  submitted: "bg-[#EFF6FF] text-[#15689E]",
  canceled: "bg-red-50 text-red-600",
};

interface OrdersTabProps {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
  loadingOrderId: string | null;
}

export function OrdersTab({ orders, onOrderClick, loadingOrderId }: OrdersTabProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        message="No orders for this account"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748B]">
        {orders.length} order{orders.length !== 1 ? "s" : ""}
      </p>

      <div className="rounded-xl border border-[#E2E8F0] overflow-hidden divide-y divide-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onOrderClick(order.id)}
            disabled={loadingOrderId === order.id}
            className="w-full text-left flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFBFC] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#15689E]/8 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-[#15689E]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">
                  {order.order_number}
                </p>
                <p className="text-xs text-[#94A3B8] mt-0.5 truncate">
                  {order.product_name} &times; {order.quantity}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-[#0F172A]">
                {formatCurrency(order.total_amount)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium sentence-case ${
                  STATUS_STYLES[order.order_status] ?? "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {order.order_status}
              </span>
              {loadingOrderId === order.id ? (
                <Loader2 className="w-3.5 h-3.5 text-[#15689E] animate-spin" />
              ) : (
                <div className="w-3.5 h-3.5" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
