"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { KpiCard } from "@/app/(components)/KpiCard";
import { PillBadge } from "@/app/(components)/PillBadge";
import { DataTable } from "@/app/(components)/DataTable";
import { PageHeader } from "@/app/(components)/PageHeader";
import { formatDate, formatStatus } from "@/utils/helpers/formatter";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { DashboardOrder } from "@/utils/interfaces/orders";

type StatusVariant = "green" | "blue" | "gold" | "red" | "teal" | "purple";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "blue", pending_signature: "gold", manufacturer_review: "gold",
  additional_info_needed: "red", approved: "teal", shipped: "blue",
  delivered: "green", canceled: "red",
};

const columns: TableColumn<DashboardOrder>[] = [
  { key: "order_number", label: "Order #",  render: (o) => <span className="font-medium text-[var(--navy)]">{o.order_number}</span> },
  { key: "patient",      label: "Patient",  render: (o) => <span className="text-[var(--text)]">{o.patient_full_name || "—"}</span> },
  { key: "order_status", label: "Status",   render: (o) => <PillBadge label={formatStatus(o.order_status)} variant={STATUS_VARIANT[o.order_status] ?? "blue"} /> },
  { key: "placed_at",    label: "Date",     render: (o) => <span className="text-[var(--text2)]">{formatDate(o.placed_at)}</span> },
];

export function SupportDashboard({ orders }: { orders: DashboardOrder[] }) {
  const router = useRouter();

  const inReview    = useMemo(() => orders.filter((o) => o.order_status === "manufacturer_review").length,       [orders]);
  const infoNeeded  = useMemo(() => orders.filter((o) => o.order_status === "additional_info_needed").length,   [orders]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.order_status !== "canceled" && o.order_status !== "draft").length,
    [orders],
  );
  const reviewQueue = useMemo(
    () =>
      [...orders]
        .filter((o) => o.order_status === "manufacturer_review" || o.order_status === "additional_info_needed")
        .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()),
    [orders],
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Support overview" />

      <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-3">
        <KpiCard label="Under Review"     value={String(inReview)}   accentColor="gold" />
        <KpiCard label="Needs More Info"  value={String(infoNeeded)} accentColor="red"  />
        <KpiCard label="Active Orders" value={String(activeOrders)}  accentColor="teal" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_220px]">
        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Review Queue</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">In review + info needed · oldest first</p>
          </div>
          <DataTable columns={columns} data={reviewQueue} keyExtractor={(o) => o.id} emptyMessage="Review queue is clear" onRowClick={() => router.push("/dashboard/orders")} />
        </div>

        <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
            <p className="text-[13px] font-semibold text-[var(--navy)]">Quick Actions</p>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <Link href="/dashboard/orders" className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] px-4 py-3 text-left transition hover:border-[var(--navy)] hover:shadow-sm">
              <ClipboardCheck className="h-4 w-4 shrink-0 text-[var(--navy)]" />
              <span className="text-[13px] font-medium text-[var(--navy)]">Review Orders</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
