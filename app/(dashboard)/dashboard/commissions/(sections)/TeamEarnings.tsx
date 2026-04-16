"use client";

import { useMemo } from "react";
import { formatAmount } from "@/utils/helpers/formatter";
import type { SubRep } from "@/utils/interfaces/my-team";

export default function TeamEarnings({ subReps }: { subReps: SubRep[] }) {
  const totals = useMemo(() => {
    const total = subReps.reduce(
      (sum, r) => sum + (r.commissionEarned * (r.overridePercent / 100)),
      0,
    );
    return { total, count: subReps.length };
  }, [subReps]);

  if (subReps.length === 0) return null;

  return (
    <section className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
        Team Earnings — This Period
      </p>
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[28px] font-bold text-[var(--navy)] leading-none">
            {formatAmount(totals.total)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text3)]">
            Your override from {totals.count} sub-rep{totals.count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[var(--text3)]">
            <tr>
              <th className="px-4 py-2 text-left">Sub-Rep</th>
              <th className="px-4 py-2 text-right">Their Commission</th>
              <th className="px-4 py-2 text-right">Override %</th>
              <th className="px-4 py-2 text-right">Your Override $</th>
            </tr>
          </thead>
          <tbody>
            {subReps.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--navy)]">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(r.commissionEarned)}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{r.overridePercent}%</td>
                <td className="px-4 py-2 text-right font-medium text-[var(--navy)]">
                  {formatAmount(r.commissionEarned * (r.overridePercent / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
