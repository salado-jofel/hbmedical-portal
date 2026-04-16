"use client";

import { useAppSelector } from "@/store/hooks";
import { KpiCard } from "@/app/(components)/KpiCard";
import { formatAmount } from "@/utils/helpers/formatter";

export default function SubRepKpiRow() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  const cards = [
    { label: "Revenue This Month", value: formatAmount(detail.actualRevenue), accentColor: "teal",   show: true },
    { label: "Orders This Month",  value: String(detail.paidOrders),            accentColor: "blue",   show: true },
    { label: "Commission Earned",  value: formatAmount(detail.commissionEarned), accentColor: "green",  show: true },
    { label: "Avg Order Value",    value: formatAmount(detail.avgOrderValue),    accentColor: "purple", show: true },
    { label: "Pipeline Revenue",   value: formatAmount(detail.pipelineRevenue),  accentColor: "blue",   show: true },
    {
      label: "Your Override Earned",
      value: formatAmount(detail.overrideEarnedThisPeriod ?? 0),
      accentColor: "purple",
      show: detail.overrideEarnedThisPeriod !== null,
    },
  ];

  const visible = cards.filter((c) => c.show);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--navy)]">Performance</h2>
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-3">
        {visible.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} accentColor={c.accentColor} />
        ))}
      </div>
    </section>
  );
}
