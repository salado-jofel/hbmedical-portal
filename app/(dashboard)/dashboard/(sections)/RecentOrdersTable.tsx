"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/(components)/StatusBadge";
import { DataTable } from "@/app/(components)/DataTable";
import { OrderMobileCard } from "@/app/(components)/OrderMobileCard";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import { TableColumn } from "@/utils/interfaces/table-column";
import { useOrderUpdatesRefresh } from "@/utils/hooks/useOrderRealtime";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const columns: TableColumn<DashboardOrder>[] = [
  {
    key: "order_number",
    label: "Order ID",
    render: (order) => (
      <span className="font-medium text-[var(--navy)]">
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
    render: (order) => (
      <span style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
        {formatAmount(order.total_amount ?? 0)}
      </span>
    ),
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
  const router = useRouter();

  // Keep "Recent Orders" live for admins/reps/clinic users watching the
  // dashboard. router.refresh() re-runs the dashboard server component so
  // new/updated orders flow in without a manual page reload.
  useOrderUpdatesRefresh();

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
    <div
      className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]"
    >
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[0.8rem]">
        <div>
          <p className="text-[13px] font-semibold text-[var(--navy)]">
            Recent Orders
          </p>
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">
            Last {recent.length} orders
          </p>
        </div>
      </div>

      {/* Mobile list */}
      <div className="divide-y divide-[var(--border)] md:hidden">
        {recent.length > 0 ? (
          recent.map((order) => (
            <Link
              key={order.id}
              href="/dashboard/orders"
              onClick={() => {
                sessionStorage.setItem("pending-order-open", JSON.stringify({ orderId: order.id, tab: "overview" }));
              }}
              className="block w-full text-left"
            >
              <OrderMobileCard order={order} />
            </Link>
          ))
        ) : (
          <p className="p-4 text-[13px] text-[var(--text3)]">No orders yet.</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={recent}
          keyExtractor={(row) => String(row.id ?? "")}
          emptyMessage="No orders yet."
          headerVariant="minimal"
          onRowClick={(order) => {
            sessionStorage.setItem("pending-order-open", JSON.stringify({ orderId: order.id, tab: "overview" }));
            router.push("/dashboard/orders");
          }}
        />
      </div>
    </div>
  );
}
