"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatStatus } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const STATUS_COLORS: Record<string, string> = {
  draft:                  "#e8f1fd",
  pending_signature:      "#fef8ec",
  manufacturer_review:    "#1565c0",
  additional_info_needed: "#dc2626",
  approved:               "#15803d",
  shipped:                "#0d7a6b",
  delivered:              "#1d9e75",
  canceled:               "#94a3b8",
};

export function OrderStatusChart({ orders }: { orders: DashboardOrder[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.order_status] = (counts[o.order_status] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: formatStatus(status),
        count,
        color: STATUS_COLORS[status] ?? "#94a3b8",
      }));
  }, [orders]);

  const total = orders.length;

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Order Status</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Distribution by status</p>
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
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Pie>
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 20, fontWeight: 600, fill: "#0f2d4a" }}
              >
                {total}
              </text>
              <text
                x="50%"
                y="45%"
                dy={18}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 10, fill: "#94a3b8" }}
              >
                orders
              </text>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                formatter={(value, entry: any) => (
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    {value} ({entry.payload?.count ?? 0})
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
