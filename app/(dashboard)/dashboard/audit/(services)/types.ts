// Non-server module: holds the const + type exports the audit actions file
// also re-uses. A "use server" file can only export async functions, so
// these have to live in a separate module to avoid Next's
// invalid-use-server-value error.

export interface PhiAccessLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  order_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const PHI_LOG_SORT_COLUMNS = [
  "created_at",
  "action",
  "user_email",
] as const;
export type PhiLogSortColumn = (typeof PHI_LOG_SORT_COLUMNS)[number];

export type PhiLogFilters = {
  action: string | null;
  resource: string | null;
  user: string | null; // user_email contains
  order: string | null; // order_id exact
};
