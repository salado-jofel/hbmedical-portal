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
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0]">
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
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px ${
                isActive
                  ? "text-[#15689E] border-b-2 border-[#15689E]"
                  : "text-[#94A3B8] hover:text-[#64748B]"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isActive ? "bg-[#EFF6FF] text-[#15689E]" : "bg-[#F1F5F9] text-[#64748B]"
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
