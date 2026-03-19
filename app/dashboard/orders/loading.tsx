// app/dashboard/orders/loading.tsx

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="shrink-0">
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[{ count: 2 }, { count: 0 }, { count: 0 }].map((col, colIndex) => (
          <div
            key={colIndex}
            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>

            {/* Cards */}
            {col.count > 0 ? (
              [...Array(col.count)].map((_, i) => (
                <div
                  key={i}
                  className="border border-slate-100 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <Skeleton className="h-3.5 w-36" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-12">
                <Skeleton className="h-4 w-16" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
