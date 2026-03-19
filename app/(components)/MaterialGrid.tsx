import { ReactNode } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface MaterialsGridProps {
  children: ReactNode;
  isEmpty: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function MaterialsGrid({
  children,
  isEmpty,
  emptyMessage = "No materials available",
  emptyDescription = "Materials will appear here once added",
}: MaterialsGridProps) {
  if (isEmpty) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
        }
        message={emptyMessage}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {children}
    </div>
  );
}
