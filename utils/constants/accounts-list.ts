/**
 * Sort columns + filter keys for the paginated Accounts list.
 *
 * Lives in its own non-"use server" module so both the client (allowedSorts
 * in useListParams) and the server action (sanitize target) can import
 * without the "use server" single-export constraint.
 */

export const ACCOUNT_SORT_COLUMNS = [
  "name",
  "status",
  "tier",
  "delivered_revenue",
  "signed_count",
  "created_at",
] as const;
export type AccountSortColumn = (typeof ACCOUNT_SORT_COLUMNS)[number];

export type AccountListFilters = {
  status: string | null;
  tier: string | null;
  rep: string | null;   // admin only — filter by assigned_rep
  owner: string | null; // rep only — "mine" | "sub_reps"
};
