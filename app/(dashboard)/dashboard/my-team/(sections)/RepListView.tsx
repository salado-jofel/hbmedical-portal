"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MyTeamKpiRow } from "./MyTeamKpiRow";
import { MyTeamFilterBar } from "./MyTeamFilterBar";
import { RepListRow } from "./RepListRow";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export function RepListView({
  status,
  period,
  view,
}: {
  status: StatusFilter;
  period: AccountPeriod;
  view: ViewFilter;
}) {
  const rows = useAppSelector((s) => s.myTeam.rows);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.first_name ?? ""} ${r.last_name ?? ""} ${r.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <MyTeamKpiRow />

      <MyTeamFilterBar
        status={status}
        period={period}
        view={view}
        search={search}
        onSearchChange={setSearch}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 stroke-1" />}
          message="No reps match"
          description="Adjust filters or search to see more results"
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
          {filtered.map((row) => (
            <RepListRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
