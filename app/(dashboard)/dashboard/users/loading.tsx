import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader + button */}
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-7 w-24 bg-[#e2e8f0]" />
          <Skeleton className="h-4 w-44 mt-2 bg-[#e2e8f0]" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg bg-[#e2e8f0]" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {["Total", "Active", "Pending", "Inactive"].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] p-4 space-y-2">
            <Skeleton className="h-3 w-16 bg-[#e2e8f0]" />
            <Skeleton className="h-7 w-10 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex gap-1 p-1 rounded-lg border border-[#e2e8f0]">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded bg-[#e2e8f0]" />)}
        </div>
        <Skeleton className="h-9 flex-1 rounded-lg bg-[#e2e8f0]" />
        <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
      </div>

      {/* Users table */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="grid grid-cols-[40px_2fr_1.5fr_1fr_1fr_80px] gap-4 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
          {["w-6", "w-24", "w-28", "w-16", "w-16", "w-12"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} bg-[#e2e8f0]`} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-[40px_2fr_1.5fr_1fr_1fr_80px] gap-4 px-4 py-[13px] border-b border-[#f1f5f9] items-center">
            <Skeleton className="h-4 w-6 bg-[#e2e8f0]" />
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-full bg-[#e2e8f0]" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
                <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
              </div>
            </div>
            <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0]" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-7 rounded bg-[#e2e8f0]" />
              <Skeleton className="h-7 w-7 rounded bg-[#e2e8f0]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
