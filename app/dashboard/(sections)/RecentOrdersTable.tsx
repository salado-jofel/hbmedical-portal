"use client";

import { useAppSelector } from "@/store/hooks";
import { useMemo } from "react";
import { StatusBadge } from "../../(components)/StatusBadge";
import { TableCard } from "@/app/(components)/TableCard";
import { DataTable } from "@/app/(components)/DataTable";
import { OrderMobileCard } from "@/app/(components)/OrderMobileCard";
import { formatAmount, formatDate } from "@/utils/formatter";
import { TableColumn } from "@/app/(interfaces)/table-column";
import { Order } from "@/app/(interfaces)/order";

const columns: TableColumn<Order>[] = [
  {
    key: "order_id",
    label: "Order ID",
    headerClassName: "text-slate-400",
    cellClassName: "text-slate-700 font-medium",
    render: (row) => row.order_id,
  },
  {
    key: "facility",
    label: "Facility",
    headerClassName: "text-[#2db0b0]",
    render: (row) => row.facility_name ?? "—",
  },
  {
    key: "product",
    label: "Product",
    headerClassName: "text-[#2db0b0]",
    render: (row) => row.product_name ?? "—",
  },
  {
    key: "amount",
    label: "Amount",
    headerClassName: "text-[#2db0b0]",
    cellClassName: "text-slate-700 font-medium",
    render: (row) => formatAmount(row.amount),
  },
  {
    key: "status",
    label: "Status",
    headerClassName: "text-[#2db0b0]",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "date",
    label: "Date",
    headerClassName: "text-red-400",
    cellClassName: "text-xs text-slate-400",
    render: (row) => formatDate(row.created_at),
  },
];

export default function RecentOrdersTable() {
  const orders = useAppSelector((state) => state.orders.items);

  const recent = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 10),
    [orders],
  );

  return (
    <TableCard title="Recent Orders">
      <div className="divide-y divide-slate-100 md:hidden">
        {recent.map((order) => (
          <OrderMobileCard key={order.id ?? order.order_id} order={order} />
        ))}
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={recent}
          keyExtractor={(row) => row.id ?? row.order_id ?? ""}
          emptyMessage="No Orders Yet"
          headerVariant="minimal"
        />
      </div>
    </TableCard>
  );
}
