"use client";

/**
 * URL-backed pagination / sort / filter state for paginated list pages.
 *
 * Writes a minimal set of query params so refreshes, deep links, and
 * browser back/forward behave correctly:
 *   ?page=2&pageSize=25&sort=updated_at&dir=desc&[filters…]
 *
 * What's NOT in the URL:
 *   - `search` input — search terms in this app can include patient names
 *     and facility names (PHI). URLs end up in browser history, analytics,
 *     proxy logs, CDN logs. Keep search in the caller's own useState.
 *
 * Typical use:
 *
 *   const params = useListParams({
 *     defaultSort: "updated_at",
 *     defaultDir:  "desc",
 *     allowedSorts: ["updated_at", "placed_at", "order_number"] as const,
 *     filterKeys:   ["status"] as const,
 *   });
 *
 *   params.page         // 1-based
 *   params.pageSize     // 20 | 25 | 50
 *   params.sort         // one of allowedSorts
 *   params.dir          // "asc" | "desc"
 *   params.filters      // Record<filterKey, string | null>
 *
 *   params.setPage(2)
 *   params.setPageSize(50)
 *   params.toggleSort("order_number")     // cycles asc/desc for that col
 *   params.setFilter("status", "shipped")
 *   params.reset()                         // back to page 1, default sort, no filters
 */

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  type PageSize,
  type SortDirection,
  sanitizeDir,
  sanitizePage,
  sanitizePageSize,
  sanitizeSort,
} from "@/utils/interfaces/paginated";

export interface UseListParamsConfig<
  AllowedSorts extends readonly string[],
  FilterKeys extends readonly string[],
> {
  defaultSort: AllowedSorts[number];
  defaultDir?: SortDirection;
  allowedSorts: AllowedSorts;
  filterKeys: FilterKeys;
  /** Override default page size (must be in PAGE_SIZES). */
  defaultPageSize?: PageSize;
}

export interface UseListParamsResult<
  AllowedSorts extends readonly string[],
  FilterKeys extends readonly string[],
> {
  page: number;
  pageSize: PageSize;
  sort: AllowedSorts[number];
  dir: SortDirection;
  filters: Record<FilterKeys[number], string | null>;

  setPage: (p: number) => void;
  setPageSize: (s: PageSize) => void;
  setSort: (s: AllowedSorts[number], dir?: SortDirection) => void;
  /** Click-to-sort: if already sorted by col, flip dir; otherwise switch to col with defaultDir. */
  toggleSort: (s: AllowedSorts[number]) => void;
  setFilter: (key: FilterKeys[number], value: string | null) => void;
  reset: () => void;

  /**
   * `true` while a navigation triggered by setPage / setSort / setFilter etc
   * is in flight. Flips ON synchronously the moment the handler is called —
   * before `router.replace()` has finished updating the URL — so consumers
   * can show a loading indicator the same render as the click. The indicator
   * stays ON until the transition's render commits, after which `searchParams`
   * reflects the new URL.
   */
  isPending: boolean;
}

export function useListParams<
  AllowedSorts extends readonly string[],
  FilterKeys extends readonly string[],
>(config: UseListParamsConfig<AllowedSorts, FilterKeys>): UseListParamsResult<AllowedSorts, FilterKeys> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const defaultDir = config.defaultDir ?? "desc";
  const defaultPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const page = sanitizePage(searchParams.get("page"));
  const pageSize = sanitizePageSize(searchParams.get("pageSize") ?? defaultPageSize);
  const sort = sanitizeSort(
    searchParams.get("sort"),
    config.allowedSorts,
    config.defaultSort,
  );
  const dir = sanitizeDir(searchParams.get("dir") ?? defaultDir);

  const filters = useMemo(() => {
    const out = {} as Record<FilterKeys[number], string | null>;
    for (const key of config.filterKeys) {
      const raw = searchParams.get(key);
      (out as Record<string, string | null>)[key] = raw && raw.length > 0 ? raw : null;
    }
    return out;
  }, [searchParams, config.filterKeys]);

  const writeParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      // startTransition gives us a synchronously-true `isPending` that
      // consumers can hook into for an instant loading indicator. Without
      // this, the only signal that "something happened" is the URL change
      // — which `router.replace` defers by ~30-200ms in Next 16's app
      // router, producing the click-to-feedback lag.
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [searchParams, router, pathname],
  );

  const setPage = useCallback((p: number) => writeParams({ page: p }), [writeParams]);

  const setPageSize = useCallback(
    (s: PageSize) => {
      const valid = (PAGE_SIZES as readonly number[]).includes(s) ? s : defaultPageSize;
      // Changing page size invalidates the current page — reset to 1.
      writeParams({ pageSize: valid, page: 1 });
    },
    [writeParams, defaultPageSize],
  );

  const setSort = useCallback(
    (s: AllowedSorts[number], d: SortDirection = defaultDir) => {
      // Changing sort invalidates page index — reset to 1.
      writeParams({ sort: s, dir: d, page: 1 });
    },
    [writeParams, defaultDir],
  );

  const toggleSort = useCallback(
    (s: AllowedSorts[number]) => {
      if (s === sort) {
        writeParams({ dir: dir === "asc" ? "desc" : "asc", page: 1 });
      } else {
        writeParams({ sort: s, dir: defaultDir, page: 1 });
      }
    },
    [sort, dir, defaultDir, writeParams],
  );

  const setFilter = useCallback(
    (key: FilterKeys[number], value: string | null) => {
      // Any filter change invalidates page index.
      writeParams({ [key]: value, page: 1 });
    },
    [writeParams],
  );

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname);
    });
  }, [router, pathname]);

  return {
    page,
    pageSize,
    sort,
    dir,
    filters,
    setPage,
    setPageSize,
    setSort,
    toggleSort,
    setFilter,
    reset,
    isPending,
  };
}
