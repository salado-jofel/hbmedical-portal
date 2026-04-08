"use client";

import { TableToolbar } from "@/app/(components)/TableToolbar";
import { ACCOUNT_STATUS_FILTER_OPTIONS } from "@/utils/constants/accounts";
import type { FilterSelect } from "@/utils/interfaces/table-toolbar";
import type { IRepProfile, AccountStatus } from "@/utils/interfaces/accounts";

export function AccountsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  repFilter,
  onRepFilterChange,
  salesReps,
  isAdmin,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: AccountStatus | "all";
  onStatusFilterChange: (v: AccountStatus | "all") => void;
  repFilter: string;
  onRepFilterChange: (v: string) => void;
  salesReps: IRepProfile[];
  isAdmin: boolean;
}) {
  const repOptions = [
    { value: "all", label: "All reps" },
    ...salesReps.map((rep) => ({
      value: rep.id,
      label: `${rep.first_name} ${rep.last_name}`,
    })),
  ];

  const filters: FilterSelect[] = [
    {
      value: statusFilter,
      onChange: (v) => onStatusFilterChange(v as AccountStatus | "all"),
      options: ACCOUNT_STATUS_FILTER_OPTIONS,
      placeholder: "All statuses",
      className: "w-full sm:w-44",
    },
    ...(isAdmin
      ? [
          {
            value: repFilter,
            onChange: onRepFilterChange,
            options: repOptions,
            placeholder: "All reps",
            className: "w-full sm:w-52",
          } satisfies FilterSelect,
        ]
      : []),
  ];

  return (
    <TableToolbar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search accounts..."
      className="flex-col sm:flex-row"
      filters={filters}
    />
  );
}
