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
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {rowNumbered && (
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] w-10">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] ${col.headerClassName ?? ""}`}
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
                className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                } ${rowClassName}`}
              >
                {rowNumbered && (
                  <td className="px-4 py-3.5 text-xs font-medium text-[#94A3B8] w-10 select-none">
                    {index + 1}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 ${col.cellClassName ?? ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
