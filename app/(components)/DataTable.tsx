import { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { Inbox } from "lucide-react";
import { TableColumn } from "../../utils/interfaces/table-column";

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  headerVariant?: "brand" | "minimal";
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data found",
  onRowClick,
  headerVariant = "brand",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="w-10 h-10 stroke-1" />}
        message={emptyMessage}
      />
    );
  }

  const isBrand = headerVariant === "brand";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr
            className="bg-[#F8FAFC] border-b border-[#E2E8F0]"
          >
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] ${
                  !isBrand ? (col.headerClassName ?? "") : ""
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3.5 text-sm text-[#64748B] ${col.cellClassName ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
