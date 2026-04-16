"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { formatAmount } from "@/utils/helpers/formatter";

export function AdminRepLeaderboard({
  data,
}: {
  data: Array<{ id: string; name: string; trailing3moRevenue: number }>;
}) {
  const rows = data.map((d) => ({
    ...d,
    label: formatAmount(d.trailing3moRevenue),
  }));

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Rep Leaderboard</p>
        <p className="text-[11px] text-[var(--text3)]">Trailing 3 months delivered revenue</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-[260px] text-xs text-[var(--text3)]">
          No rep data yet
        </div>
      ) : (
        <div style={{ width: "100%", height: Math.max(260, rows.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 80, bottom: 5, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--text3)" }}
                width={110}
              />
              <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} />
              <Bar dataKey="trailing3moRevenue" fill="#16a34a" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="label"
                  position="right"
                  style={{ fontSize: 10, fill: "var(--navy)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
