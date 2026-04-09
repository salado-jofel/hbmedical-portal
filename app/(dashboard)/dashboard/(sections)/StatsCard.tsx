"use client";

import { KpiCard } from "@/app/(components)/KpiCard";

interface StatsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  activeOrders: number;
  draftOrders: number;
}

export default function StatsCards({
  totalOrders,
  totalRevenue,
  activeOrders,
  draftOrders,
}: StatsCardsProps) {
  const revenueFormatted = `$${totalRevenue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
      <KpiCard
        label="Total Orders"
        value={String(totalOrders)}
        accentColor="teal"
      />
      <KpiCard
        label="Total Revenue"
        value={revenueFormatted}
        accentColor="gold"
      />
      <KpiCard
        label="Active Orders"
        value={String(activeOrders)}
        accentColor="blue"
      />
      <KpiCard
        label="Draft Orders"
        value={String(draftOrders)}
        accentColor="purple"
      />
    </div>
  );
}
