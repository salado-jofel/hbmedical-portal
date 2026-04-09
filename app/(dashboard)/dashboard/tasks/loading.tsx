import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-24 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-44 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Toolbar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
        <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
      </div>

      {/* 4 kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["Overdue", "Today", "Upcoming", "Done"].map((_, col) => (
          <div key={col} className="rounded-[10px] border border-[#e2e8f0] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-5 w-6 rounded-full bg-[#e2e8f0]" />
            </div>
            {[...Array(2)].map((_, card) => (
              <div key={card} className="rounded-[8px] border border-[#e2e8f0] bg-white p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Skeleton className="h-4 w-4 rounded bg-[#e2e8f0] shrink-0 mt-0.5" />
                  <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0]" />
                  <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
                </div>
                <Skeleton className="h-3 w-32 bg-[#e2e8f0]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
