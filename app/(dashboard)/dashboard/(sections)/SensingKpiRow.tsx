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
  const { momLabel, momAccent, activeDoctors } = useMemo(() => {
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

    const cutoff = Date.now() - 90 * MS_DAY;
    const docs = new Set<string>();
    for (const o of orders) {
      const placed = o.placed_at;
      if (!placed) continue;
      if (new Date(placed).getTime() < cutoff) continue;
      const pid = o.assigned_provider_id;
      if (pid) docs.add(pid);
    }

    const label =
      dir === "up"   ? `+${momPct.toFixed(1)}%` :
      dir === "down" ? `${momPct.toFixed(1)}%`  :
                       "0%";
    const accent = dir === "up" ? "green" : dir === "down" ? "red" : "teal";
    return { momLabel: label, momAccent: accent, activeDoctors: docs.size };
  }, [monthlyRevenue, orders]);

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px]">
      <KpiCard label="MoM Revenue Growth" value={momLabel} accentColor={momAccent} />
      <KpiCard label="Active Doctors" value={String(activeDoctors)} accentColor="purple" />
    </div>
  );
}
