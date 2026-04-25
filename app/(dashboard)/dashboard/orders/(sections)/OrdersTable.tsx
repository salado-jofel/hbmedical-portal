"use client";

import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import type { SortDirection, PageSize } from "@/utils/interfaces/paginated";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
import { PillBadge } from "@/app/(components)/PillBadge";
import { EmptyState } from "@/app/(components)/EmptyState";
import { PageHeader } from "@/app/(components)/PageHeader";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/utils/constants/orders";
import { Package } from "lucide-react";
import { cn } from "@/utils/utils";

/**
 * Server-paginated orders table. `rows` is just the current page's slice;
 * `total` is the full match count (drives the pagination footer).
 *
 * Sortable columns are direct orders-table columns only — see the allowlist
 * in order-read-actions.ts. "Patient" and "Facility" render as plain headers
 * because sorting by joined fields would need a DB view or a separate query.
 */
export function OrdersTable({
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
  facilityFilter,
  onFacilityFilterChange,
  facilityOptions,
  tableMode,
  onTableModeChange,
  isAdmin,
  isSupport,
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
  /** null when no facility is selected. */
  facilityFilter: string | null;
  onFacilityFilterChange: (v: string | null) => void;
  /** Empty array hides the filter (clinic users). */
  facilityOptions: Array<{ id: string; name: string }>;
  tableMode: boolean;
  onTableModeChange: (v: boolean) => void;
  isAdmin: boolean;
  isSupport: boolean;
  onOrderClick: (order: DashboardOrder) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Orders"
        subtitle="All orders across facilities"
        className="pb-4"
        action={
          isAdmin || isSupport ? (
            <div className="flex items-center gap-[3px] border border-[var(--border)] rounded-[var(--r)] p-1 shrink-0 bg-[var(--surface)]">
              <button
                onClick={() => onTableModeChange(true)}
                className={cn(
                  "px-3 py-[5px] rounded-[7px] text-[12px] font-medium transition-colors",
                  tableMode
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--text2)] hover:bg-[var(--bg)]",
                )}
              >
                Table
              </button>
              <button
                onClick={() => onTableModeChange(false)}
                className={cn(
                  "px-3 py-[5px] rounded-[7px] text-[12px] font-medium transition-colors",
                  !tableMode
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--text2)] hover:bg-[var(--bg)]",
                )}
              >
                Kanban
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Filters — facility dropdown only renders when admin/support gave us
          options (clinic users get an empty list since they're already
          scoped to their own facility). */}
      <TableToolbar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by order #, patient, facility..."
        className="flex-col sm:flex-row"
        filters={[
          {
            value: statusFilter,
            onChange: (v) => onStatusFilterChange(v as OrderStatus | "all"),
            options: ORDER_STATUS_FILTER_OPTIONS,
            placeholder: "All Statuses",
            className: "w-full sm:w-44",
          },
          ...(facilityOptions.length > 0
            ? [
                {
                  value: facilityFilter ?? "all",
                  onChange: (v: string) =>
                    onFacilityFilterChange(v === "all" ? null : v),
                  options: [
                    { value: "all", label: "All Facilities" },
                    ...facilityOptions.map((f) => ({ value: f.id, label: f.name })),
                  ],
                  placeholder: "All Facilities",
                  className: "w-full sm:w-56",
                },
              ]
            : []),
        ]}
      />

      {/* Table + pagination */}
      {rows.length === 0 && !isFetching ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders found"
          description="Adjust your filters or wait for orders to come in."
        />
      ) : (
        <div className="rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
          <TableBusyBar busy={isFetching} />
          <table
            className={cn(
              "w-full text-sm transition-opacity",
              isFetching && "opacity-60",
            )}
          >
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
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px] hidden md:table-cell">
                  Facility
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px] hidden lg:table-cell">
                  Wound
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
                <th className="px-4 py-[9px] text-left hidden xl:table-cell">
                  <SortableHeader
                    label="Payment"
                    column="payment_status"
                    currentSort={sort}
                    currentDir={dir}
                    onToggle={onToggleSort}
                  />
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
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text)]">
                    {order.patient_full_name ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text2)] hidden md:table-cell">
                    {order.facility_name ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text2)] hidden lg:table-cell capitalize">
                    {order.wound_type?.replace("_", " ") ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[13px] text-[var(--text2)] hidden lg:table-cell">
                    {order.date_of_service ?? "—"}
                  </td>
                  <td className="px-4 py-[10px]">
                    <OrderStatusBadge status={getDisplayOrderStatus(order)} />
                  </td>
                  <td className="px-4 py-[10px] hidden xl:table-cell">
                    {order.payment_method ? (
                      <div className="flex flex-col gap-1">
                        <PillBadge
                          label={
                            order.payment_status === "paid"
                              ? "Paid"
                              : order.payment_method === "pay_now"
                                ? "Pay Now"
                                : "Net-30"
                          }
                          variant={
                            order.payment_status === "paid"
                              ? "green"
                              : order.payment_method === "pay_now"
                                ? "blue"
                                : "purple"
                          }
                        />
                        {order.payment_method === "net_30" &&
                          order.payment_status !== "paid" &&
                          order.invoice_due_at && (
                            <span className="text-[10px] text-[var(--red)] font-medium">
                              Due{" "}
                              {new Date(
                                order.invoice_due_at,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--text3)]">—</span>
                    )}
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
