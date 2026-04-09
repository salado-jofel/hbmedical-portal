"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckSquare } from "lucide-react";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PillBadge } from "@/app/(components)/PillBadge";
import { DataTable } from "@/app/(components)/DataTable";
import { PageHeader } from "@/app/(components)/PageHeader";
import { formatDate } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { ITask } from "@/utils/interfaces/tasks";
import type { IAccount } from "@/utils/interfaces/accounts";

type PriorityVariant = "red" | "gold" | "blue";

const PRIORITY_VARIANT: Record<string, PriorityVariant> = {
  high: "red", medium: "gold", low: "blue",
};

const QUICK_ACTIONS = [
  { label: "View Accounts", icon: Building2,   href: "/dashboard/accounts" },
  { label: "View Tasks",    icon: CheckSquare, href: "/dashboard/tasks"    },
];

const taskColumns: TableColumn<ITask>[] = [
  { key: "title",    label: "Title",    render: (t) => <span className="font-medium text-[var(--navy)]">{t.title}</span> },
  { key: "due_date", label: "Due Date", render: (t) => <span className="text-[var(--text2)]">{formatDate(t.due_date)}</span> },
  {
    key: "priority",
    label: "Priority",
    render: (t) => <PillBadge label={t.priority.charAt(0).toUpperCase() + t.priority.slice(1)} variant={PRIORITY_VARIANT[t.priority] ?? "blue"} />,
  },
  { key: "account", label: "Account", render: (t) => <span className="text-[var(--text2)]">{t.facility?.name ?? "—"}</span> },
];

export function RepDashboard({
  orders,
  tasks,
  accounts,
}: {
  orders: DashboardOrder[];
  tasks: ITask[];
  accounts: IAccount[];
}) {
  const router = useRouter();

  const openTasks    = useMemo(() => tasks.filter((t) => t.status === "open"), [tasks]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );
  const sortedTasks  = useMemo(
    () => [...openTasks].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [openTasks],
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your sales overview" />

      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="My Accounts"   value={String(accounts.length)}   accentColor="teal"   />
        <KpiCard label="Open Tasks"    value={String(openTasks.length)}  accentColor="gold"   />
        <KpiCard label="My Orders"     value={String(orders.length)}     accentColor="blue"   />
        <KpiCard label="Active Orders" value={String(activeOrders)}      accentColor="purple" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px]">
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Open Tasks</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">Sorted by due date</p>
          </div>
          <DataTable columns={taskColumns} data={sortedTasks} keyExtractor={(t) => t.id} emptyMessage="No open tasks" onRowClick={() => router.push("/dashboard/tasks")} />
        </div>

        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Quick Actions</p>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
              <button key={href} onClick={() => router.push(href)} className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] px-4 py-3 text-left transition hover:border-[var(--navy)] hover:shadow-sm">
                <Icon className="h-4 w-4 shrink-0 text-[var(--navy)]" />
                <span className="text-[13px] font-medium text-[var(--navy)]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
