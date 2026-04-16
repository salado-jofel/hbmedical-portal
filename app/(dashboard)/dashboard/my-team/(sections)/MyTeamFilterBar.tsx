"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { isAdmin } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { cn } from "@/utils/utils";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export function MyTeamFilterBar({
  status,
  period,
  view,
  search,
  onSearchChange,
}: {
  status: StatusFilter;
  period: AccountPeriod;
  view: ViewFilter;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showView = mounted && isAdmin(role);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Status</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateParam("status", s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                status === s
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              {s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {showView && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">View</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-[#f1f5f9] p-0.5">
            {(["all_sub_reps", "direct_only"] as const).map((v) => (
              <button
                key={v}
                onClick={() => updateParam("view", v)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === v
                    ? "bg-white text-[var(--navy)] shadow-sm"
                    : "text-[#64748b] hover:text-[#334155]",
                )}
              >
                {v === "all_sub_reps" ? "All Sub-Reps" : "Direct Only"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Period</span>
        <select
          value={period}
          onChange={(e) => updateParam("period", e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--navy)]"
        >
          <option value="this_month">This Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="all_time">All Time</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">Search</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 w-full rounded-md border border-[var(--border)] bg-white pl-9 pr-3 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
