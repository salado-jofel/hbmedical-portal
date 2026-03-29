// app/dashboard/facilities/loading.tsx

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="shrink-0">
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-slate-100">
          <Skeleton className="h-3 w-16" /> {/* Name */}
          <Skeleton className="h-3 w-14" /> {/* Type */}
          <Skeleton className="h-3 w-16" /> {/* Contact */}
          <Skeleton className="h-3 w-14" /> {/* Phone */}
          <Skeleton className="h-3 w-12" /> {/* Status */}
          <Skeleton className="h-3 w-20" /> {/* QuickBooks */}
        </div>

        {/* Rows */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-4 px-5 py-4 border-b border-slate-50 items-center"
          >
            {/* Name */}
            <Skeleton className="h-4 w-28" />
            {/* Type */}
            <Skeleton className="h-4 w-20" />
            {/* Contact */}
            <Skeleton className="h-4 w-24" />
            {/* Phone */}
            <Skeleton className="h-4 w-28" />
            {/* Status badge */}
            <Skeleton className="h-6 w-16 rounded-full" />
            {/* QB synced + date */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}

        {/* Footer — "Showing X of X facilities" */}
        <div className="px-5 py-3">
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}
