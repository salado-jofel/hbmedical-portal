import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Account header */}
      <div className="rounded-[10px] border border-[#e2e8f0] p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 bg-[#e2e8f0]" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
            </div>
          </div>
          <div className="rounded-[8px] border border-[#e2e8f0] p-3 space-y-1.5">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-1">
        {["w-20", "w-20", "w-24", "w-16"].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w} rounded-[7px] bg-[#e2e8f0]`} />
        ))}
      </div>

      {/* Content — 2 col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-4">
          <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
            </div>
          ))}
        </div>
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-4">
          <Skeleton className="h-4 w-24 bg-[#e2e8f0]" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full bg-[#e2e8f0]" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
              <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            </div>
          </div>
          <Skeleton className="h-4 w-48 bg-[#e2e8f0]" />
          <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
        </div>
      </div>

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
            </div>
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-3 w-36 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
