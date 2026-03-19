export const dynamic = "force-dynamic";

import { getAllOrders } from "./orders/(services)/actions";
import { getFacilities } from "./facilities/(services)/actions";
import Providers from "./(sections)/Providers";
import RecentOrdersTable from "./(sections)/RecentOrdersTable";
import { createClient } from "@/utils/supabase/server";
import StatsCards from "./(sections)/StatsCard";

import { getUserData } from "./(services)/actions";
import { DashboardHeader } from "../(components)/DashboardHeader";

export default async function DashboardPage() {
  const [facilities, orders, userData] = await Promise.all([
    getFacilities(),
    getAllOrders(),
    getUserData(),
  ]);

  const totalFacilities = facilities.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const activeOrders = orders.filter(
    (o) => o.status !== "Delivered" && o.status !== "Draft",
  ).length;

  return (
    <Providers facilities={facilities} orders={orders} userData={userData}>
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none">
        <DashboardHeader title="Dashboard" showGreeting />
        <StatsCards
          totalFacilities={totalFacilities}
          totalOrders={totalOrders}
          totalRevenue={totalRevenue}
          activeOrders={activeOrders}
        />
        <RecentOrdersTable />
      </div>
    </Providers>
  );
}
