"use client";

import { TableToolbar } from "@/app/(components)/TableToolbar";
import {
  ACCOUNT_STATUS_FILTER_OPTIONS,
  ACCOUNT_PERIOD_OPTIONS,
  ACCOUNT_TIER_FILTER_OPTIONS,
} from "@/utils/constants/accounts";
import type { FilterSelect } from "@/utils/interfaces/table-toolbar";
import type {
  IRepProfile,
  AccountStatus,
  AccountPeriod,
  AccountTier,
} from "@/utils/interfaces/accounts";

export function AccountsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  repFilter,
  onRepFilterChange,
  periodFilter,
  onPeriodFilterChange,
  tierFilter,
  onTierFilterChange,
  salesReps,
  isAdmin,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: AccountStatus | "all";
  onStatusFilterChange: (v: AccountStatus | "all") => void;
  repFilter: string;
  onRepFilterChange: (v: string) => void;
  periodFilter: AccountPeriod;
  onPeriodFilterChange: (v: AccountPeriod) => void;
  tierFilter: AccountTier | "all";
  onTierFilterChange: (v: AccountTier | "all") => void;
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
    {
      value: periodFilter,
      onChange: (v) => onPeriodFilterChange(v as AccountPeriod),
      options: ACCOUNT_PERIOD_OPTIONS,
      placeholder: "This Month",
      className: "w-full sm:w-40",
    },
    {
      value: tierFilter,
      onChange: (v) => onTierFilterChange(v as AccountTier | "all"),
      options: ACCOUNT_TIER_FILTER_OPTIONS,
      placeholder: "All tiers",
      className: "w-full sm:w-36",
    },
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
