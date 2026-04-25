"use client";

import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import type { SortDirection, PageSize } from "@/utils/interfaces/paginated";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
import { CreateOrderModal } from "../(components)/CreateOrderModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { PageHeader } from "@/app/(components)/PageHeader";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/utils/constants/orders";
import { Package, List, LayoutGrid } from "lucide-react";
import { cn } from "@/utils/utils";

export function ClinicOrdersTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  onToggleSort,
  onPageChange,
  onPageSizeChange,
  isFetching,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  view,
  onViewChange,
  canCreate,
  onOrderClick,
}: {
  rows: DashboardOrder[];
  total: number;
  page: number;
  pageSize: PageSize;
  sort: string;
  dir: SortDirection;
  onToggleSort: (col: string) => void;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
  isFetching: boolean;
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

      {rows.length === 0 && !isFetching ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders found"
          description="Create your first order or adjust your filters."
        />
      ) : (
        <div className="rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
          <TableBusyBar busy={isFetching} />
          <table className={cn("w-full text-sm transition-opacity", isFetching && "opacity-60")}>
            <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-[9px] text-left">
                  <SortableHeader
                    label="Order #"
                    column="order_number"
                    currentSort={sort}
                    currentDir={dir}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px]">
                  Patient
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px] hidden lg:table-cell">
                  Type
                </th>
                <th className="px-4 py-[9px] text-left hidden lg:table-cell">
                  <SortableHeader
                    label="DOS"
                    column="date_of_service"
                    currentSort={sort}
                    currentDir={dir}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="px-4 py-[9px] text-left">
                  <SortableHeader
                    label="Status"
                    column="order_status"
                    currentSort={sort}
                    currentDir={dir}
                    onToggle={onToggleSort}
                  />
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px] hidden xl:table-cell">
                  Products
                </th>
                <th className="px-4 py-[9px] text-left hidden xl:table-cell">
                  <SortableHeader
                    label="Updated"
                    column="updated_at"
                    currentSort={sort}
                    currentDir={dir}
                    onToggle={onToggleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((order) => (
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
                    <OrderStatusBadge status={getDisplayOrderStatus(order)} />
                  </td>
                  <td className="px-4 py-[10px] text-[12px] text-[var(--text3)] hidden xl:table-cell">
                    {order.all_items?.length > 0
                      ? `${order.all_items.length} item${order.all_items.length !== 1 ? "s" : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[12px] text-[var(--text3)] hidden xl:table-cell">
                    {order.updated_at
                      ? new Date(order.updated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
