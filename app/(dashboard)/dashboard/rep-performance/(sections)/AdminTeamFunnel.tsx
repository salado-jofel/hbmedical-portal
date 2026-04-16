"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatAmount } from "@/utils/helpers/formatter";

const STATUS_COLOR: Record<string, string> = {
  pending_signature:      "#f59e0b",
  manufacturer_review:    "#a855f7",
  additional_info_needed: "#ef4444",
  approved:               "#3b82f6",
  shipped:                "#06b6d4",
  delivered:              "#16a34a",
};

export function AdminTeamFunnel({
  data,
}: {
  data: Array<{ status: string; label: string; count: number; revenue: number }>;
}) {
  const rows = data.map((d) => ({
    ...d,
    labelText: `${d.count} · ${formatAmount(d.revenue)}`,
  }));
  const hasAny = rows.some((r) => r.count > 0);

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Team Pipeline</p>
        <p className="text-[11px] text-[var(--text3)]">Orders by status across all reps</p>
      </div>
      {!hasAny ? (
        <div className="flex items-center justify-center h-[240px] text-xs text-[var(--text3)]">
          No orders in pipeline
        </div>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 120, bottom: 5, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text3)" }}
                width={130}
              />
              <Tooltip
                formatter={(_v, _name, entry) => {
                  const r = entry?.payload as { count: number; revenue: number } | undefined;
                  return r ? [`${r.count} · ${formatAmount(r.revenue)}`, "Count · Value"] : ["", ""];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {rows.map((r) => (
                  <Cell key={r.status} fill={STATUS_COLOR[r.status] ?? "#94a3b8"} />
                ))}
                <LabelList dataKey="labelText" position="right" style={{ fontSize: 10, fill: "var(--navy)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
