"use client";

import { AlertTriangle, Info, Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import type { RepMoneyBucket } from "@/utils/helpers/rep-pipeline";

/* Order of the buckets left→right follows the money's actual journey, so the
 * row reads as a pipeline rather than a set of unrelated tiles. */
const BUCKETS: Array<{
  key: Exclude<RepMoneyBucket, "excluded">;
  label: string;
  hint: string;
  bar: string;
}> = [
  {
    key: "in_progress",
    label: "In Progress",
    hint: "Still in the clinic or under review — not yet cleared.",
    bar: "bg-slate-400",
  },
  {
    key: "fulfilled",
    label: "Went Through",
    hint: "Approved, shipped or delivered. Not invoiced yet.",
    bar: "bg-blue-500",
  },
  {
    key: "collectible",
    label: "Collectible",
    hint: "Invoiced and waiting on payment.",
    bar: "bg-amber-500",
  },
  {
    key: "paid",
    label: "Paid",
    hint: "Payment received. Lifetime total.",
    bar: "bg-emerald-500",
  },
];

export default function RepMoneyPipeline() {
  const pipeline = useAppSelector(
    (s) => s.repPerformance.summary?.moneyPipeline ?? null,
  );

  if (!pipeline) return null;

  const { buckets, ratePercent, overdueOrders, overdueAmount } = pipeline;

  // Open money = everything not yet collected, from the rep's own book AND
  // their override on sub-rep orders. This is the number the rep wants: what
  // is coming, as opposed to what already landed.
  //
  // Returns null only when nothing at all could be valued (no own rate and no
  // sub-rep rates), so an unconfigured rate reads as unknown rather than as
  // zero earnings.
  const OPEN_KEYS = ["in_progress", "fulfilled", "collectible"] as const;
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
          <h3 className="text-sm font-semibold text-[var(--text1)]">
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
        {BUCKETS.map(({ key, label, hint, bar }) => {
          const bucket = buckets[key];
          return (
            <div
              key={key}
              className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-3"
            >
              <div className={`mb-2 h-1 w-8 rounded-full ${bar}`} />
              <p className="text-xs font-medium text-[var(--text2)]">{label}</p>
              <p className="mt-1 text-base font-semibold text-[var(--text1)]">
                {formatAmount(bucket.orderAmount)}
              </p>
              <p className="text-xs text-[var(--text3)]">
                {bucket.orders} order{bucket.orders !== 1 ? "s" : ""}
                {bucket.commissionEstimate !== null && (
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

      {/* Override money from the rep's direct sub-reps.
          Money and counts only — the client's rule is that a parent rep sees
          his own book, his money and his override, never his sub-reps'
          facilities, accounts or orders. Sub-rep revenue is deliberately not
          rendered here, only what the override is worth to this rep. */}
      {pipeline.override && (
        <div className="mt-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[var(--text3)]" />
              <p className="text-xs font-medium text-[var(--text2)]">
                Override from my team
              </p>
            </div>
            <p className="text-xs text-[var(--text3)]">
              {pipeline.override.subRepCount} sub-rep
              {pipeline.override.subRepCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
            {BUCKETS.map(({ key, label }) => {
              const bucket = pipeline.override!.totals.buckets[key];
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

          {pipeline.override.subRepsMissingRate > 0 && (
            <p className="mt-2 text-[11px] leading-snug text-[var(--text3)]">
              {pipeline.override.subRepsMissingRate} of your sub-reps have no
              override rate set, so their orders are counted but not valued.
              Ask an admin to set one.
            </p>
          )}
        </div>
      )}

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
              Commission figures outside the Paid column are estimates at your
              current {ratePercent}% rate, not amounts owed. A commission is only
              recorded once the clinic pays — your{" "}
              <span className="font-medium">Commissions</span> page remains the
              record of what is actually due. Canceled and refunded orders are
              excluded.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
