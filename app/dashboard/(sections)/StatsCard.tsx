"use client";

import { StatCard } from "@/app/(components)/StatCard";
import { Building2, ShoppingCart, DollarSign, RefreshCw } from "lucide-react";

interface StatsCardsProps {
  totalFacilities: number;
  totalOrders: number;
  totalRevenue: number;
  activeOrders: number;
}

export default function StatsCards({
  totalFacilities,
  totalOrders,
  totalRevenue,
  activeOrders,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Facilities"
        value={totalFacilities}
        icon={Building2}
      />
      <StatCard label="Total Orders" value={totalOrders} icon={ShoppingCart} />
      <StatCard
        label="Total Revenue"
        value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        icon={DollarSign}
      />
      <StatCard label="Active Orders" value={activeOrders} icon={RefreshCw} />
    </div>
  );
}
