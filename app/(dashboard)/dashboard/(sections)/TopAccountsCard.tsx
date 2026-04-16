import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatAmount } from "@/utils/helpers/formatter";
import type { ITopAccount } from "../(services)/dashboard-actions";

export function TopAccountsCard({ items }: { items: ITopAccount[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Top Accounts</p>
        <p className="text-[11px] text-[var(--text3)]">Last 3 months delivered revenue</p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <Building2 className="w-8 h-8 text-[#cbd5e1] mb-2 stroke-1" />
          <p className="text-[12px] text-[var(--text3)]">No delivered revenue yet in the last 3 months</p>
        </div>
      ) : (
        <ul>
          {items.map((a, i) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/accounts/${a.id}`}
                className="flex items-center gap-3 border-b border-[var(--border)] last:border-b-0 px-4 py-3 cursor-pointer hover:bg-[#f8fafc]"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-white text-[11px] font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--navy)] truncate">{a.name}</p>
                  <p className="text-[11px] text-[var(--text3)] truncate">
                    {a.city}{a.city && a.state ? ", " : ""}{a.state}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--navy)] shrink-0">
                  {formatAmount(a.deliveredRevenue)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
