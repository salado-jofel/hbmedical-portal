"use client";

import { PillBadge } from "@/app/(components)/PillBadge";
import { formatAmount } from "@/utils/helpers/formatter";

const PAYOUTS = [
  { initials: "SM", name: "Sarah Mitchell", amount: 2096, color: "bg-[var(--teal)]",    status: "paid"    },
  { initials: "JO", name: "James Ochoa",    amount: 1912, color: "bg-[var(--blue)]",    status: "paid"    },
  { initials: "RK", name: "Rachel Kim",     amount: 3060, color: "bg-[var(--gold)]",    status: "paid"    },
  { initials: "DP", name: "Devon Patel",    amount: 2755, color: "bg-[var(--navy)]",    status: "paid"    },
  { initials: "TB", name: "Tanya Brooks",   amount: 500,  color: "bg-[var(--purple)]",  status: "pending" },
];

export default function PayoutTable() {
  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">April Payouts</p>
      </div>
      <div className="divide-y divide-[var(--border)] px-4">
        {PAYOUTS.map((row) => (
          <div
            key={row.initials}
            className="flex items-center justify-between py-[9px]"
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${row.color}`}
              >
                {row.initials}
              </div>
              <span className="text-[13px] font-medium text-[var(--navy)]">
                {row.name.split(" ")[0]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-[13px] font-semibold text-[var(--teal)]"
                style={{ fontFamily: "var(--font-dm-mono), monospace" }}
              >
                {formatAmount(row.amount)}
              </span>
              <PillBadge
                label={row.status === "paid" ? "Paid" : "Pending"}
                variant={row.status === "paid" ? "green" : "gold"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
