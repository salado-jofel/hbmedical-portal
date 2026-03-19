import { formatDate, formatAmount } from "@/utils/formatter";
import { Order } from "@/app/(interfaces)/order";
import { StatusBadge } from "./StatusBadge";

interface OrderMobileCardProps {
  order: Order;
}

export function OrderMobileCard({ order }: OrderMobileCardProps) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700 truncate">
          {order.order_id}
        </span>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
        <span className="font-medium text-slate-600">
          {order.facility_name ?? "—"}
        </span>
        {order.product_name && (
          <>
            <span className="text-slate-300">·</span>
            <span>{order.product_name}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700">
          {formatAmount(order.amount)}
        </span>
        <span className="text-slate-400">{formatDate(order.created_at)}</span>
      </div>
    </div>
  );
}
