"use client";

import { useAppSelector } from "@/store/hooks";

const TIER_CARDS = [
  { tier: "A" as const, bg: "bg-[var(--green-lt)]", fg: "text-[var(--green)]" },
  { tier: "B" as const, bg: "bg-[var(--gold-lt)]",  fg: "text-[var(--gold)]"  },
  { tier: "C" as const, bg: "bg-[#f1f5f9]",          fg: "text-[var(--text3)]" },
];

export default function TierBreakdown() {
  const counts = useAppSelector(
    (s) => s.repPerformance.summary?.tierCounts ?? { A: 0, B: 0, C: 0 },
  );

  return (
    <div className="mb-5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
        Account Tier Breakdown
      </p>
      <div className="grid grid-cols-3 gap-[10px]">
        {TIER_CARDS.map(({ tier, bg, fg }) => (
          <div
            key={tier}
            className="rounded-[var(--r)] border border-[var(--border)] bg-white px-4 py-3 flex items-center gap-3"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg} ${fg} text-base font-bold`}>
              {tier}
            </div>
            <div>
              <p className="text-[22px] font-semibold leading-none text-[var(--navy)]">
                {counts[tier]}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text3)]">accounts</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--text3)]">
        Your best-performing clinics, ranked by revenue over the last 3 months.
      </p>
    </div>
  );
}
