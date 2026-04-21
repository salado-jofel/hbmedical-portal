"use client";

import { ShoppingCart } from "lucide-react";
import { DataTable } from "@/app/(components)/DataTable";
import { EmptyState } from "@/app/(components)/EmptyState";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { cn } from "@/utils/utils";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { TableColumn } from "@/utils/interfaces/table-column";

function orderTotal(o: DashboardOrder): number {
  return Number(o.total_amount ?? 0);
}

function patientName(o: DashboardOrder): string {
  if (o.patient_full_name) return o.patient_full_name;
  const first = o.patient_first_name ?? "";
  const last = o.patient_last_name ?? "";
  return `${first} ${last}`.trim() || "—";
}

export function OrdersTableView({
  orders,
  onOrderClick,
}: {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        message="No orders match the current filters"
      />
    );
  }

  const columns: TableColumn<DashboardOrder>[] = [
    {
      key: "order_number",
      label: "Order #",
      render: (o) => (
        <span className="text-sm font-medium text-[var(--navy)]">
          {o.order_number ?? o.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "patient",
      label: "Patient",
      render: (o) => <span className="text-sm text-[var(--text2)]">{patientName(o)}</span>,
    },
    {
      key: "date_of_service",
      label: "DOS",
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
      render: (o) => (
        <span className="text-sm text-[var(--text2)]">
          {o.date_of_service ? formatDate(o.date_of_service) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (o) => {
        const cfg = KANBAN_STATUS_CONFIG[o.order_status];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border",
              cfg?.badge ?? "",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg?.dot ?? "bg-gray-400")} />
            {cfg?.label ?? o.order_status}
          </span>
        );
      },
    },
    {
      key: "payment",
      label: "Payment",
      headerClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
      render: (o) => (
        <span className="text-sm text-[var(--text2)] capitalize">
          {o.payment_status ?? "—"}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (o) => (
        <span className="text-sm font-medium text-[var(--navy)]">{formatAmount(orderTotal(o))}</span>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(o) => o.id}
        emptyMessage="No orders found"
        emptyIcon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        onRowClick={(o) => onOrderClick(o.id)}
        rowClassName="group"
      />
    </div>
  );
}
