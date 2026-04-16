"use client";

import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export function MyTeamKpiRow() {
  const k = useAppSelector((s) => s.myTeam.kpis);
  if (!k) return null;

  const cards = [
    {
      value: String(k.totalReps),
      label: "Total Reps",
      sub: `${k.repsDirect} direct · ${k.repsIndirect} indirect`,
    },
    {
      value: String(k.totalAccounts),
      label: "Total Accounts",
      sub: `${k.accountsDirect} direct · ${k.accountsViaTeam} via team`,
    },
    {
      value: String(k.totalOrders),
      label: "Total Orders",
      sub: `${k.ordersDelivered} delivered`,
    },
    {
      value: formatAmount(k.deliveredRevenue),
      label: "Delivered Revenue",
      sub: `${k.deliveredOrdersConfirmed} orders confirmed`,
      accent: true,
    },
    {
      value: String(k.activeReps),
      label: "Active Reps",
      sub: `of ${k.activeRepsTotalDenominator} total`,
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-[10px] md:grid-cols-3 lg:grid-cols-5">
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
