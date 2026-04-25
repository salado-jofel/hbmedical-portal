"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { ActionBar } from "@/app/(components)/ActionBar";
import { PillBadge } from "@/app/(components)/PillBadge";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { cn } from "@/utils/utils";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import { useListParams } from "@/utils/hooks/useListParams";
import { useBriefBusy } from "@/utils/hooks/useBriefBusy";
import {
  useOrderUpdatesRefresh,
  useCommissionUpdatesRefresh,
} from "@/utils/hooks/useOrderRealtime";
import {
  getSalesLogPaginated,
  getSalesLogReps,
} from "../(services)/actions";
import {
  SALES_LOG_SORT_COLUMNS,
  type SalesLogRow,
} from "@/utils/constants/sales-log";
import { DEFAULT_PAGE_SIZE, type PaginatedResult } from "@/utils/interfaces/paginated";

const STATUS_VARIANT: Record<SalesLogRow["status"], "green" | "gold"> = {
  completed: "green",
  pending: "gold",
};

// Tiny deterministic color picker so each rep gets a stable avatar tint.
function repColor(id: string): string {
  const palette = [
    "bg-[var(--teal)]",
    "bg-[var(--blue)]",
    "bg-[var(--gold)]",
    "bg-[var(--navy)]",
    "bg-[var(--purple)]",
  ];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[hash % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function SalesTable() {
  // Search ephemeral — rep names + facility names can be identifying.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const listParams = useListParams<
    typeof SALES_LOG_SORT_COLUMNS,
    readonly ["rep"]
  >({
    defaultSort: "date",
    defaultDir: "desc",
    allowedSorts: SALES_LOG_SORT_COLUMNS,
    filterKeys: ["rep"] as const,
  });
  const repFilter = listParams.filters.rep ?? "";

  const [data, setData] = useState<PaginatedResult<SalesLogRow>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isFetching, setIsFetching] = useState(false);
  const [reps, setReps] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    getSalesLogReps()
      .then((list) => {
        if (!cancelled) setReps(list);
      })
      .catch((err) => console.error("[SalesTable] getSalesLogReps failed:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancellation via an incrementing ref so a slow older fetch doesn't
  // overwrite a newer faster one on rapid pagination.
  const fetchIdRef = useRef(0);
  const refetch = useCallback(async () => {
    const myId = ++fetchIdRef.current;
    setIsFetching(true);
    try {
      const res = await getSalesLogPaginated({
        page: listParams.page,
        pageSize: listParams.pageSize,
        sort: listParams.sort,
        dir: listParams.dir,
        filters: { rep: listParams.filters.rep },
        search: debouncedSearch,
      });
      if (myId !== fetchIdRef.current) return;
      setData(res);
    } catch (err) {
      if (myId !== fetchIdRef.current) return;
      console.error("[SalesTable] fetch failed:", err);
      toast.error("Failed to load sales.");
    } finally {
      if (myId === fetchIdRef.current) setIsFetching(false);
    }
  }, [
    listParams.page,
    listParams.pageSize,
    listParams.sort,
    listParams.dir,
    listParams.filters.rep,
    debouncedSearch,
  ]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Live updates — sales log is derived from commissions + orders, so both
  // realtime subscriptions matter.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useOrderUpdatesRefresh(); // covers orders.status / updated_at changes globally
  useCommissionUpdatesRefresh();

  // Combined busy: listParams.isPending flips synchronously on click,
  // covering the URL-update lag; useBriefBusy on the debounced search
  // covers search-input changes (search isn't URL-backed); isFetching
  // covers the actual server call duration.
  const paramsBusy = useBriefBusy([debouncedSearch], 250);
  const tableBusy = isFetching || listParams.isPending || paramsBusy;

  return (
    <div className="space-y-4">
      <ActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search order #, rep, client..."
      >
        <select
          value={repFilter}
          onChange={(e) =>
            listParams.setFilter("rep", e.target.value ? e.target.value : null)
          }
          className="h-8 rounded-[7px] border border-[var(--border2)] bg-transparent px-2.5 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="">All Reps</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </ActionBar>

      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <TableBusyBar busy={tableBusy} />
        <div className={cn("overflow-x-auto transition-opacity", tableBusy && "opacity-60")}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Order #
                </th>
                <th className="px-4 py-[9px]">
                  <SortableHeader
                    label="Rep"
                    column="rep"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(
                        c as typeof SALES_LOG_SORT_COLUMNS[number],
                      )
                    }
                  />
                </th>
                <th className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Client
                </th>
                <th className="px-4 py-[9px]">
                  <SortableHeader
                    label="Amount"
                    column="amount"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(
                        c as typeof SALES_LOG_SORT_COLUMNS[number],
                      )
                    }
                    align="right"
                  />
                </th>
                <th className="px-4 py-[9px]">
                  <SortableHeader
                    label="Commission"
                    column="commission"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(
                        c as typeof SALES_LOG_SORT_COLUMNS[number],
                      )
                    }
                    align="right"
                  />
                </th>
                <th className="px-4 py-[9px]">
                  <SortableHeader
                    label="Date"
                    column="date"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(
                        c as typeof SALES_LOG_SORT_COLUMNS[number],
                      )
                    }
                  />
                </th>
                <th className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && !isFetching ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-[13px] text-[var(--text3)]"
                  >
                    No sales found.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                  >
                    <td
                      className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]"
                      style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                    >
                      {row.orderNumber}
                    </td>
                    <td className="px-4 py-[10px]">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${repColor(row.repId)}`}
                        >
                          {initials(row.repName)}
                        </div>
                        <span className="text-[13px] text-[var(--text)]">
                          {row.repName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-[10px] text-[13px] text-[var(--text)]">
                      {row.client}
                    </td>
                    <td
                      className="px-4 py-[10px] text-[13px] text-right"
                      style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td
                      className="px-4 py-[10px] text-[13px] font-medium text-right text-[var(--teal)]"
                      style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                    >
                      {formatAmount(row.commission)}
                    </td>
                    <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-[10px]">
                      <PillBadge
                        label={row.status === "completed" ? "Completed" : "Pending"}
                        variant={STATUS_VARIANT[row.status] ?? "gold"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={listParams.setPage}
          onPageSizeChange={listParams.setPageSize}
        />
      </div>
    </div>
  );
}
