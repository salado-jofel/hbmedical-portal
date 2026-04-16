"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { formatAmount } from "@/utils/helpers/formatter";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const STATUSES: OrderStatus[] = [
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
];

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending_signature:      "#f59e0b",
  manufacturer_review:    "#a855f7",
  additional_info_needed: "#ef4444",
  approved:               "#3b82f6",
  shipped:                "#06b6d4",
  delivered:              "#16a34a",
};

function orderTotal(o: DashboardOrder): number {
  return Number(o.total_amount ?? 0);
}

export function PipelineFunnel({ orders }: { orders: DashboardOrder[] }) {
  const data = useMemo(() => {
    const acc: Partial<Record<OrderStatus, { count: number; revenue: number }>> = {};
    for (const o of orders) {
      const s = o.order_status as OrderStatus;
      if (!STATUSES.includes(s)) continue;
      const prev = acc[s] ?? { count: 0, revenue: 0 };
      acc[s] = { count: prev.count + 1, revenue: prev.revenue + orderTotal(o) };
    }
    return STATUSES.map((s) => {
      const bucket = acc[s] ?? { count: 0, revenue: 0 };
      return {
        status: s,
        label: KANBAN_STATUS_CONFIG[s]?.label ?? s,
        count: bucket.count,
        revenue: bucket.revenue,
        labelText: `${bucket.count} · ${formatAmount(bucket.revenue)}`,
      };
    });
  }, [orders]);

  const hasAny = data.some((d) => d.count > 0);

  return (
    <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[13px] font-semibold text-[var(--navy)] mb-1">Pipeline Funnel</p>
      <p className="text-[11px] text-[var(--text3)] mb-3">Orders by status</p>
      {!hasAny ? (
        <div className="flex items-center justify-center h-[200px] text-xs text-[var(--text3)]">
          No orders yet
        </div>
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 80, bottom: 5, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text3)" }}
                width={110}
              />
              <Tooltip
                formatter={(v, _name, entry) => {
                  const d = entry?.payload as { count: number; revenue: number } | undefined;
                  return d ? [`${d.count} · ${formatAmount(d.revenue)}`, "Count · Value"] : [String(v), ""];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((d) => (
                  <Cell key={d.status} fill={STATUS_COLOR[d.status] ?? "#94a3b8"} />
                ))}
                <LabelList dataKey="labelText" position="right" style={{ fontSize: 10, fill: "var(--navy)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
