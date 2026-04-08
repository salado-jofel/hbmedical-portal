export const dynamic = "force-dynamic";

import { getAllOrders } from "./orders/(services)/order-read-actions";
import RecentOrdersTable from "./(sections)/RecentOrdersTable";
import StatsCards from "./(sections)/StatsCard";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const orders = await getAllOrders();

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const activeOrders = orders.filter(
    (o) => o.order_status !== "canceled" && o.order_status !== "draft",
  ).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 select-none">
      <DashboardHeader title="Dashboard" showGreeting />
      <StatsCards totalOrders={totalOrders} totalRevenue={totalRevenue} activeOrders={activeOrders} />
      <RecentOrdersTable initialOrders={orders} />
    </div>
  );
}
