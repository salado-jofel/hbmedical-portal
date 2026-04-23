"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";
import { KpiCard } from "@/app/(components)/KpiCard";

export function AccountsKpiRow() {
  const items = useAppSelector((s) => s.accounts.items);

  const totals = useMemo(() => {
    let signed_count = 0;
    let delivered_count = 0;
    let delivered_revenue = 0;
    let pipeline_revenue = 0;
    let one_year_projected = 0;
    let a_tier_count = 0;

    for (const a of items) {
      signed_count += a.signed_count ?? 0;
      delivered_count += a.delivered_count ?? 0;
      delivered_revenue += a.delivered_revenue ?? 0;
      pipeline_revenue += a.pipeline_revenue ?? 0;
      one_year_projected += a.one_year_projected_revenue ?? 0;
      if (a.tier === "A") a_tier_count += 1;
    }

    return { signed_count, delivered_count, delivered_revenue, pipeline_revenue, one_year_projected, a_tier_count };
  }, [items]);

  return (
    <div className="mb-5 space-y-[10px]">
      {/* Row 1 — counts */}
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="Accounts" value={String(items.length)} accentColor="teal" />
        <KpiCard label="Total Signed Orders" value={String(totals.signed_count)} accentColor="blue" />
        <KpiCard label="Delivered" value={String(totals.delivered_count)} accentColor="green" />
        <KpiCard
          label="A-Tier Accounts"
          value={String(totals.a_tier_count)}
          accentColor="green"
        />
      </div>

      {/* Row 2 — real revenue only. "1 Year Projected" card was dropped:
          it's current monthly avg × 12, pure extrapolation, not actionable
          for a salesperson (and the underlying calc had a formatting bug). */}
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
        <div className="rounded-[var(--r)] border border-[#bbf7d0] bg-[#f0fdf4] px-[1.1rem] py-4">
          <p className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
            Delivered Revenue
          </p>
          <p className="text-[22px] font-semibold leading-none text-[#16a34a]">
            {formatAmount(totals.delivered_revenue)}
          </p>
          <p className="mt-[5px] text-[11px] text-[var(--text3)]">
            {totals.delivered_count} delivered order{totals.delivered_count !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-[var(--r)] border border-[#bfdbfe] bg-[#eff6ff] px-[1.1rem] py-4">
          <p className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]" style={{ letterSpacing: "0.7px" }}>
            Est. Pipeline Revenue
          </p>
          <p className="text-[22px] font-semibold leading-none text-[#2563eb]">
            {formatAmount(totals.pipeline_revenue)}
          </p>
          <p className="mt-[5px] text-[11px] text-[var(--text3)]">orders in approved / shipped</p>
        </div>
      </div>
    </div>
  );
}
