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
            className={isBrand ? "bg-[#15689E]" : "border-b border-slate-100"}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-medium text-xs tracking-wide ${
                  isBrand
                    ? "text-white font-semibold"
                    : (col.headerClassName ?? "text-slate-400")
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`hover:bg-slate-50 transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-5 py-3 text-slate-600 ${col.cellClassName ?? ""}`}
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
