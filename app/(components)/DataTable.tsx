"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { TableColumn } from "../../utils/interfaces/table-column";
import { staggerContainer, fadeUp } from "@/components/ui/animations";

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (row: T) => void;
  rowNumbered?: boolean;
  rowClassName?: string;
  // kept for backwards compatibility — ignored internally
  headerVariant?: "brand" | "minimal";
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data found",
  emptyIcon,
  onRowClick,
  rowNumbered = false,
  rowClassName = "",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon ?? <Inbox className="w-10 h-10 stroke-1" />}
        message={emptyMessage}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
            {rowNumbered && (
              <th className="px-4 py-[9px] text-[10px] uppercase tracking-[0.6px] font-semibold text-[var(--text3)] w-10">
                #
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-[9px] text-[10px] uppercase tracking-[0.6px] font-semibold text-[var(--text3)] ${col.headerClassName ?? ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
          {data.map((row, index) => (
            <motion.tr
              key={keyExtractor(row)}
              variants={fadeUp}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)] transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              } ${rowClassName}`}
            >
              {rowNumbered && (
                <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--text3)] w-10 select-none">
                  {index + 1}
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-[10px] text-[13px] ${col.cellClassName ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
