/**
 * Sort columns + filter keys for the paginated Users list.
 */

export const USER_SORT_COLUMNS = [
  "created_at",
  "first_name",
  "role",
  "status",
] as const;
export type UserSortColumn = (typeof USER_SORT_COLUMNS)[number];

export type UserListFilters = {
  role: string | null;
  status: string | null;
};
