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
    <div className="flex items-center gap-3 p-4 border-b border-[#E2E8F0]">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-[#E2E8F0] bg-white placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 transition-colors"
        />
      </div>
      {filterElement && <div className="shrink-0">{filterElement}</div>}
    </div>
  );
}
