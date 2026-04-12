import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 mx-auto space-y-6 animate-pulse">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-28 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-64 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-[#e2e8f0] p-4 space-y-2">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-12 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Search bar */}
      <Skeleton className="h-9 w-full rounded-lg bg-[#e2e8f0]" />

      {/* 3 sub-rep card placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-[#e2e8f0] p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full bg-[#e2e8f0]" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
                  <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0]" />
            </div>
            {/* Contact */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-48 bg-[#e2e8f0]" />
              <Skeleton className="h-3 w-32 bg-[#e2e8f0]" />
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#f1f5f9]">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-5 w-8 bg-[#e2e8f0]" />
                  <Skeleton className="h-2.5 w-14 bg-[#e2e8f0]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
