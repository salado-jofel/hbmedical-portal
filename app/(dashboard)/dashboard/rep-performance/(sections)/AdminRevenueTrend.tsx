"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatAmount } from "@/utils/helpers/formatter";

const LINE_COLORS = [
  "#2563eb", "#16a34a", "#c47d0a", "#6d28d9", "#dc2626",
  "#0d7a6b", "#9333ea", "#db2777", "#059669", "#f59e0b",
  "#0891b2", "#7c3aed",
];

export function AdminRevenueTrend({
  data,
  repNames,
}: {
  data: Array<{ month: string } & Record<string, number | string>>;
  repNames: string[];
}) {
  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Team Revenue Trend</p>
        <p className="text-[11px] text-[var(--text3)]">Delivered revenue by rep · last 12 months</p>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text3)" }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {repNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
