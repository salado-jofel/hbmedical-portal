"use client";

import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import { BUCKETS, OPEN_KEYS } from "./_buckets";
import RepOverrideStrip from "./RepOverrideStrip";

/* What the rep has in flight and what it is worth, stage by stage.
 *
 * Bill-first, on the client's instruction: shown this card and asked whether a
 * rep should see the total order amount or just their commission, he said
 * "they need to see the entire bill for sure and then their commission
 * second". So every stage leads with the order amount and carries the rep's
 * own cut on the line beneath it.
 *
 * The earned counterpart is RepEarnedCommissions, which reads the real ledger.
 * Nothing in this card is money owed. */
export default function RepMoneyPipeline() {
  const pipeline = useAppSelector(
    (s) => s.repPerformance.summary?.moneyPipeline ?? null,
  );

  if (!pipeline) return null;

  const { buckets, ratePercent, overdueOrders, overdueAmount } = pipeline;

  // Headline = every open stage, from the rep's own book AND their override on
  // sub-rep orders. Null only when nothing at all could be valued (no own rate
  // and no sub-rep rates), so an unconfigured rate reads as unknown rather
  // than as zero earnings.
  let openCommission: number | null = null;
  for (const totals of [pipeline, pipeline.override?.totals]) {
    if (!totals) continue;
    for (const key of OPEN_KEYS) {
      const value = totals.buckets[key].commissionEstimate;
      if (value !== null) openCommission = (openCommission ?? 0) + value;
    }
  }

  return (
    <div className="mb-5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text1)]">
            <TrendingUp className="h-4 w-4 text-[var(--text3)]" />
            My Money Pipeline
          </h3>
          <p className="text-xs text-[var(--text3)]">
            Every order at your clinics, wherever it has reached.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text3)]">Est. commission still to come</p>
          <p className="text-lg font-semibold text-[var(--text1)]">
            {openCommission === null ? "—" : formatAmount(openCommission)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        {BUCKETS.map(({ key, label, caption, hint, bar, showCommission }) => {
          const bucket = buckets[key];
          return (
            <div
              key={key}
              className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-3"
            >
              <div className={`mb-2 h-1 w-8 rounded-full ${bar}`} />
              <p className="text-xs font-medium text-[var(--text2)]">{label}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text3)]">
                {caption}
              </p>
              <p className="text-base font-semibold text-[var(--text1)]">
                {formatAmount(bucket.orderAmount)}
              </p>
              <p className="text-xs text-[var(--text3)]">
                {bucket.orders} order{bucket.orders !== 1 ? "s" : ""}
                {showCommission && bucket.commissionEstimate !== null && (
                  <> · {formatAmount(bucket.commissionEstimate)} to you</>
                )}
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--text3)]">
                {hint}
              </p>
            </div>
          );
        })}
      </div>

      {pipeline.override && <RepOverrideStrip override={pipeline.override} />}

      {overdueOrders > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-[var(--r)] border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">
            <span className="font-semibold">
              {overdueOrders} overdue invoice{overdueOrders !== 1 ? "s" : ""} ·{" "}
              {formatAmount(overdueAmount)}
            </span>{" "}
            — billed, past due and still unpaid. Chase these first.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text3)]" />
        <p className="text-[11px] leading-snug text-[var(--text3)]">
          {ratePercent === null ? (
            <>
              No active commission rate is set on your account, so your own
              orders cannot be valued. Ask an admin to set one. Canceled and
              refunded orders are excluded.
            </>
          ) : (
            <>
              Open stages are estimates at your current {ratePercent}% rate, not
              amounts owed. A commission is only recorded once the clinic pays —
              what you have actually earned is below. Canceled and refunded
              orders are excluded.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
