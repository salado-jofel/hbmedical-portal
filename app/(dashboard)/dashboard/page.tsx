export const dynamic = "force-dynamic";

import { getAllOrders } from "./orders/(services)/order-read-actions";
import RecentOrdersTable from "./(sections)/RecentOrdersTable";
import StatsCards from "./(sections)/StatsCard";
import { BarChart2 } from "lucide-react";
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
  const draftOrders = orders.filter((o) => o.order_status === "draft").length;

  return (
    <div className="select-none">
      {/* KPI grid */}
      <StatsCards
        totalOrders={totalOrders}
        totalRevenue={totalRevenue}
        activeOrders={activeOrders}
        draftOrders={draftOrders}
      />

      {/* Charts row: 1.6fr 1fr */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent orders */}
        <RecentOrdersTable initialOrders={orders} />

        {/* Order status breakdown — chart placeholder */}
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">
              Order Status Breakdown
            </p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">
              Distribution by status
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-[var(--text3)]">
            <BarChart2 className="h-8 w-8 opacity-30" strokeWidth={1.5} />
            <p className="text-[13px]">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Bottom card — recent activity summary */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
          <p className="text-[13px] font-semibold text-[var(--navy)]">
            Order Activity
          </p>
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">
            All orders across all statuses
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
          {[
            { label: "Draft",      value: draftOrders,                                     color: "var(--text3)" },
            { label: "Active",     value: activeOrders,                                    color: "var(--teal-mid)" },
            { label: "Delivered",  value: orders.filter((o) => o.order_status === "delivered").length,  color: "var(--green)" },
            { label: "Cancelled",  value: orders.filter((o) => o.order_status === "canceled").length,   color: "var(--red)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--surface)] px-4 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.6px] text-[var(--text3)]">
                {label}
              </p>
              <p
                className="mt-1 text-[22px] font-semibold leading-none"
                style={{ color }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
