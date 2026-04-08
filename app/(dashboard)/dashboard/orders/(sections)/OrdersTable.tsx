"use client";

import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
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
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => onTableModeChange(false)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                !tableMode
                  ? "bg-[#15689E] text-white"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Kanban
            </button>
            <button
              onClick={() => onTableModeChange(true)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                tableMode
                  ? "bg-[#15689E] text-white"
                  : "text-gray-500 hover:text-gray-700",
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
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Order #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Patient
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Facility
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Wound
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  DOS
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">
                  Payment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onOrderClick(order)}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-[#15689E] text-xs">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {order.patient_full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {order.facility_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell capitalize">
                    {order.wound_type?.replace("_", " ") ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                    {order.date_of_service ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.order_status} />
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {order.payment_method ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit",
                            order.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : order.payment_method === "pay_now"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700",
                          )}
                        >
                          {order.payment_status === "paid" ? (
                            <><Check className="w-3 h-3" /> Paid</>
                          ) : order.payment_method === "pay_now" ? (
                            <><CreditCard className="w-3 h-3" /> Pay Now</>
                          ) : (
                            <><FileText className="w-3 h-3" /> Net-30</>
                          )}
                        </span>
                        {order.payment_method === "net_30" &&
                          order.payment_status !== "paid" &&
                          order.invoice_due_at && (
                            <span className="text-[10px] text-red-500 font-medium">
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
                      <span className="text-xs text-gray-400">—</span>
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
