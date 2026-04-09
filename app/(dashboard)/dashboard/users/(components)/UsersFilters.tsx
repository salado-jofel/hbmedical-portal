"use client";

import { TableToolbar } from "@/app/(components)/TableToolbar";
import { ROLE_FILTER_OPTIONS } from "@/utils/constants/users";
import type { StatusFilter } from "@/utils/interfaces/users";

export function UsersFilters({
  statusFilter,
  onStatusFilterChange,
  stats,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
}: {
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  stats: { total: number; active: number; pending: number; inactive: number };
  search: string;
  onSearchChange: (v: string) => void;
  roleFilter: string;
  onRoleFilterChange: (v: string) => void;
}) {
  return (
    <>
      {/* Status filter tabs */}
      <div className="flex gap-[3px] overflow-x-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1">
        {(
          [
            { key: "all",      label: "All Users", count: stats.total    },
            { key: "active",   label: "Active",    count: stats.active   },
            { key: "pending",  label: "Pending",   count: stats.pending  },
            { key: "inactive", label: "Inactive",  count: stats.inactive },
          ] as const
        ).map(({ key, label, count }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onStatusFilterChange(key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-[6px] text-[12px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[var(--navy)] text-white"
                  : "text-[var(--text2)] hover:bg-[var(--bg)]"
              }`}
            >
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? "bg-white/20 text-white" : "bg-[var(--border)] text-[var(--text2)]"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + role filter */}
      <TableToolbar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by name or email..."
        className="flex-col sm:flex-row gap-2.5"
        filters={[
          {
            value: roleFilter,
            onChange: onRoleFilterChange,
            options: ROLE_FILTER_OPTIONS,
            placeholder: "All roles",
            className: "w-full sm:w-44",
          },
        ]}
      />
    </>
  );
}
