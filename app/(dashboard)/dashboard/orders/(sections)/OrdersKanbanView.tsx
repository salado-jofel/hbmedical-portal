"use client";

import type { DashboardOrder, OrderStatus, KanbanColumn } from "@/utils/interfaces/orders";
import { CreateOrderModal } from "../(components)/CreateOrderModal";
import { OrderCard } from "../(components)/OrderCard";
import {
  KANBAN_STATUS_CONFIG,
  PAID_COLUMN_CONFIG,
} from "../(components)/kanban-config";
import { EmptyState } from "@/app/(components)/EmptyState";
import { PageHeader } from "@/app/(components)/PageHeader";
import { KanbanColumn as KanbanColumnShell } from "@/app/(components)/KanbanColumn";
import { Package, List, LayoutGrid } from "lucide-react";
import { cn } from "@/utils/utils";

/* ── Per-status column styles for clinic kanban ── */
const CLINIC_COLUMN_STYLES: Record<string, { bg: string; dot: string; headerBg: string }> = {
  draft:                  { bg: "bg-amber-50/50",   dot: "bg-amber-400",   headerBg: "bg-amber-50"   },
  pending_signature:      { bg: "bg-blue-50/50",    dot: "bg-blue-400",    headerBg: "bg-blue-50"    },
  manufacturer_review:    { bg: "bg-purple-50/50",  dot: "bg-purple-400",  headerBg: "bg-purple-50"  },
  additional_info_needed: { bg: "bg-red-50/50",     dot: "bg-red-400",     headerBg: "bg-red-50"     },
  approved:               { bg: "bg-emerald-50/50", dot: "bg-emerald-400", headerBg: "bg-emerald-50" },
  shipped:                { bg: "bg-cyan-50/50",    dot: "bg-cyan-400",    headerBg: "bg-cyan-50"    },
  delivered:              { bg: "bg-green-50/50",   dot: "bg-green-400",   headerBg: "bg-green-50"   },
  paid:                   { bg: "bg-green-50/50",   dot: "bg-green-500",   headerBg: "bg-green-50"   },
};

