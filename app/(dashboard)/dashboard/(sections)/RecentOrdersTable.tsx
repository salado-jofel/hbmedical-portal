"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/app/(components)/StatusBadge";
import { TableCard } from "@/app/(components)/TableCard";
import { DataTable } from "@/app/(components)/DataTable";
import { OrderMobileCard } from "@/app/(components)/OrderMobileCard";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import { TableColumn } from "@/utils/interfaces/table-column";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const columns: TableColumn<DashboardOrder>[] = [
  {
    key: "order_number",
    label: "Order ID",
    render: (order) => (
      <span className="font-medium text-[#0F172A]">
        {order.order_number ?? "—"}
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
    key: "total_amount",
    label: "Amount",
    render: (order) => <span>{formatAmount(order.total_amount ?? 0)}</span>,
  },
  {
    key: "order_status",
    label: "Status",
    render: (order) => <StatusBadge status={order.order_status ?? "draft"} />,
  },
];

interface RecentOrdersTableProps {
  initialOrders: DashboardOrder[];
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
      <div className="divide-y divide-[#F1F5F9] md:hidden">
        {recent.length > 0 ? (
          recent.map((order) => (
            <OrderMobileCard key={order.id} order={order} />
          ))
        ) : (
          <div className="p-4 text-sm text-[#94A3B8]">No Orders Yet</div>
        )}
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={recent}
          keyExtractor={(row) => String(row.id ?? "")}
          emptyMessage="No Orders Yet"
          headerVariant="minimal"
        />
      </div>
    </TableCard>
  );
}
