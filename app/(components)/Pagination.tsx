"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/utils/utils";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  type PageSize,
} from "@/utils/interfaces/paginated";

interface PaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  className?: string;
  /** Omit the size selector (useful when the caller locks page size). */
  hideSizeSelector?: boolean;
}

/**
 * Server-paginated list footer. Shows:
 *   "Showing A–B of N"  [size selector]   « ‹ 1 2 3 4 5 › »
 *
 * A visible window of page numbers around the current page so long lists
 * don't render 50 buttons. First / last / prev / next are always present.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
  hideSizeSelector = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(clampedPage * pageSize, total);

  const pageButtons = visiblePages(clampedPage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:flex-row",
        className,
      )}
    >
      {/* Left: range + size selector */}
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-[var(--text3)]">
          {total === 0
            ? "No results"
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </span>
        {!hideSizeSelector && (
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const next = (PAGE_SIZES as readonly number[]).includes(raw)
                  ? (raw as PageSize)
                  : DEFAULT_PAGE_SIZE;
                onPageSizeChange(next);
              }}
              className="rounded-[5px] border border-[var(--border)] bg-white px-1.5 py-[2px] text-[11px] font-medium text-[var(--text)] outline-none focus:border-[var(--navy)]"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right: page nav */}
      <div className="flex items-center gap-1">
        <NavButton
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </NavButton>
        <NavButton
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(clampedPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavButton>

        {pageButtons.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1.5 text-[11px] text-[var(--text3)]"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-[26px] rounded-[5px] px-2 py-[2px] text-[11px] font-medium transition-colors",
                p === clampedPage
                  ? "bg-[var(--navy)] text-white"
                  : "text-[var(--text2)] hover:bg-[var(--bg)]",
              )}
            >
              {p}
            </button>
          ),
        )}

        <NavButton
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(clampedPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </NavButton>
        <NavButton
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  children,
  disabled,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-[5px] p-1 text-[var(--text2)] transition-colors enabled:hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:text-[var(--border)]"
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Compute the list of visible page buttons around `current`. Shows the
 * first / last page always, plus a window around the current page with
 * ellipses when there's a gap. Examples (current=6, total=20):
 *   [1, "…", 4, 5, 6, 7, 8, "…", 20]
 */
function visiblePages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const windowStart = Math.max(2, current - 2);
  const windowEnd = Math.min(total - 1, current + 2);
  if (windowStart > 2) pages.push("…");
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);
  if (windowEnd < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}
