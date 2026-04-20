"use client";

import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
import { PillBadge } from "@/app/(components)/PillBadge";
import { EmptyState } from "@/app/(components)/EmptyState";
import { PageHeader } from "@/app/(components)/PageHeader";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/utils/constants/orders";
import { Package, Check, CreditCard, FileText } from "lucide-react";
import { cn } from "@/utils/utils";

export function OrdersTable({
  filtered,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tableMode,
  onTableModeChange,
  isAdmin,
  isSupport,
  onOrderClick,
}: {
  filtered: DashboardOrder[];
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: OrderStatus | "all";
  onStatusFilterChange: (v: OrderStatus | "all") => void;
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
        action={(isAdmin || isSupport) ? (
          <div className="flex items-center gap-[3px] border border-[var(--border)] rounded-[var(--r)] p-1 shrink-0 bg-[var(--surface)]">
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
          </div>
        ) : undefined}
      />

      {/* Filters */}
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
        ]}
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders found"
          description="Adjust your filters or wait for orders to come in."
        />
      ) : (
        <div className="rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
              <tr>
                {["Order #", "Patient", "Facility", "Wound", "DOS", "Status", "Payment"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-[9px] text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[0.6px]",
                      i === 2 && "hidden md:table-cell",
                      i === 3 && "hidden lg:table-cell",
                      i === 4 && "hidden lg:table-cell",
                      i === 6 && "hidden xl:table-cell",
                    )}
                  >
                    {h}
                  </th>
                ))}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
