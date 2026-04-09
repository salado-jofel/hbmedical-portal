"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Users, Package } from "lucide-react";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PillBadge } from "@/app/(components)/PillBadge";
import { DataTable } from "@/app/(components)/DataTable";
import { PageHeader } from "@/app/(components)/PageHeader";
import { RevenueChart } from "@/app/(dashboard)/dashboard/(components)/RevenueChart";
import { OrderStatusChart } from "@/app/(dashboard)/dashboard/(components)/OrderStatusChart";
import { PaymentSplitChart } from "@/app/(dashboard)/dashboard/(components)/PaymentSplitChart";
import { FulfillmentChart } from "@/app/(dashboard)/dashboard/(components)/FulfillmentChart";
import { WoundTypeChart } from "@/app/(dashboard)/dashboard/(components)/WoundTypeChart";
import { UserStatusChart } from "@/app/(dashboard)/dashboard/(components)/UserStatusChart";
import { ActivityFeed } from "@/app/(dashboard)/dashboard/(components)/ActivityFeed";
import { AlertsBanner } from "@/app/(dashboard)/dashboard/(components)/AlertsBanner";
import { formatAmount, formatDate, formatStatus } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { IUser } from "@/utils/interfaces/users";

type StatusVariant = "green" | "blue" | "gold" | "red" | "teal" | "purple";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "blue", pending_signature: "gold", manufacturer_review: "gold",
  additional_info_needed: "red", approved: "teal", shipped: "blue",
  delivered: "green", canceled: "red",
};

const PIPELINE = [
  { key: "draft",                    label: "Draft",       variant: "blue"  as StatusVariant },
  { key: "pending_signature",        label: "Pending Sig", variant: "gold"  as StatusVariant },
  { key: "manufacturer_review",      label: "In Review",   variant: "gold"  as StatusVariant },
  { key: "additional_info_needed",   label: "Info Needed", variant: "red"   as StatusVariant },
  { key: "approved",                 label: "Approved",    variant: "teal"  as StatusVariant },
  { key: "shipped",                  label: "Shipped",     variant: "blue"  as StatusVariant },
  { key: "delivered",                label: "Delivered",   variant: "green" as StatusVariant },
];

const QUICK_ACTIONS = [
  { label: "Review Orders",  icon: ClipboardCheck, href: "/dashboard/orders"   },
  { label: "Manage Users",   icon: Users,          href: "/dashboard/users"    },
  { label: "View Products",  icon: Package,        href: "/dashboard/products" },
];

const columns: TableColumn<DashboardOrder>[] = [
  { key: "order_number",    label: "Order #",  render: (o) => <span className="font-medium text-[var(--navy)] text-[12px]" style={{ fontFamily: "var(--font-dm-mono),monospace" }}>{o.order_number}</span> },
  { key: "patient",         label: "Patient",  render: (o) => <span className="text-[var(--text)]">{o.patient_full_name || "—"}</span> },
  { key: "order_status",    label: "Status",   render: (o) => <PillBadge label={formatStatus(o.order_status)} variant={STATUS_VARIANT[o.order_status] ?? "blue"} /> },
  { key: "placed_at",       label: "Date",     render: (o) => <span className="text-[var(--text2)]">{formatDate(o.placed_at)}</span> },
  { key: "total_amount",    label: "Amount",   render: (o) => <span className="text-[12px]" style={{ fontFamily: "var(--font-dm-mono),monospace" }}>{formatAmount(o.total_amount)}</span> },
];

export function AdminDashboard({
  orders,
  users,
}: {
  orders: DashboardOrder[];
  users: IUser[];
}) {
  const router = useRouter();

  const revenue = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled").reduce((s, o) => s + (o.total_amount ?? 0), 0),
    [orders],
  );
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );
  const recent = useMemo(
    () => [...orders].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()).slice(0, 10),
    [orders],
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Master overview" />

      {/* 1. Alerts */}
      <AlertsBanner orders={orders} users={users} />

      {/* 2. KPI grid */}
      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="Total Revenue"  value={formatAmount(revenue)}        accentColor="teal"   />
        <KpiCard label="Total Orders"   value={String(orders.length)}        accentColor="blue"   />
        <KpiCard label="Active Orders"  value={String(activeOrders)}         accentColor="gold"   />
        <KpiCard label="Users"          value={String(users.length)}         accentColor="purple" />
      </div>

      {/* 3. Charts row 1: Revenue Trend + Order Status */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <RevenueChart orders={orders} />
        <OrderStatusChart orders={orders} />
      </div>

      {/* 4. Charts row 2: Payment Split + Fulfillment */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentSplitChart orders={orders} />
        <FulfillmentChart orders={orders} />
      </div>

      {/* 5. Charts row 3: Wound Types + User Status */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WoundTypeChart orders={orders} />
        <UserStatusChart users={users} />
      </div>

      {/* 6. Order Pipeline */}
      <div className="mb-5 overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
          <p className="text-[13px] font-semibold text-[var(--navy)]">Order Pipeline</p>
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">Count by status</p>
        </div>
        <div className="grid grid-cols-7 gap-2 p-4">
          {PIPELINE.map(({ key, label, variant }) => (
            <button
              key={key}
              onClick={() => router.push("/dashboard/orders")}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2.5 transition hover:border-[var(--navy)]"
            >
              <span className="text-[15px] font-semibold text-[var(--navy)]">
                {orders.filter((o) => o.order_status === key).length}
              </span>
              <PillBadge label={label} variant={variant} />
            </button>
          ))}
        </div>
      </div>

      {/* 7. Recent Orders + Quick Actions + Activity Feed */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Recent Orders</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">Latest {recent.length} orders</p>
          </div>
          <DataTable columns={columns} data={recent} keyExtractor={(o) => o.id} emptyMessage="No orders yet" onRowClick={() => router.push("/dashboard/orders")} />
        </div>

        <div className="flex flex-col gap-4">
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

          <ActivityFeed orders={orders} />
        </div>
      </div>
    </>
  );
}
