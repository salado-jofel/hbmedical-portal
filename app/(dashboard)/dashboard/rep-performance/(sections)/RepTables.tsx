"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import type { IRepPerformance } from "@/utils/interfaces/quotas";

const TEAL = "#0d7a6b";
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function attainmentColor(pct: number | null): string {
  if (pct === null) return "text-[var(--text3)]";
  if (pct >= 100)   return "text-emerald-600";
  if (pct >= 75)    return "text-[var(--teal)]";
  if (pct >= 25)    return "text-[var(--gold)]";
  return "text-red-500";
}

function SubRepRow({ rep }: { rep: IRepPerformance }) {
  const pct    = rep.attainmentPct;
  const capped = Math.min(pct ?? 0, 100);

  // Em-dash for zero-valued cells — rows for brand-new sub-reps are otherwise
  // a wall of "$0.00 / 0 / 0" which buries any real data in other rows.
  const monoClass = "text-[13px]";
  const dashClass = "text-[13px] text-[var(--text3)]";
  const mono = { fontFamily: "var(--font-dm-mono), monospace" } as const;

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
      <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]">{rep.repName}</td>
      <td className="px-4 py-[10px]" style={mono}>
        {rep.actualRevenue > 0
          ? <span className={monoClass}>{formatAmount(rep.actualRevenue)}</span>
          : <span className={dashClass}>—</span>}
      </td>
      <td className="px-4 py-[10px]" style={mono}>
        {rep.quota != null
          ? <span className="text-[13px] text-[var(--text2)]">{formatAmount(rep.quota)}</span>
          : <span className={dashClass}>—</span>}
      </td>
      <td className="px-4 py-[10px]">
        {pct !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-[6px] w-[60px] overflow-hidden rounded-full bg-[var(--border2)]">
              <div className="h-full rounded-full bg-[var(--teal-mid)]" style={{ width: `${capped}%` }} />
            </div>
            <span className={`text-[12px] font-semibold ${attainmentColor(pct)}`}>{pct.toFixed(1)}%</span>
          </div>
        ) : <span className="text-[12px] text-[var(--text3)]">—</span>}
      </td>
      <td className="px-4 py-[10px]" style={mono}>
        {rep.commissionEarned > 0
          ? <span className={monoClass}>{formatAmount(rep.commissionEarned)}</span>
          : <span className={dashClass}>—</span>}
      </td>
      <td className="px-4 py-[10px]">
        {rep.paidOrders > 0
          ? <span className="text-[13px] text-[var(--text2)]">{rep.paidOrders}</span>
          : <span className={dashClass}>—</span>}
      </td>
    </tr>
  );
}

export default function RepTables() {
  const summary  = useAppSelector((s) => s.repPerformance.summary);
  const subReps  = summary?.subRepPerformance ?? [];
  const monthly  = (summary?.monthlyRevenue ?? []).map(({ period, revenue }) => {
    const [, mo] = period.split("-");
    return { label: MONTH_NAMES[(Number(mo) - 1)] ?? period, revenue };
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Revenue Trend */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
          <p className="text-[13px] font-semibold text-[var(--navy)]">Revenue Trend</p>
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">Last 6 months</p>
        </div>
        <div className="p-4">
          {monthly.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-[13px] text-[var(--text3)]">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="repRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={TEAL} stopOpacity={0.08} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                  labelStyle={{ fontSize: 11, color: "#0f2d4a" }}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke={TEAL} strokeWidth={2} fill="url(#repRevenueGrad)" activeDot={{ r: 4, fill: TEAL }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Sub-rep Performance (only if sub-reps exist) */}
      {subReps.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Sub-Rep Performance</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">Current period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  {["Rep", "Revenue", "Quota", "Attainment", "Commission", "Orders"].map((h) => (
                    <th key={h} className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subReps.map((rep) => <SubRepRow key={rep.repId} rep={rep} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-4 py-8">
          <p className="text-[13px] text-[var(--text3)]">No sub-reps assigned</p>
        </div>
      )}
    </div>
  );
}
