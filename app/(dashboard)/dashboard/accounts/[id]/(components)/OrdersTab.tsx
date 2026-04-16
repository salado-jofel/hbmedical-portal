"use client";

import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/app/(components)/EmptyState";
import { OrdersChartsRow } from "./OrdersChartsRow";
import {
  OrdersFilterBar,
  type OrdersStatusFilter,
  type OrdersPeriodFilter,
  type OrdersView,
} from "./OrdersFilterBar";
import { OrdersTableView } from "./OrdersTableView";
import { OrdersKanbanView } from "./OrdersKanbanView";
import type { DashboardOrder } from "@/utils/interfaces/orders";

function periodBounds(period: OrdersPeriodFilter): { start: string | null; end: string | null } {
  const now = new Date();
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return { start, end };
  }
  if (period === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
    return { start, end: null };
  }
  return { start: null, end: null };
}

interface OrdersTabProps {
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}

export function OrdersTab({ orders, onOrderClick }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<OrdersStatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<OrdersPeriodFilter>("all_time");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrdersView>("table");

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.order_status === statusFilter);
    }
    if (periodFilter !== "all_time") {
      const { start, end } = periodBounds(periodFilter);
      result = result.filter((o) => {
        const placed = o.placed_at;
        if (!placed) return false;
        if (start && placed < start) return false;
        if (end && placed >= end) return false;
        return true;
      });
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((o) => {
        const orderNum = (o.order_number ?? "").toLowerCase();
        const p: any = (o as any).patients ?? (o as any).patient ?? null;
        const row = Array.isArray(p) ? p[0] : p;
        const patientStr = `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.toLowerCase();
        return orderNum.includes(term) || patientStr.includes(term);
      });
    }
    return result;
  }, [orders, statusFilter, periodFilter, search]);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-10 h-10 stroke-1" />}
        message="No orders for this account"
      />
    );
  }

  return (
    <div>
      <OrdersChartsRow orders={orders} />

      <OrdersFilterBar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        periodFilter={periodFilter}
        onPeriodFilterChange={setPeriodFilter}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
      />

      <p className="mb-3 text-xs text-[var(--text3)]">
        {filtered.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
      </p>

      {view === "table" ? (
        <OrdersTableView orders={filtered} onOrderClick={onOrderClick} />
      ) : (
        <OrdersKanbanView orders={filtered} onOrderClick={onOrderClick} />
      )}
    </div>
  );
}
