"use client";

import { useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const TEAL = "#0d7a6b";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueChart({ orders }: { orders: DashboardOrder[] }) {
  const data = useMemo(() => {
    const byMonth: Record<string, number> = {};
    const years = new Set<number>();
    for (const o of orders) {
      if (o.order_status === "canceled") continue;
      const d = new Date(o.placed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] ?? 0) + (o.total_amount ?? 0);
      years.add(d.getFullYear());
    }
    const multiYear = years.size > 1;
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => {
        const [yr, mo] = key.split("-");
        const label = multiYear
          ? `${MONTH_NAMES[Number(mo) - 1]} ${yr}`
          : MONTH_NAMES[Number(mo) - 1];
        return { key, revenue, label };
      });
  }, [orders]);

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Revenue Trend</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Monthly order revenue</p>
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-[var(--text3)]">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TEAL} stopOpacity={0.08} />
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                labelStyle={{ fontSize: 11, color: "#0f2d4a" }}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={TEAL}
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={data.length === 1 ? { r: 4, fill: TEAL } : false}
                activeDot={{ r: 4, fill: TEAL }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
