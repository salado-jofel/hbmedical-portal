/**
 * Sort columns + filter keys for the paginated Commission Ledger.
 */

export const COMMISSION_SORT_COLUMNS = [
  "createdAt",
  "payoutPeriod",
  "finalAmount",
  "status",
] as const;
export type CommissionSortColumn = (typeof COMMISSION_SORT_COLUMNS)[number];
