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
} from "recharts";
import { formatStatus } from "@/utils/helpers/formatter";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const FALLBACK_COLOR = "#94a3b8";

/* Presentation only — both rows are built from the data, so a status missing
 * from these maps still draws, labelled via formatStatus() in the fallback
 * colour. The delivery map previously omitted `exception` and `canceled`
 * entirely, which would have silently dropped those orders from the bar the
 * first time one occurred.
 *
 * The lifecycle arrays control stacking order only. A status not listed sorts
 * to the end rather than disappearing.
 *
 * Keys are prefixed because the two axes collide: `canceled` is a valid value
 * of BOTH fulfillment_status and delivery_status, and the bars share a stackId,
 * so an unprefixed dataKey would make one axis overwrite the other. */
const FULFILLMENT_PRESENTATION: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending",    color: "#c47d0a" },
  processing: { label: "Processing", color: "#1565c0" },
  fulfilled:  { label: "Fulfilled",  color: "#0d7a6b" },
  canceled:   { label: "Canceled",   color: "#dc2626" },
};
const FULFILLMENT_ORDER = ["pending", "processing", "fulfilled", "canceled"] as const;

const DELIVERY_PRESENTATION: Record<string, { label: string; color: string }> = {
  not_shipped:   { label: "Not Shipped",   color: "#94a3b8" },
  label_created: { label: "Label Created", color: "#c47d0a" },
  in_transit:    { label: "In Transit",    color: "#1565c0" },
  delivered:     { label: "Delivered",     color: "#0d7a6b" },
  returned:      { label: "Returned",      color: "#dc2626" },
  exception:     { label: "Exception",     color: "#b91c1c" },
  canceled:      { label: "Canceled",      color: "#dc2626" },
};
const DELIVERY_ORDER = [
  "not_shipped", "label_created", "in_transit", "delivered",
  "returned", "exception", "canceled",
] as const;

type Series = { status: string; dataKey: string; label: string; color: string };

function toSeries(
  counts: Record<string, number>,
  presentation: Record<string, { label: string; color: string }>,
  lifecycle: readonly string[],
  prefix: string,
): Series[] {
  const rank = (status: string) => {
    const index = lifecycle.indexOf(status);
    return index === -1 ? lifecycle.length : index;
  };
  return Object.keys(counts)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((status) => ({
      status,
      dataKey: `${prefix}${status}`,
      label: presentation[status]?.label ?? formatStatus(status),
      color: presentation[status]?.color ?? FALLBACK_COLOR,
    }));
}

export function FulfillmentChart({ orders }: { orders: DashboardOrder[] }) {
  const { data, fulfillmentSeries, deliverySeries } = useMemo(() => {
    const fulfillmentCounts: Record<string, number> = {};
    const deliveryCounts: Record<string, number> = {};

    for (const o of orders) {
      if (o.fulfillment_status) {
        fulfillmentCounts[o.fulfillment_status] = (fulfillmentCounts[o.fulfillment_status] ?? 0) + 1;
      }
      if (o.delivery_status) {
        deliveryCounts[o.delivery_status] = (deliveryCounts[o.delivery_status] ?? 0) + 1;
      }
    }

    const fSeries = toSeries(fulfillmentCounts, FULFILLMENT_PRESENTATION, FULFILLMENT_ORDER, "f_");
    const dSeries = toSeries(deliveryCounts, DELIVERY_PRESENTATION, DELIVERY_ORDER, "d_");
    const zeros = (series: Series[]) => Object.fromEntries(series.map((s) => [s.dataKey, 0]));
    const values = (series: Series[], counts: Record<string, number>) =>
      Object.fromEntries(series.map((s) => [s.dataKey, counts[s.status] ?? 0]));

    return {
      fulfillmentSeries: fSeries,
      deliverySeries: dSeries,
      data: [
        { name: "Fulfillment", ...zeros(dSeries), ...values(fSeries, fulfillmentCounts) },
        { name: "Delivery",    ...zeros(fSeries), ...values(dSeries, deliveryCounts) },
      ],
    };
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
              {fulfillmentSeries.map((s) => (
                <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label} stackId="row" fill={s.color} radius={0} />
              ))}
              {deliverySeries.map((s) => (
                <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label} stackId="row" fill={s.color} radius={0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
