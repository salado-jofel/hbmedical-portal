import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-28 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-52 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Sub-tab pills */}
      <div className="flex gap-1 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-1">
        {["w-28", "w-24", "w-24", "w-32", "w-20"].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w} rounded-[7px] bg-[#e2e8f0]`} />
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full rounded-lg bg-[#e2e8f0]" />

      {/* Card grid — 3 cols × 2 rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="h-28 bg-[#e2e8f0]" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
              <Skeleton className="h-3 w-full bg-[#e2e8f0]" />
              <Skeleton className="h-3 w-4/5 bg-[#e2e8f0]" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
                <Skeleton className="h-8 w-28 rounded-lg bg-[#e2e8f0]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
