import type { ReactNode } from "react";
import { Search } from "lucide-react";

export function ActionBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-[10px] flex flex-wrap items-center gap-2">
      <div className="relative min-w-[160px] flex-1">
        <Search className="absolute left-[9px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[var(--text3)]" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] py-[7px] pl-[30px] pr-[10px] text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
        />
      </div>
      {children}
    </div>
  );
}
