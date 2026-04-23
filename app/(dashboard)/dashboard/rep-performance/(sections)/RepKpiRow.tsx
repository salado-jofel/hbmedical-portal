"use client";

import { KpiCard } from "@/app/(components)/KpiCard";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export default function RepKpiRow() {
  const perf = useAppSelector((s) => s.repPerformance.summary?.myPerformance ?? null);
  const pipeline = useAppSelector((s) => s.repPerformance.summary?.pipelineRevenue ?? 0);

  // "1 Year Est. Projected" card was dropped — it's just current-month × 12,
  // pure extrapolation that sales reps shouldn't plan against.
  // Two-row layout: primary headline metrics (3 cards) then wider secondary
  // metrics (2 cards @ 50% each) so the grid doesn't show an empty slot.
  return (
    <>
      <div className="mb-[10px] grid grid-cols-2 gap-[10px] lg:grid-cols-3">
        <KpiCard
          label="Revenue This Month"
          value={formatAmount(perf?.actualRevenue ?? 0)}
          accentColor="teal"
        />
        <KpiCard
          label="Orders This Month"
          value={String(perf?.paidOrders ?? 0)}
          accentColor="blue"
        />
        <KpiCard
          label="Commission Earned"
          value={formatAmount(perf?.commissionEarned ?? 0)}
          accentColor="green"
        />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-[10px] sm:grid-cols-2">
        <KpiCard
          label="Avg Order Value"
          value={formatAmount(perf?.avgOrderValue ?? 0)}
          accentColor="purple"
        />
        <KpiCard
          label="Est. Pipeline Revenue"
          value={formatAmount(pipeline)}
          accentColor="blue"
        />
      </div>
    </>
  );
}
