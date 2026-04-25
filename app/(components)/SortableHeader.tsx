"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/utils/utils";
import type { SortDirection } from "@/utils/interfaces/paginated";

interface SortableHeaderProps {
  label: string;
  column: string;
  /** Column this table is currently sorted by. */
  currentSort: string;
  currentDir: SortDirection;
  onToggle: (column: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
}

/**
 * Click-to-sort column header. Renders:
 *   [label] [↑ / ↓ / ⇅]
 *
 * Indicator states:
 *   - Active column, asc  → solid ↑
 *   - Active column, desc → solid ↓
 *   - Inactive column     → faint ⇅
 */
export function SortableHeader({
  label,
  column,
  currentSort,
  currentDir,
  onToggle,
  className,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={cn(
        "flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] transition-colors hover:text-[var(--text)]",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
        isActive && "text-[var(--navy)]",
        className,
      )}
    >
      <span>{label}</span>
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
