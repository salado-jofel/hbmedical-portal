"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ShoppingCart } from "lucide-react";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PillBadge } from "@/app/(components)/PillBadge";
import { DataTable } from "@/app/(components)/DataTable";
import { PageHeader } from "@/app/(components)/PageHeader";
import { OrderStatusChart } from "@/app/(dashboard)/dashboard/(components)/OrderStatusChart";
import { formatDate, formatStatus } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { DashboardOrder } from "@/utils/interfaces/orders";

type StatusVariant = "green" | "blue" | "gold" | "red" | "teal" | "purple";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "blue", pending_signature: "gold", manufacturer_review: "gold",
  additional_info_needed: "red", approved: "teal", shipped: "blue",
  delivered: "green", canceled: "red",
};

const QUICK_ACTIONS = [
  { label: "Create Order",    icon: Plus,         href: "/dashboard/orders" },
  { label: "View All Orders", icon: ShoppingCart, href: "/dashboard/orders" },
];

const columns: TableColumn<DashboardOrder>[] = [
  { key: "order_number", label: "Order #",  render: (o) => <span className="font-medium text-[var(--navy)]">{o.order_number}</span> },
  { key: "patient",      label: "Patient",  render: (o) => <span className="text-[var(--text)]">{o.patient_full_name || "—"}</span> },
  { key: "order_status", label: "Status",   render: (o) => <PillBadge label={formatStatus(o.order_status)} variant={STATUS_VARIANT[o.order_status] ?? "blue"} /> },
  { key: "placed_at",    label: "Date",     render: (o) => <span className="text-[var(--text2)]">{formatDate(o.placed_at)}</span> },
];

export function ClinicDashboard({ orders }: { orders: DashboardOrder[] }) {
  const router = useRouter();

  const drafts     = useMemo(() => orders.filter((o) => o.order_status === "draft").length,             [orders]);
  const pendingSig = useMemo(() => orders.filter((o) => o.order_status === "pending_signature").length, [orders]);
  const approved   = useMemo(() => orders.filter((o) => o.order_status === "approved").length,          [orders]);
  const recent     = useMemo(
    () => [...orders].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()).slice(0, 10),
    [orders],
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your clinic overview" />

      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <KpiCard label="My Orders"         value={String(orders.length)} accentColor="teal"  />
        <KpiCard label="Drafts"            value={String(drafts)}        accentColor="blue"  />
        <KpiCard label="Pending Signature" value={String(pendingSig)}    accentColor="gold"  />
        <KpiCard label="Approved"          value={String(approved)}      accentColor="green" />
      </div>

      <div className="mb-5">
        <OrderStatusChart orders={orders} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px]">
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">My Recent Orders</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">Latest {recent.length} orders</p>
          </div>
          <DataTable columns={columns} data={recent} keyExtractor={(o) => o.id} emptyMessage="No orders yet" onRowClick={() => router.push("/dashboard/orders")} />
        </div>

        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Quick Actions</p>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
              <Link key={label} href={href} className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] px-4 py-3 text-left transition hover:border-[var(--navy)] hover:shadow-sm">
                <Icon className="h-4 w-4 shrink-0 text-[var(--navy)]" />
                <span className="text-[13px] font-medium text-[var(--navy)]">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
