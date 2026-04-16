"use client";

import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import { cn } from "@/utils/utils";

const STATUS_STYLES: Record<string, string> = {
  paid:      "bg-[var(--green-lt)] text-[var(--green)]",
  pending:   "bg-[var(--gold-lt)]  text-[var(--gold)]",
  approved:  "bg-[#dbeafe]         text-[#2563eb]",
  void:      "bg-[#f1f5f9]         text-[var(--text3)]",
};

export default function SubRepCommissionHistory() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;
  const { history, overrideEarnedThisPeriod } = detail;
  const showOverrideCol = overrideEarnedThisPeriod !== null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--navy)]">Commission History</h2>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[var(--text3)]">
            <tr>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-right">Gross</th>
              <th className="px-4 py-2 text-right">Adjustment</th>
              <th className="px-4 py-2 text-right">Final</th>
              {showOverrideCol && <th className="px-4 py-2 text-right">Your Override</th>}
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={showOverrideCol ? 6 : 5} className="px-4 py-6 text-center text-[var(--text3)]">
                  No commission history yet.
                </td>
              </tr>
            ) : history.map((h) => (
              <tr key={h.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--navy)]">{h.period}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(h.commission_amount)}</td>
                <td className="px-4 py-2 text-right text-[var(--text2)]">{formatAmount(h.adjustment)}</td>
                <td className="px-4 py-2 text-right font-medium text-[var(--navy)]">{formatAmount(h.final_amount)}</td>
                {showOverrideCol && (
                  <td className="px-4 py-2 text-right text-[var(--text2)]">
                    {h.your_override_amount != null ? formatAmount(h.your_override_amount) : "—"}
                  </td>
                )}
                <td className="px-4 py-2">
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                    STATUS_STYLES[h.status] ?? STATUS_STYLES.pending)}>
                    {h.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