export function OrdersKanbanView({
  orders,
  grouped,
  approvedPending,
  approvedProcessed,
  kanbanColumns,
  unreadCounts,
  mobileTab,
  onMobileTabChange,
  tableMode,
  onTableModeChange,
  isAdmin,
  isSupport,
  canCreate,
  onOrderClick,
  clinicView,
  onClinicViewChange,
}: {
  orders: DashboardOrder[];
  grouped: Record<string, DashboardOrder[]>;
  approvedPending: DashboardOrder[];
  approvedProcessed: DashboardOrder[];
  kanbanColumns: KanbanColumn[];
  unreadCounts: Record<string, number>;
  mobileTab: OrderStatus | "paid";
  onMobileTabChange: (tab: OrderStatus | "paid") => void;
  tableMode: boolean;
  onTableModeChange: (v: boolean) => void;
  isAdmin: boolean;
  isSupport: boolean;
  canCreate: boolean;
  onOrderClick: (order: DashboardOrder) => void;
  clinicView?: "table" | "kanban";
  onClinicViewChange?: (v: "table" | "kanban") => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Orders"
        subtitle={(isAdmin || isSupport) ? "All orders across facilities" : "Track and manage your orders"}
        className="pb-4"
        action={
          <div className="flex items-center gap-2">
            {/* Admin/support: Kanban ↔ Table toggle */}
            {(isAdmin || isSupport) && (
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                <button
                  onClick={() => onTableModeChange(false)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                    !tableMode
                      ? "bg-[var(--navy)] text-white"
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
                      ? "bg-[var(--navy)] text-white"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  Table
                </button>
              </div>
            )}
            {/* Clinic: Table ↔ Board toggle */}
            {canCreate && clinicView !== undefined && (
              <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5">
                <button
                  onClick={() => onClinicViewChange?.("table")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    clinicView === "table"
                      ? "bg-white text-[var(--navy)] shadow-sm"
                      : "text-[#64748b] hover:text-[#334155]",
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  Table
                </button>
                <button
                  onClick={() => onClinicViewChange?.("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    clinicView === "kanban"
                      ? "bg-white text-[var(--navy)] shadow-sm"
                      : "text-[#64748b] hover:text-[#334155]",
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Board
                </button>
              </div>
            )}
            {canCreate && <CreateOrderModal />}
          </div>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders yet"
          description="Create your first order to get started."
        />
      ) : (
        <>
          {/* Mobile: tabbed */}
          <div className="md:hidden">
            <div className="flex overflow-x-auto gap-1 pb-2 mb-4">
              {kanbanColumns.map((col) => {
                const isPaid = col.type === "paid";
                const key = isPaid ? "paid" : col.status;
                const label = isPaid
                  ? PAID_COLUMN_CONFIG.label
                  : KANBAN_STATUS_CONFIG[col.status].label;
                const dot = isPaid
                  ? PAID_COLUMN_CONFIG.dot
                  : KANBAN_STATUS_CONFIG[col.status].dot;
                const count = isPaid
                  ? approvedProcessed.length
                  : col.status === "approved"
                    ? approvedPending.length
                    : grouped[col.status].length;
                const isActive = mobileTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => onMobileTabChange(key as OrderStatus | "paid")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all",
                      isActive
                        ? "bg-[var(--navy)] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                    {label}
                    <span
                      className={cn(
                        "ml-0.5 rounded-full text-[10px] px-1.5 py-0.5 font-bold",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-600",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {(() => {
                const colOrders =
                  mobileTab === "paid"
                    ? approvedProcessed
                    : mobileTab === "approved"
                      ? approvedPending
                      : (grouped[mobileTab as OrderStatus] ?? []);
                const label =
                  mobileTab === "paid"
                    ? PAID_COLUMN_CONFIG.label
                    : (KANBAN_STATUS_CONFIG[mobileTab as OrderStatus]?.label ??
                      mobileTab);
                return colOrders.length === 0 ? (
                  <div className="bg-[var(--bg)] rounded-xl border border-[var(--border)] py-14">
                    <EmptyState
                      icon={<Package className="w-8 h-8 text-[var(--border)]" />}
                      message={`No ${label} orders`}
                    />
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => onOrderClick(order)}
                      unreadCount={unreadCounts[order.id] ?? 0}
                      statusOverride={
                        mobileTab === "paid" ? "processed" : undefined
                      }
                    />
                  ))
                );
              })()}
            </div>
          </div>

          {/* Desktop: kanban columns */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
            {kanbanColumns.map((col) => {
              const isPaid = col.type === "paid";
              const key = isPaid ? "paid" : col.status;
              const label = isPaid
                ? PAID_COLUMN_CONFIG.label
                : KANBAN_STATUS_CONFIG[col.status].label;
              const dot = isPaid
                ? PAID_COLUMN_CONFIG.dot
                : KANBAN_STATUS_CONFIG[col.status].dot;
              const columnOrders = isPaid
                ? approvedProcessed
                : col.status === "approved"
                  ? approvedPending
                  : grouped[col.status];

              /* ── Clinic: styled column with per-status tint ── */
              if (canCreate) {
                const style = CLINIC_COLUMN_STYLES[key] ?? CLINIC_COLUMN_STYLES.draft;
                return (
                  <div
                    key={key}
                    className={cn("rounded-xl p-2.5 min-w-[280px] flex-1 min-h-[200px]", style.bg)}
                  >
                    {/* Column header */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg mb-3",
                        style.headerBg,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", style.dot)} />
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#334155]">
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[#64748b] bg-white rounded-full px-2 py-0.5 shadow-sm">
                        {columnOrders.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2.5 max-h-[calc(100vh-320px)] overflow-y-auto">
                      {columnOrders.length === 0 ? (
                        <EmptyState
                          icon={<Package className="w-7 h-7 text-[#cbd5e1]" />}
                          message="No orders"
                          className="py-8"
                        />
                      ) : (
                        columnOrders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => onOrderClick(order)}
                            unreadCount={unreadCounts[order.id] ?? 0}
                            statusOverride={isPaid ? "processed" : undefined}
                            className="bg-white border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#cbd5e1]"
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              }

              /* ── Admin/support: existing KanbanColumnShell ── */
              return (
                <KanbanColumnShell
                  key={key}
                  label={label}
                  count={columnOrders.length}
                  dot={dot}
                  labelClassName="text-xs"
                  className="min-w-[320px] flex-1"
                  bodyClassName="max-h-[calc(100vh-300px)]"
                >
                  {columnOrders.length === 0 ? (
                    <EmptyState
                      icon={<Package className="w-7 h-7 text-[var(--border)]" />}
                      message="No orders"
                      className="py-8"
                    />
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onClick={() => onOrderClick(order)}
                        unreadCount={unreadCounts[order.id] ?? 0}
                        statusOverride={isPaid ? "processed" : undefined}
                      />
                    ))
                  )}
                </KanbanColumnShell>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
