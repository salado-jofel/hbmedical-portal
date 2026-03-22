export const dynamic = "force-dynamic";

import { getAllOrders } from "./orders/(services)/actions";
import RecentOrdersTable from "./(sections)/RecentOrdersTable";
import StatsCards from "./(sections)/StatsCard";
import { DashboardHeader } from "../(components)/DashboardHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const orders = await getAllOrders();

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const activeOrders = orders.filter(
    (o) => o.status !== "Delivered" && o.status !== "Draft",
  ).length;

  return (
    <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none">
      <DashboardHeader title="Dashboard" showGreeting />
      <StatsCards
        totalOrders={totalOrders}
        totalRevenue={totalRevenue}
        activeOrders={activeOrders}
      />
      <RecentOrdersTable />
    </div>
  );
}
