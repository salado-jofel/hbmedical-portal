/**
 * Sort columns for the Sales Log.
 */

export const SALES_LOG_SORT_COLUMNS = [
  "date",
  "amount",
  "commission",
  "rep",
] as const;
export type SalesLogSortColumn = (typeof SALES_LOG_SORT_COLUMNS)[number];

export interface SalesLogRow {
  id: string;           // commission id
  orderId: string;
  orderNumber: string;
  repId: string;
  repName: string;
  client: string;       // facility name
  amount: number;       // order total
  commission: number;   // final commission amount
  date: string;         // order placed_at
  status: "completed" | "pending";
}
