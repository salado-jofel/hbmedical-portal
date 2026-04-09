import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-28 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-52 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Filter row */}
      <div className="flex gap-3 items-center">
        <Skeleton className="h-9 flex-1 rounded-lg bg-[#e2e8f0]" />
        <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
        <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
      </div>

      {/* Accounts table */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_80px_80px] gap-4 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
          {["w-20", "w-16", "w-28", "w-24", "w-14", "w-14"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} bg-[#e2e8f0]`} />
          ))}
        </div>
        {/* Rows */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_80px_80px] gap-4 px-4 py-[14px] border-b border-[#f1f5f9] items-center">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
              <Skeleton className="h-3 w-28 bg-[#e2e8f0]" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0]" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-24 bg-[#e2e8f0]" />
            </div>
            <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-8 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-8 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
