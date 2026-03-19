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
          className="w-full pl-9 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent shadow-sm"
        />
      </div>

      {hasFilter && (
        <select
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white shadow-sm"
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
