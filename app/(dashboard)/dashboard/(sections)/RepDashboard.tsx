"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PageHeader } from "@/app/(components)/PageHeader";
import { formatAmount } from "@/utils/helpers/formatter";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { PipelineFunnel } from "./PipelineFunnel";
import { TopAccountsCard } from "./TopAccountsCard";
import { TodaysFocus } from "./TodaysFocus";
import { SensingKpiRow } from "./SensingKpiRow";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { ITask } from "@/utils/interfaces/tasks";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { ICommissionSummary } from "@/utils/interfaces/commissions";
import type { ITopAccount } from "../(services)/dashboard-actions";

export function RepDashboard({
  orders,
  tasks,
  accounts,
  commissionSummary,
  monthlyRevenue,
  currentQuota,
  topAccounts,
}: {
  orders: DashboardOrder[];
  tasks: ITask[];
  accounts: IAccount[];
  commissionSummary: ICommissionSummary | null;
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  currentQuota: number | null;
  topAccounts: ITopAccount[];
}) {
  const router = useRouter();

  const openTasks = useMemo(() => tasks.filter((t) => t.status === "open"), [tasks]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );

  function handleOrderClick(orderId: string) {
    router.push(`/dashboard/orders?order=${orderId}`);
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your sales overview" />

      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="My Accounts"   value={String(accounts.length)}   accentColor="teal"   />
        <KpiCard label="Open Tasks"    value={String(openTasks.length)}  accentColor="gold"   />
        <KpiCard label="My Orders"     value={String(orders.length)}     accentColor="blue"   />
        <KpiCard label="Active Orders" value={String(activeOrders)}      accentColor="purple" />
      </div>

      {commissionSummary && (
        <div className="mb-5 grid grid-cols-2 gap-[10px]">
          <KpiCard label="Commission Earned" value={formatAmount(commissionSummary.totalEarned)}   accentColor="teal" />
          <KpiCard label="Pending Payout"    value={formatAmount(commissionSummary.totalPending)}  accentColor="gold" />
        </div>
      )}

      <SensingKpiRow monthlyRevenue={monthlyRevenue} orders={orders} />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <RevenueTrendChart data={monthlyRevenue} quota={currentQuota} />
        <PipelineFunnel orders={orders} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopAccountsCard items={topAccounts} />
        <TodaysFocus tasks={tasks} orders={orders} onOrderClick={handleOrderClick} />
      </div>
    </>
  );
}
