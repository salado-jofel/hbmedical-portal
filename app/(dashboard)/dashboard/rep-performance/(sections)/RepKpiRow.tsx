"use client";

import { KpiCard } from "@/app/(components)/KpiCard";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export default function RepKpiRow() {
  const perf = useAppSelector((s) => s.repPerformance.summary?.myPerformance ?? null);
  const pipeline = useAppSelector((s) => s.repPerformance.summary?.pipelineRevenue ?? 0);
  const projected = useAppSelector((s) => s.repPerformance.summary?.oneYearProjectedRevenue ?? 0);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-3">
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
      <KpiCard
        label="1 Year Est. Projected"
        value={formatAmount(projected)}
        accentColor="purple"
      />
    </div>
  );
}
