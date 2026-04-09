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

const WOUND_CONFIG = [
  { key: "chronic",      label: "Chronic",      color: "#0d7a6b" },
  { key: "post_surgical",label: "Post-Surgical", color: "#1565c0" },
  { key: null,           label: "Unknown",       color: "#94a3b8" },
];

export function WoundTypeChart({ orders }: { orders: DashboardOrder[] }) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const key = o.wound_type ?? "__none__";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const entries = WOUND_CONFIG.map((c) => ({
      label: c.label,
      count: counts[c.key ?? "__none__"] ?? 0,
      color: c.color,
    })).filter((e) => e.count > 0);
    return { data: entries, total: orders.length };
  }, [orders]);

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Wound Types</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Order distribution by wound type</p>
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
                innerRadius={45}
                outerRadius={68}
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
                style={{ fontSize: 20, fontWeight: 600, fill: "#0f2d4a" }}
              >
                {total}
              </text>
              <text
                x="50%"
                y="43%"
                dy={16}
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
