"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { formatAmount } from "@/utils/helpers/formatter";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function orderTotal(o: DashboardOrder): number {
  const items = ((o as any).order_items ?? []) as { total_amount: string | number }[];
  return items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
}

const STATUS_HEX: Partial<Record<OrderStatus, string>> = {
  draft:                  "#94a3b8",
  pending_signature:      "#f59e0b",
  manufacturer_review:    "#a855f7",
  additional_info_needed: "#ef4444",
  approved:               "#3b82f6",
  shipped:                "#06b6d4",
  delivered:              "#16a34a",
  canceled:               "#64748b",
};

export function OrdersChartsRow({ orders }: { orders: DashboardOrder[] }) {
  const { ordersPerMonth, revenuePerMonth, statusBreakdown } = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: monthLabel(d) });
    }
    const ordersCounts: Record<string, number> = Object.fromEntries(months.map((m) => [m.key, 0]));
    const revenueByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m.key, 0]));

    for (const o of orders) {
      if (o.placed_at) {
        const k = monthKey(new Date(o.placed_at));
        if (k in ordersCounts) ordersCounts[k] += 1;
      }
      if (o.delivery_status === "delivered" && o.delivered_at) {
        const k = monthKey(new Date(o.delivered_at));
        if (k in revenueByMonth) revenueByMonth[k] += orderTotal(o);
      }
    }

    const ordersPerMonth = months.map((m) => ({ month: m.label, count: ordersCounts[m.key] }));
    const revenuePerMonth = months.map((m) => ({
      month: m.label,
      revenue: Math.round(revenueByMonth[m.key]),
    }));

    const statusCounts: Partial<Record<OrderStatus, number>> = {};
    for (const o of orders) {
      statusCounts[o.order_status] = (statusCounts[o.order_status] ?? 0) + 1;
    }
    const statusBreakdown = Object.entries(statusCounts)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([status, count]) => ({
        status: status as OrderStatus,
        count: count as number,
        label: KANBAN_STATUS_CONFIG[status as OrderStatus]?.label ?? status,
        color: STATUS_HEX[status as OrderStatus] ?? "#94a3b8",
      }));

    return { ordersPerMonth, revenuePerMonth, statusBreakdown };
  }, [orders]);

  return (
    <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Orders / Month
        </p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={ordersPerMonth} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Delivered Revenue / Month
        </p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={revenuePerMonth} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text3)" }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
          Status Breakdown
        </p>
        {statusBreakdown.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-xs text-[var(--text3)]">
            No orders yet
          </div>
        ) : (
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {statusBreakdown.map((s) => (
                    <Cell key={s.status} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v}`, String(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
