"use client";

import { useAppSelector } from "@/store/hooks";
import { KpiCard } from "@/app/(components)/KpiCard";
import { formatAmount } from "@/utils/helpers/formatter";

export default function SubRepKpiRow() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  if (!detail) return null;

  // Primary row: headline KPIs (3 cards, full-width-ish on desktop)
  const primary = [
    { label: "Revenue This Month", value: formatAmount(detail.actualRevenue),  accentColor: "teal"  },
    { label: "Orders This Month",  value: String(detail.paidOrders),           accentColor: "blue"  },
    { label: "Commission Earned",  value: formatAmount(detail.commissionEarned), accentColor: "green" },
  ];

  // Secondary row: supporting metrics (2 cards side-by-side, each ~50% wide)
  const secondary = [
    { label: "Avg Order Value",  value: formatAmount(detail.avgOrderValue),   accentColor: "purple" },
    { label: "Pipeline Revenue", value: formatAmount(detail.pipelineRevenue), accentColor: "blue"   },
  ];

  // Third row: override earned — only for main reps who actually earn overrides
  const overrideCard = detail.overrideEarnedThisPeriod !== null ? {
    label: "Your Override Earned",
    value: formatAmount(detail.overrideEarnedThisPeriod ?? 0),
    accentColor: "purple",
  } : null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--navy)]">Performance</h2>
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-3">
        {primary.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} accentColor={c.accentColor} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
        {secondary.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} accentColor={c.accentColor} />
        ))}
      </div>
      {overrideCard && (
        <div className="grid grid-cols-1">
          <KpiCard
            label={overrideCard.label}
            value={overrideCard.value}
            accentColor={overrideCard.accentColor}
          />
        </div>
      )}
    </section>
  );
}
