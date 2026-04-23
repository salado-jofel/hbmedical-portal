"use client";

import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export function MyTeamKpiRow() {
  const k = useAppSelector((s) => s.myTeam.kpis);
  if (!k) return null;

  // Plainer copy for non-technical users:
  //  • Drop "direct/indirect" and "via team" jargon — not meaningful for a
  //    1-level hierarchy.
  //  • Collapse "Active Reps" + "Total Reps" into a single Sub-Reps card.
  //  • Only highlight Delivered Revenue in green when there's actually revenue.
  const inactiveReps = Math.max(0, k.totalReps - k.activeReps);
  const repsSub =
    k.totalReps === 0
      ? "No sub-reps yet"
      : inactiveReps === 0
        ? "All active"
        : `${k.activeReps} active · ${inactiveReps} inactive`;

  const hasRevenue = k.deliveredRevenue > 0;

  const cards = [
    {
      value: String(k.totalReps),
      label: "Sub-Reps",
      sub: repsSub,
    },
    {
      value: String(k.totalAccounts),
      label: "Team Accounts",
      sub: k.totalAccounts === 0 ? "None yet" : "Clinics on your team",
    },
    {
      value: String(k.ordersDelivered),
      label: "Delivered Orders",
      sub: k.totalOrders === 0 ? "None yet" : `of ${k.totalOrders} total`,
    },
    {
      value: formatAmount(k.deliveredRevenue),
      label: "Team Revenue",
      sub: hasRevenue
        ? `${k.deliveredOrdersConfirmed} confirmed`
        : "No revenue this period",
      accent: hasRevenue,
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.accent
              ? "rounded-[var(--r)] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-4 text-center"
              : "rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center"
          }
        >
          <p className={
            c.accent
              ? "text-[22px] font-semibold leading-none text-[#16a34a]"
              : "text-[22px] font-semibold leading-none text-[var(--navy)]"
          }>
            {c.value}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
            {c.label}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text3)]">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
