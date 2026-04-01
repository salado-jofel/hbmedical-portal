import Link from "next/link";
import { ShoppingCart, ExternalLink } from "lucide-react";
import { EmptyState } from "@/app/(components)/EmptyState";
import type { DashboardOrder } from "@/utils/interfaces/orders";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500",
  submitted: "bg-blue-50 text-[#15689E]",
  canceled: "bg-red-50 text-red-600",
};

interface OrdersTabProps {
  orders: DashboardOrder[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
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
      <p className="text-sm text-slate-500">
        {orders.length} order{orders.length !== 1 ? "s" : ""}
      </p>

      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#15689E]/8 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-[#15689E]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {order.order_number}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {order.product_name} &times; {order.quantity}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-slate-700">
                {formatCurrency(order.total_amount)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium sentence-case ${
                  STATUS_STYLES[order.order_status] ?? "bg-slate-100 text-slate-500"
                }`}
              >
                {order.order_status}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#15689E] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
