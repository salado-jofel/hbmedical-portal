"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ScrollText } from "lucide-react";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { useListParams } from "@/utils/hooks/useListParams";
import { useBriefBusy } from "@/utils/hooks/useBriefBusy";
import { DEFAULT_PAGE_SIZE, type PaginatedResult } from "@/utils/interfaces/paginated";
import { getPhiAccessLog, getPhiAccessLogActions } from "../(services)/actions";
import {
  PHI_LOG_SORT_COLUMNS,
  type PhiAccessLogRow,
} from "../(services)/types";
import { cn } from "@/utils/utils";

/**
 * Admin audit log viewer. Read-only paginated table of every PHI access
 * the application has recorded. Filters by action / user email; search
 * across action, resource, user_email.
 *
 * Search is ephemeral (admins typing other users' emails into the URL
 * is undesirable from a least-disclosure standpoint).
 */
export function AuditLogTable() {
  const listParams = useListParams<
    typeof PHI_LOG_SORT_COLUMNS,
    readonly ["action", "resource", "user", "order"]
  >({
    defaultSort: "created_at",
    defaultDir: "desc",
    allowedSorts: PHI_LOG_SORT_COLUMNS,
    filterKeys: ["action", "resource", "user", "order"] as const,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [data, setData] = useState<PaginatedResult<PhiAccessLogRow>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isFetching, setIsFetching] = useState(false);
  const [actionOptions, setActionOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPhiAccessLogActions()
      .then((acts) => {
        if (!cancelled) setActionOptions(acts);
      })
      .catch((err) => console.error("[AuditLogTable] actions fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchIdRef = useRef(0);
  const refetch = useCallback(async () => {
    const myId = ++fetchIdRef.current;
    setIsFetching(true);
    try {
      const res = await getPhiAccessLog({
        page: listParams.page,
        pageSize: listParams.pageSize,
        sort: listParams.sort,
        dir: listParams.dir,
        filters: {
          action: listParams.filters.action,
          resource: listParams.filters.resource,
          user: listParams.filters.user,
          order: listParams.filters.order,
        },
        search: debouncedSearch,
      });
      if (myId !== fetchIdRef.current) return;
      setData(res);
    } catch (err) {
      if (myId !== fetchIdRef.current) return;
      console.error("[AuditLogTable] fetch failed:", err);
      toast.error("Failed to load audit log.");
    } finally {
      if (myId === fetchIdRef.current) setIsFetching(false);
    }
  }, [
    listParams.page,
    listParams.pageSize,
    listParams.sort,
    listParams.dir,
    listParams.filters.action,
    listParams.filters.resource,
    listParams.filters.user,
    listParams.filters.order,
    debouncedSearch,
  ]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const paramsBusy = useBriefBusy([debouncedSearch], 250);
  const tableBusy = isFetching || listParams.isPending || paramsBusy;

  const actionFilter = listParams.filters.action ?? "all";
  const resourceFilter = listParams.filters.resource ?? "all";

  return (
    <div className="space-y-5">
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search action, resource, or user…"
        className="flex-col sm:flex-row"
        filters={[
          {
            value: actionFilter,
            onChange: (v) =>
              listParams.setFilter("action", v === "all" ? null : v),
            options: [
              { value: "all", label: "All Actions" },
              ...actionOptions.map((a) => ({ value: a, label: a })),
            ],
            placeholder: "All Actions",
            className: "w-full sm:w-52",
          },
          {
            value: resourceFilter,
            onChange: (v) =>
              listParams.setFilter("resource", v === "all" ? null : v),
            options: [
              { value: "all", label: "All Resources" },
              { value: "orders", label: "orders" },
              { value: "order_ivr", label: "order_ivr" },
              { value: "order_documents", label: "order_documents" },
              { value: "order_delivery_invoices", label: "order_delivery_invoices" },
            ],
            placeholder: "All Resources",
            className: "w-full sm:w-52",
          },
        ]}
      />

      {data.rows.length === 0 && !tableBusy ? (
        <EmptyState
          icon={<ScrollText className="w-10 h-10 stroke-1" />}
          message="No log entries"
          description="Adjust your filters or wait for activity."
        />
      ) : (
        <div className="rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
          <TableBusyBar busy={tableBusy} />
          <table
            className={cn(
              "w-full text-sm transition-opacity",
              tableBusy && "opacity-60",
            )}
          >
            <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-[9px] text-left">
                  <SortableHeader
                    label="When"
                    column="created_at"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(c as typeof PHI_LOG_SORT_COLUMNS[number])
                    }
                  />
                </th>
                <th className="px-4 py-[9px] text-left">
                  <SortableHeader
                    label="User"
                    column="user_email"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(c as typeof PHI_LOG_SORT_COLUMNS[number])
                    }
                  />
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Role
                </th>
                <th className="px-4 py-[9px] text-left">
                  <SortableHeader
                    label="Action"
                    column="action"
                    currentSort={listParams.sort}
                    currentDir={listParams.dir}
                    onToggle={(c) =>
                      listParams.toggleSort(c as typeof PHI_LOG_SORT_COLUMNS[number])
                    }
                  />
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                  Resource
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] hidden md:table-cell">
                  Order
                </th>
                <th className="px-4 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] hidden lg:table-cell">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--bg)]">
                  <td className="px-4 py-[10px] text-[12px] text-[var(--text2)] whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-[10px] text-[12px] text-[var(--navy)]">
                    {row.user_email ?? "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[11px] text-[var(--text3)]">
                    {row.user_role ?? "—"}
                  </td>
                  <td
                    className="px-4 py-[10px] text-[12px] font-medium text-[var(--navy)]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {row.action}
                  </td>
                  <td
                    className="px-4 py-[10px] text-[12px] text-[var(--text2)]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {row.resource}
                  </td>
                  <td
                    className="px-4 py-[10px] text-[11px] text-[var(--text3)] hidden md:table-cell"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {row.order_id ? row.order_id.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-[10px] text-[11px] text-[var(--text3)] hidden lg:table-cell">
                    {row.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={listParams.setPage}
            onPageSizeChange={listParams.setPageSize}
          />
        </div>
      )}
    </div>
  );
}
