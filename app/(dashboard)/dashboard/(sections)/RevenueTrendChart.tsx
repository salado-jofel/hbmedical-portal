"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatAmount } from "@/utils/helpers/formatter";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function labelFor(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_SHORT[(month ?? 1) - 1]} ${String(year).slice(2)}`;
}

export function RevenueTrendChart({
  data,
  quota,
}: {
  data: Array<{ period: string; revenue: number }>;
  quota: number | null;
}) {
  const series = data.map((d) => ({ month: labelFor(d.period), revenue: Math.round(d.revenue) }));

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--navy)]">Revenue Trend</p>
          <p className="text-[11px] text-[var(--text3)]">
            Last 6 months · {quota != null ? `quota: ${formatAmount(quota)}` : "no quota set"}
          </p>
        </div>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text3)" }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} />
            {quota != null && quota > 0 && (
              <ReferenceLine
                y={quota}
                stroke="#2563eb"
                strokeDasharray="4 4"
                label={{ value: "Quota", position: "right", fill: "#2563eb", fontSize: 10 }}
              />
            )}
            <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
