"use client";

import { Users } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import type { RepOverridePipeline } from "@/utils/helpers/rep-pipeline";
import { OPEN_STAGES } from "./_buckets";

/* A parent rep's forecast override earnings, by pipeline stage.
 *
 * Money and counts only. The client's rule (2026-10-30, reaffirming
 * 2026-09-19) is that a parent rep sees "his own, his money and his override
 * from his sales rep" — never his sub-reps' facilities, accounts or orders.
 * So this renders what the override is WORTH to this rep and nothing about
 * where it came from: no sub-rep names, no facilities, no order numbers.
 * Open stages only: earned override money is real and lives in the Earned
 * card below, so a paid-stage estimate here would contradict it.
 *
 * Sub-rep revenue is deliberately absent too, since the override percentage
 * applied to it would let the rep infer their sub-reps' sales. */
export default function RepOverrideStrip({
  override,
}: {
  override: RepOverridePipeline;
}) {
  return (
    <div className="mt-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[var(--text3)]" />
          <p className="text-xs font-medium text-[var(--text2)]">
            Override coming from my team
          </p>
        </div>
        <p className="text-xs text-[var(--text3)]">
          {override.subRepCount} sub-rep{override.subRepCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-[10px]">
        {OPEN_STAGES.map(({ key, label }) => {
          const bucket = override.totals.buckets[key];
          return (
            <div key={key}>
              <p className="text-[11px] text-[var(--text3)]">{label}</p>
              <p className="text-sm font-semibold text-[var(--text1)]">
                {bucket.commissionEstimate === null
                  ? "—"
                  : formatAmount(bucket.commissionEstimate)}
              </p>
              <p className="text-[11px] text-[var(--text3)]">
                {bucket.orders} order{bucket.orders !== 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>

      {override.subRepsMissingRate > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--text3)]">
          {override.subRepsMissingRate === 1
            ? "1 of your sub-reps has no override rate set, so their orders are counted but not valued."
            : `${override.subRepsMissingRate} of your sub-reps have no override rate set, so their orders are counted but not valued.`}{" "}
          Ask an admin to set one.
        </p>
      )}
    </div>
  );
}
