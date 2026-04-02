"use client";

import { Search } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterBarProps {
  placeholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterValue?: string;
  filterOptions?: FilterOption[];
  onFilterChange?: (value: string) => void;
}

export function SearchFilterBar({
  placeholder = "Search...",
  searchValue,
  onSearchChange,
  filterValue,
  filterOptions,
  onFilterChange,
}: SearchFilterBarProps) {
  const hasFilter = filterOptions && filterOptions.length > 0 && onFilterChange;

  return (
    <div
      className={`flex gap-2 ${hasFilter ? "flex-col sm:flex-row" : "flex-row items-center"}`}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 h-9 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 transition-colors"
        />
      </div>

      {hasFilter && (
        <select
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full sm:w-auto border border-[#E2E8F0] rounded-lg px-3 h-9 text-sm text-[#0F172A] focus:outline-none focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 bg-white transition-colors"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
