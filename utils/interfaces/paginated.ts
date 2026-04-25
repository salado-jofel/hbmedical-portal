/**
 * Shared types for server-side paginated list queries.
 *
 * Pattern:
 *   Server action signature:  (input: PaginatedQuery<F>) => Promise<PaginatedResult<Row>>
 *   Client hook:              useListParams<F>() → matches the query input shape
 *
 * Search intentionally sits in a separate, ephemeral client state — search
 * terms in this app can include PHI (patient names, facility names) and
 * URLs end up in browser history, server logs, analytics, CDNs. Not worth
 * the HIPAA exposure.
 */

export type SortDirection = "asc" | "desc";

/** Page size options exposed in the UI. Keep in sync with the Pagination component. */
export const PAGE_SIZES = [20, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

/**
 * Query input for any paginated server action.
 *
 * `search` is optional — pass it through from the client's ephemeral input
 * to server-side ILIKE predicates. Not persisted in URL state.
 */
export interface PaginatedQuery<TFilters = Record<string, string | null>> {
  page: number;           // 1-based
  pageSize: PageSize;
  sort: string;           // column name — server validates against an allowlist
  dir: SortDirection;
  filters?: TFilters;
  search?: string;
}

/**
 * Paginated response. `total` is the count of rows matching the filters
 * (not just the current page) so the client can render "page N of M".
 */
export interface PaginatedResult<TRow> {
  rows: TRow[];
  total: number;
  page: number;
  pageSize: PageSize;
}

/** Clamp a user-supplied page size to the allowlist. */
export function sanitizePageSize(size: unknown): PageSize {
  const n = Number(size);
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

/** Clamp a user-supplied page number to a positive integer. */
export function sanitizePage(page: unknown): number {
  const n = Math.floor(Number(page));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Clamp dir to the enum. */
export function sanitizeDir(dir: unknown): SortDirection {
  return dir === "asc" ? "asc" : "desc";
}

/**
 * Clamp a sort column to an allowlist. Callers MUST provide an allowlist
 * because the column name goes straight into a Supabase `.order(col)`.
 */
export function sanitizeSort<A extends readonly string[]>(
  sort: unknown,
  allowlist: A,
  fallback: A[number],
): A[number] {
  return typeof sort === "string" && (allowlist as readonly string[]).includes(sort)
    ? (sort as A[number])
    : fallback;
}

/** Convert (page, pageSize) → half-open range for Supabase .range(from, to). */
export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
