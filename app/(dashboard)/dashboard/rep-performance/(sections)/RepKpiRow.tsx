"use client";

import { KpiCard } from "@/app/(components)/KpiCard";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export default function RepKpiRow() {
  const perf = useAppSelector((s) => s.repPerformance.summary?.myPerformance ?? null);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
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
    </div>
  );
}
