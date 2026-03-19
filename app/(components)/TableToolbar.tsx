"use client";

import { Search } from "lucide-react";
import { ReactNode } from "react";

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filterElement?: ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterElement,
}: TableToolbarProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 text-slate-700 focus:outline-none focus:border-[#2db0b0] transition-colors"
        />
      </div>
      {filterElement && <div className="shrink-0">{filterElement}</div>}
    </div>
  );
}
