"use client";

import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
import { CreateOrderModal } from "../(components)/CreateOrderModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { PageHeader } from "@/app/(components)/PageHeader";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/utils/constants/orders";
import { Package, List, LayoutGrid } from "lucide-react";
import { cn } from "@/utils/utils";

export function ClinicOrdersTable({
  filtered,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  view,
  onViewChange,
  canCreate,
  onOrderClick,
}: {
  filtered: DashboardOrder[];
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: OrderStatus | "all";
  onStatusFilterChange: (v: OrderStatus | "all") => void;
  view: "table" | "kanban";
  onViewChange: (v: "table" | "kanban") => void;
  canCreate: boolean;
  onOrderClick: (order: DashboardOrder) => void;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        subtitle="Track and manage your orders"
        className="pb-4"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5">
              <button
                onClick={() => onViewChange("table")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === "table"
                    ? "bg-white text-[var(--navy)] shadow-sm"
                    : "text-[#64748b] hover:text-[#334155]",
                )}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => onViewChange("kanban")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === "kanban"
                    ? "bg-white text-[var(--navy)] shadow-sm"
                    : "text-[#64748b] hover:text-[#334155]",
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>
            {canCreate && <CreateOrderModal />}
          </div>
        }
      />

      <TableToolbar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by order #, patient..."
        className="flex-col sm:flex-row"
        filters={[
          {
            value: statusFilter,
            onChange: (v) => onStatusFilterChange(v as OrderStatus | "all"),
            options: ORDER_STATUS_FILTER_OPTIONS,
            placeholder: "All Statuses",
            className: "w-full sm:w-44",
          },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders found"
          description="Create your first order or adjust your filters."
        />
      ) : (
        <div className="rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
              <tr>
                {["Order #", "Patient", "Type", "DOS", "Status", "Products", "Created"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px]",
                        i === 2 && "hidden lg:table-cell",
                        i === 3 && "hidden lg:table-cell",
                        i === 5 && "hidden xl:table-cell",
                        i === 6 && "hidden xl:table-cell",
                      )}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-[var(--bg)] cursor-pointer transition-colors"
                  onClick={() => onOrderClick(order)}
                >
                  <td
                    className="px-4 py-[10px] text-[12px] font-medium text-[var(--navy)]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {order.order_number}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--text)]">
                    {order.patient_full_name ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text2)] capitalize hidden lg:table-cell">
                    {order.wound_type?.replace("_", " ") ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text2)] hidden lg:table-cell">
                    {order.date_of_service ?? "—"}
                  </td>
                  <td className="px-4 py-[10px]">
                    <OrderStatusBadge status={order.order_status} />
                  </td>
                  <td className="px-4 py-[10px] text-[12px] text-[var(--text3)] hidden xl:table-cell">
                    {order.all_items?.length > 0
                      ? `${order.all_items.length} item${order.all_items.length !== 1 ? "s" : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[12px] text-[var(--text3)] hidden xl:table-cell">
                    {new Date(order.placed_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
