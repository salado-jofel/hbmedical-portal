"use client";

import { useMemo } from "react";
import { KpiCard } from "@/app/(components)/KpiCard";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const MS_DAY = 24 * 60 * 60 * 1000;

export function SensingKpiRow({
  monthlyRevenue,
  orders,
}: {
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  orders: DashboardOrder[];
}) {
  const { momLabel, momAccent, activeClinics } = useMemo(() => {
    const len = monthlyRevenue.length;
    const current = len > 0 ? monthlyRevenue[len - 1].revenue : 0;
    const previous = len > 1 ? monthlyRevenue[len - 2].revenue : 0;
    let momPct = 0;
    if (previous > 0) {
      momPct = ((current - previous) / previous) * 100;
    } else if (current > 0) {
      momPct = 100;
    }
    const dir: "up" | "flat" | "down" =
      momPct > 0.5 ? "up" : momPct < -0.5 ? "down" : "flat";

    // Count unique facilities ("clinics") the rep has sold into over the last
    // 90 days. Previously counted `assigned_provider_id` but that field is
    // rarely populated, making the KPI read 0 in realistic data.
    const cutoff = Date.now() - 90 * MS_DAY;
    const clinics = new Set<string>();
    for (const o of orders) {
      const placed = o.placed_at;
      if (!placed) continue;
      if (new Date(placed).getTime() < cutoff) continue;
      if (o.facility_id) clinics.add(o.facility_id);
    }

    const label =
      dir === "up"   ? `+${momPct.toFixed(1)}%` :
      dir === "down" ? `${momPct.toFixed(1)}%`  :
                       "0%";
    const accent = dir === "up" ? "green" : dir === "down" ? "red" : "teal";
    return { momLabel: label, momAccent: accent, activeClinics: clinics.size };
  }, [monthlyRevenue, orders]);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px]">
      <KpiCard label="MoM Revenue Growth" value={momLabel} accentColor={momAccent} />
      <KpiCard label="Active Clinics" value={String(activeClinics)} accentColor="purple" />
    </div>
  );
}
