/**
 * Sort columns for the Products admin list. Direct columns on the products
 * table — sort happens client-side against the Redux-hydrated list (small
 * catalog, no scaling concern).
 */

export const PRODUCT_SORT_COLUMNS = [
  "name",
  "sku",
  "category",
  "unit_price",
  "is_active",
  "created_at",
] as const;
export type ProductSortColumn = (typeof PRODUCT_SORT_COLUMNS)[number];
