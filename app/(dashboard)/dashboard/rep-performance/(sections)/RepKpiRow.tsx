"use client";

import { KpiCard } from "@/app/(components)/KpiCard";

export default function RepKpiRow() {
  return (
    <div className="mb-5 grid grid-cols-1 gap-[10px] sm:grid-cols-3">
      <KpiCard
        label="My Sales"
        value="$61,200"
        delta="Goal hit!"
        deltaType="up"
        accentColor="teal"
      />
      <KpiCard
        label="My Clients"
        value="7"
        delta="Active accounts"
        deltaType="warn"
        accentColor="blue"
      />
      <KpiCard
        label="Commission"
        value="$3,060"
        delta="This month"
        deltaType="warn"
        accentColor="gold"
      />
    </div>
  );
}
