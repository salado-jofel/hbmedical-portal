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
  ReferenceLine,
} from "recharts";

function colorFor(pct: number | null): string {
  if (pct == null) return "#94a3b8";
  if (pct >= 100) return "#16a34a";
  if (pct >= 75) return "#0d7a6b";
  if (pct >= 25) return "#c47d0a";
  return "#dc2626";
}

export function AdminQuotaAttainment({
  data,
}: {
  data: Array<{ id: string; name: string; actualRevenue: number; quota: number | null; pct: number | null }>;
}) {
  const rows = data.map((d) => ({
    ...d,
    pctValue: d.pct ?? 0,
    pctLabel: d.pct == null ? "no quota" : `${d.pct.toFixed(0)}%`,
    color: colorFor(d.pct),
  }));

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Quota Attainment</p>
        <p className="text-[11px] text-[var(--text3)]">Current month · % of target</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-[260px] text-xs text-[var(--text3)]">
          No rep data yet
        </div>
      ) : (
        <div style={{ width: "100%", height: Math.max(260, rows.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: 0 }}>
              <XAxis type="number" domain={[0, (dataMax: number) => Math.max(100, dataMax)]} hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--text3)" }}
                width={110}
              />
              <Tooltip
                formatter={(_v, _name, entry) => {
                  const r = entry?.payload as typeof rows[number] | undefined;
                  if (!r) return ["", ""];
                  return r.quota != null
                    ? [`${r.pctLabel} ($${r.actualRevenue.toLocaleString()} of $${r.quota.toLocaleString()})`, "Attainment"]
                    : [r.pctLabel, "Attainment"];
                }}
              />
              <ReferenceLine x={100} stroke="var(--text3)" strokeDasharray="3 3" />
              <Bar dataKey="pctValue" radius={[0, 4, 4, 0]}>
                {rows.map((r) => (
                  <Cell key={r.id} fill={r.color} />
                ))}
                <LabelList dataKey="pctLabel" position="right" style={{ fontSize: 10, fill: "var(--navy)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
