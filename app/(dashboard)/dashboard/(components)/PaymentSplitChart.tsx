"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const METHOD_CONFIG: { key: string | null; label: string; color: string }[] = [
  { key: "pay_now", label: "Pay Now", color: "#1565c0" },
  { key: "net_30",  label: "Net-30",  color: "#6d28d9" },
  { key: null,      label: "No Method", color: "#94a3b8" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PaymentSplitChart({ orders }: { orders: DashboardOrder[] }) {
  const { data, totalRevenue } = useMemo(() => {
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const o of orders) {
      if (o.order_status === "canceled") continue;
      const key = o.payment_method ?? "__none__";
      byMethod[key] = (byMethod[key] ?? 0) + (o.total_amount ?? 0);
      total += o.total_amount ?? 0;
    }
    const entries = METHOD_CONFIG.map((c) => ({
      label: c.label,
      revenue: byMethod[c.key ?? "__none__"] ?? 0,
      color: c.color,
    })).filter((e) => e.revenue > 0);
    return { data: entries, totalRevenue: total };
  }, [orders]);

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Payment Methods</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Revenue by payment type</p>
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-[var(--text3)]">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Pie>
              <text
                x="50%"
                y="43%"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 13, fontWeight: 600, fill: "#0f2d4a" }}
              >
                {formatCurrency(totalRevenue)}
              </text>
              <text
                x="50%"
                y="43%"
                dy={16}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 10, fill: "#94a3b8" }}
              >
                total
              </text>
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                formatter={(value, entry: any) => (
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    {value} — {formatCurrency(entry.payload?.revenue ?? 0)}
                  </span>
                )}
                wrapperStyle={{ paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
