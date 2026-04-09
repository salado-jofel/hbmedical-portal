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

      {/* Sales log table */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
          {["w-16", "w-28", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} bg-[#e2e8f0]`} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 px-4 py-[13px] border-b border-[#f1f5f9] items-center">
            <Skeleton className="h-4 w-20 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
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
