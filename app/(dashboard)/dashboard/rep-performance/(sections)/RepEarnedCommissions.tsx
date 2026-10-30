"use client";

import Link from "next/link";
import { ArrowRight, Users, Wallet } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { COMMISSIONS_PATH } from "@/utils/constants/commissions";
import { formatAmount } from "@/utils/helpers/formatter";
import type { RepLedgerTotals } from "@/utils/helpers/rep-pipeline";

/* The earned half of the rep's money view.
 *
 * Everything here is real: a `commissions` row only exists once a Stripe
 * payment webhook has fired, so these are amounts the system has committed to,
 * not the estimates in RepMoneyPipeline above. The payout lifecycle runs
 * pending -> approved -> paid, matching the KPI row on the Commissions page so
 * the two never read as different money. */
const STAGES: Array<{
  key: keyof Omit<RepLedgerTotals, "total">;
  label: string;
  hint: string;
  bar: string;
}> = [
  {
    key: "pending",
    label: "Pending Approval",
    hint: "Earned. An admin still has to approve it.",
    bar: "bg-amber-500",
  },
  {
    key: "approved",
    label: "Awaiting Payout",
    hint: "Approved and queued for the next payout run.",
    bar: "bg-teal-500",
  },
  {
    key: "paid",
    label: "Paid Out",
    hint: "Already paid to you. Lifetime total.",
    bar: "bg-emerald-600",
  },
];

export default function RepEarnedCommissions() {
  const ledger = useAppSelector(
    (s) => s.repPerformance.summary?.moneyPipeline?.ledger ?? null,
  );

  if (!ledger) return null;

  const { all, direct, override } = ledger;
  const hasOverride = override.total !== 0;

  return (
    <div className="mb-5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text1)]">
            <Wallet className="h-4 w-4 text-[var(--text3)]" />
            Commission I&apos;ve Earned
          </h3>
          <p className="text-xs text-[var(--text3)]">
            Recorded commission, all periods. These are real amounts, not
            estimates.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text3)]">Total earned to date</p>
          <p className="text-lg font-semibold text-[var(--text1)]">
            {formatAmount(all.total)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
        {STAGES.map(({ key, label, hint, bar }) => (
          <div
            key={key}
            className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-3"
          >
            <div className={`mb-2 h-1 w-8 rounded-full ${bar}`} />
            <p className="text-xs font-medium text-[var(--text2)]">{label}</p>
            <p className="mt-1 text-base font-semibold text-[var(--text1)]">
              {formatAmount(all[key])}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-[var(--text3)]">
              {hint}
            </p>
          </div>
        ))}
      </div>

      {/* Direct vs override split. Rendered only when the rep actually has
          override earnings, so a rep with no team sees no empty row. Money
          only — never which sub-rep it came from. */}
      {hasOverride && (
        <div className="mt-3 grid grid-cols-2 gap-[10px]">
          <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
            <p className="text-[11px] text-[var(--text3)]">From my own orders</p>
            <p className="text-sm font-semibold text-[var(--text1)]">
              {formatAmount(direct.total)}
            </p>
          </div>
          <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
              <Users className="h-3 w-3" />
              Override from my team
            </p>
            <p className="text-sm font-semibold text-[var(--text1)]">
              {formatAmount(override.total)}
            </p>
          </div>
        </div>
      )}

      <Link
        href={COMMISSIONS_PATH}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--blue)] hover:underline"
      >
        See every commission line and payout
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
