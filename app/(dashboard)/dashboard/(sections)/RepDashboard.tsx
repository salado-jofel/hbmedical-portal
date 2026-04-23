"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PageHeader } from "@/app/(components)/PageHeader";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
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
import type { LastPayout } from "../settings/(services)/stripe-connect-actions";

export function RepDashboard({
  orders,
  tasks,
  accounts,
  commissionSummary,
  monthlyRevenue,
  currentQuota,
  topAccounts,
  lastPayout,
}: {
  orders: DashboardOrder[];
  tasks: ITask[];
  accounts: IAccount[];
  commissionSummary: ICommissionSummary | null;
  monthlyRevenue: Array<{ period: string; revenue: number }>;
  currentQuota: number | null;
  topAccounts: ITopAccount[];
  lastPayout: LastPayout | null;
}) {
  const openTasks = useMemo(() => tasks.filter((t) => t.status === "open"), [tasks]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );

  // Revenue this month = last entry in the time series (server sorts chronologically).
  const revenueThisMonth = monthlyRevenue.length > 0
    ? monthlyRevenue[monthlyRevenue.length - 1].revenue
    : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your sales overview" />

      {/* Primary KPIs — mirror the Commissions page lifecycle so $ amounts
          map 1:1 to a stage with no overlap (Pending Approval and Awaiting
          Payout are disjoint buckets, not a parent/child total). */}
      <div className="mb-3 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="Revenue This Month" value={formatAmount(revenueThisMonth)}                              accentColor="teal"   />
        <KpiCard label="Pending Approval"   value={formatAmount(commissionSummary?.totalPending ?? 0)}          accentColor="green"  />
        <KpiCard label="Awaiting Payout"    value={formatAmount(commissionSummary?.totalApproved ?? 0)}         accentColor="gold"   />
        <KpiCard label="Active Orders"      value={String(activeOrders)}                                         accentColor="blue"   />
      </div>

      {/* Last payout strip — answers "when was I last paid?" at a glance. */}
      {lastPayout && (
        <Link
          href="/dashboard/commissions"
          className="mb-5 flex items-center gap-2 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] text-[var(--text2)] hover:border-[var(--navy)] transition-colors"
        >
          <Banknote className="h-3.5 w-3.5 text-[var(--teal)]" />
          <span>
            Last payout{" "}
            <span className="font-semibold text-[var(--navy)]">
              {formatAmount(lastPayout.totalAmount)}
            </span>
            {lastPayout.paidAt && (
              <>
                {" "}on{" "}
                <span className="text-[var(--navy)]">{formatDate(lastPayout.paidAt)}</span>
              </>
            )}
          </span>
          <span className="ml-auto text-[var(--text3)]">View history →</span>
        </Link>
      )}
      {!lastPayout && <div className="mb-5" />}

      {/* Secondary stats — growth trend + account reach.
          Only shown when there's something useful to display; we drop
          operational counts (My Accounts, My Orders) from the dashboard
          since they're one click away in the sidebar. */}
      <SensingKpiRow monthlyRevenue={monthlyRevenue} orders={orders} />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <RevenueTrendChart data={monthlyRevenue} quota={currentQuota} />
        <PipelineFunnel orders={orders} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
        <TopAccountsCard items={topAccounts} />
        <TodaysFocus tasks={tasks} orders={orders} />
      </div>

      {/* Mini open-tasks nudge — only when there are tasks to do. Avoids the
          dead "Open Tasks: 0" KPI card. */}
      {openTasks.length > 0 && (
        <p className="mb-5 text-[12px] text-[var(--text2)]">
          You have{" "}
          <Link href="/dashboard/tasks" className="font-semibold text-[var(--navy)] underline underline-offset-2">
            {openTasks.length} open task{openTasks.length === 1 ? "" : "s"}
          </Link>
          .
        </p>
      )}
      {/* `accounts` intentionally unused — kept on the prop surface so the
          rep's dashboard retains future room for an Accounts widget. */}
      {accounts.length === 0 && null}
    </>
  );
}
