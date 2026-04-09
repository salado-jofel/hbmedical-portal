"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { PillBadge } from "@/app/(components)/PillBadge";
import { formatStatus } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";

type StatusVariant = "green" | "blue" | "gold" | "red" | "teal" | "purple";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "blue", pending_signature: "gold", manufacturer_review: "gold",
  additional_info_needed: "red", approved: "teal", shipped: "blue",
  delivered: "green", canceled: "red",
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ orders }: { orders: DashboardOrder[] }) {
  const recent = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10),
    [orders],
  );

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Recent Activity</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Latest order updates</p>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {recent.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-[13px] text-[var(--text3)]">
            No data yet
          </div>
        ) : (
          recent.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-b-0"
            >
              <span
                className="shrink-0 text-[12px] font-medium text-[var(--navy)]"
                style={{ fontFamily: "var(--font-dm-mono, monospace)" }}
              >
                {o.order_number}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text2)]">
                {o.patient_full_name || "—"}
              </span>
              <PillBadge
                label={formatStatus(o.order_status)}
                variant={STATUS_VARIANT[o.order_status] ?? "blue"}
              />
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--text3)]">
                <Clock className="h-3 w-3" />
                {relativeTime(o.updated_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
