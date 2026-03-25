"use client";

import { useMemo } from "react";
import { StatusBadge } from "../../(components)/StatusBadge";
import { TableCard } from "@/app/(components)/TableCard";
import { DataTable } from "@/app/(components)/DataTable";
import { OrderMobileCard } from "@/app/(components)/OrderMobileCard";
import { formatAmount, formatDate } from "@/utils/formatter";
import { TableColumn } from "@/lib/interfaces/table-column";
import { Order } from "@/lib/interfaces/order";

const columns: TableColumn<Order>[] = [
  {
    key: "order_id",
    label: "Order ID",
    render: (order) => (
      <span className="font-medium text-slate-700">
        {order.order_id ?? "—"}
      </span>
    ),
  },
  {
    key: "created_at",
    label: "Date",
    render: (order) => (
      <span>{order.created_at ? formatDate(order.created_at) : "—"}</span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    render: (order) => (
      <span>{formatAmount(order.amount ?? 0)}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (order) => (
      <StatusBadge status={order.status ?? "Draft"} />
    ),
  },
];

interface RecentOrdersTableProps {
  initialOrders: Order[];
}

export default function RecentOrdersTable({
  initialOrders,
}: RecentOrdersTableProps) {
  const recent = useMemo(
    () =>
      [...(initialOrders ?? [])]
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 10),
    [initialOrders],
  );

  return (
    <TableCard title={`Recent Orders (${recent.length})`}>
      <div className="divide-y divide-slate-100 md:hidden">
        {recent.length > 0 ? (
          recent.map((order) => (
            <OrderMobileCard key={order.id ?? order.order_id} order={order} />
          ))
        ) : (
          <div className="p-4 text-sm text-slate-500">No Orders Yet</div>
        )}
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={recent}
          keyExtractor={(row) => String(row.id ?? row.order_id ?? "")}
          emptyMessage="No Orders Yet"
          headerVariant="minimal"
        />
      </div>
    </TableCard>
  );
}
