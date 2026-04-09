import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-36 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-56 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Alerts Banner */}
      <Skeleton className="h-12 w-full rounded-lg bg-[#e2e8f0]" />

      {/* KPI Row — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-32 bg-[#e2e8f0]" />
            <Skeleton className="h-1 w-full rounded-full bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
          <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
          <Skeleton className="h-3 w-48 bg-[#e2e8f0]" />
          <Skeleton className="h-48 w-full rounded-lg bg-[#e2e8f0] mt-4" />
        </div>
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
          <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
          <Skeleton className="h-3 w-44 bg-[#e2e8f0]" />
          <div className="flex justify-center mt-4">
            <Skeleton className="h-44 w-44 rounded-full bg-[#e2e8f0]" />
          </div>
        </div>
      </div>

      {/* Pipeline pills */}
      <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
        <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
        <div className="grid grid-cols-7 gap-2 mt-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg bg-[#e2e8f0]" />)}
        </div>
      </div>

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
          <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
          <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
          <div className="space-y-0 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center py-3 border-b border-[#f1f5f9]">
                <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
                <Skeleton className="h-4 w-24 bg-[#e2e8f0]" />
                <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
                <Skeleton className="h-4 w-16 bg-[#e2e8f0] ml-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
            <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg bg-[#e2e8f0]" />)}
          </div>
          <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-2">
            <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center py-2">
                <Skeleton className="h-2 w-2 rounded-full bg-[#e2e8f0]" />
                <Skeleton className="h-3 w-32 bg-[#e2e8f0]" />
                <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0] ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
