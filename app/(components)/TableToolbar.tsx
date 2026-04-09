"use client";

import { Search } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";
import type { FilterSelect } from "@/utils/interfaces/table-toolbar";

export type { FilterOption, FilterSelect } from "@/utils/interfaces/table-toolbar";

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  filterElement,
  className,
}: {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  /** Declarative filter selects rendered after the search input */
  filters?: FilterSelect[];
  /** Escape hatch for arbitrary filter UI */
  filterElement?: ReactNode;
  /** Classes merged onto the wrapper div (use to add padding, border, etc.) */
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-[var(--border)] bg-white placeholder:text-[var(--text3)] text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10 transition-colors"
        />
      </div>

      {/* Radix Select — only rendered after client mount to avoid aria-controls hydration mismatch */}
      {filters?.map((filter, i) =>
        mounted ? (
          <Select key={i} value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger
              className={cn(
                "h-9 text-sm bg-white border-[var(--border)] text-[var(--navy)] rounded-lg shrink-0",
                filter.className,
              )}
            >
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div
            key={i}
            className={cn(
              "h-9 rounded-lg border border-[var(--border)] bg-[#e2e8f0] animate-pulse shrink-0",
              filter.className,
            )}
          />
        ),
      )}

      {filterElement && <div className="shrink-0">{filterElement}</div>}
    </div>
  );
}
