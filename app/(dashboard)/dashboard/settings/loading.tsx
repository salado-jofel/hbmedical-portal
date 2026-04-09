import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-24 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-48 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-1">
        {["w-20", "w-20", "w-28"].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w} rounded-[7px] bg-[#e2e8f0]`} />
        ))}
      </div>

      {/* Form card */}
      <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-5">
        <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
              <Skeleton className="h-9 w-full rounded-lg bg-[#e2e8f0]" />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-32 rounded-lg bg-[#e2e8f0]" />
        </div>
      </div>

      {/* Change password section */}
      <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-4">
        <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28 bg-[#e2e8f0]" />
              <Skeleton className="h-9 w-full rounded-lg bg-[#e2e8f0]" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
        </div>
      </div>
    </div>
  );
}
