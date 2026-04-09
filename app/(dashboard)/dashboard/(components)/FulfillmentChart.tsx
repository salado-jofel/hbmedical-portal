"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const FULFILLMENT_STATUSES = [
  { key: "pending",    label: "Pending",    color: "#c47d0a" },
  { key: "processing", label: "Processing", color: "#1565c0" },
  { key: "fulfilled",  label: "Fulfilled",  color: "#0d7a6b" },
  { key: "canceled",   label: "Canceled",   color: "#dc2626" },
] as const;

const DELIVERY_STATUSES = [
  { key: "not_shipped",   label: "Not Shipped",   color: "#94a3b8" },
  { key: "label_created", label: "Label Created", color: "#c47d0a" },
  { key: "in_transit",    label: "In Transit",    color: "#1565c0" },
  { key: "delivered",     label: "Delivered",     color: "#0d7a6b" },
  { key: "returned",      label: "Returned",      color: "#dc2626" },
] as const;

export function FulfillmentChart({ orders }: { orders: DashboardOrder[] }) {
  const data = useMemo(() => {
    const fulfillmentCounts: Record<string, number> = {};
    const deliveryCounts: Record<string, number> = {};

    for (const o of orders) {
      fulfillmentCounts[o.fulfillment_status] = (fulfillmentCounts[o.fulfillment_status] ?? 0) + 1;
      deliveryCounts[o.delivery_status] = (deliveryCounts[o.delivery_status] ?? 0) + 1;
    }

    return [
      {
        name: "Fulfillment",
        ...Object.fromEntries(FULFILLMENT_STATUSES.map((s) => [s.key, fulfillmentCounts[s.key] ?? 0])),
        ...Object.fromEntries(DELIVERY_STATUSES.map((s) => [s.key, 0])),
      },
      {
        name: "Delivery",
        ...Object.fromEntries(FULFILLMENT_STATUSES.map((s) => [s.key, 0])),
        ...Object.fromEntries(DELIVERY_STATUSES.map((s) => [s.key, deliveryCounts[s.key] ?? 0])),
      },
    ];
  }, [orders]);

  const hasData = orders.length > 0;

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Fulfillment & Delivery</p>
        <p className="mt-[1px] text-[11px] text-[var(--text3)]">Order processing pipeline</p>
      </div>
      <div className="p-4">
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-[var(--text3)]">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                formatter={(value) => (
                  <span style={{ fontSize: 10, color: "#475569" }}>{value}</span>
                )}
                wrapperStyle={{ paddingTop: 4 }}
              />
              {FULFILLMENT_STATUSES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="row" fill={s.color} radius={0} />
              ))}
              {DELIVERY_STATUSES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="row" fill={s.color} radius={0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
