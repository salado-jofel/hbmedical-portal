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
import { formatStatus } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const NO_WOUND_TYPE = "__none__";
const FALLBACK_COLOR = "#94a3b8";

/**
 * Presentation only — the chart is driven by the data, not by this map.
 *
 * A wound_type missing from here still renders, labelled via formatStatus()
 * and drawn in the fallback colour. The previous version mapped over the
 * config instead of the counts, so `dfu` and `vlu` were never looked up: when
 * the DFU/VLU order form templates shipped this chart kept drawing two
 * slices, dropping 12 of 103 orders while the centre still read 103. Mapping
 * over the data makes that failure impossible.
 */
const WOUND_PRESENTATION: Record<string, { label: string; color: string }> = {
  chronic:       { label: "Chronic",       color: "#0d7a6b" },
  post_surgical: { label: "Post-Surgical", color: "#1565c0" },
  dfu:           { label: "DFU",           color: "#c47d0a" },
  vlu:           { label: "VLU",           color: "#6d28d9" },
  [NO_WOUND_TYPE]: { label: "Unknown",     color: FALLBACK_COLOR },
};

export function WoundTypeChart({ orders }: { orders: DashboardOrder[] }) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const key = o.wound_type ?? NO_WOUND_TYPE;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({
        label: WOUND_PRESENTATION[key]?.label ?? formatStatus(key),
        count,
        color: WOUND_PRESENTATION[key]?.color ?? FALLBACK_COLOR,
      }))
      .sort((a, b) => b.count - a.count);
    // Centre total is the sum of what's drawn, so the ring and the number can
    // never disagree — the symptom that made the dropped slices invisible.
    return {
      data: entries,
      total: entries.reduce((sum, e) => sum + e.count, 0),
    };
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
