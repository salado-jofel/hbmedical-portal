import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-24 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-44 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Kanban board — 7 columns */}
      <div className="flex gap-3 overflow-x-hidden">
        {[3, 2, 1, 2, 1, 2, 1].map((count, col) => (
          <div key={col} className="min-w-[210px] flex-1 rounded-[10px] border border-[#e2e8f0] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-5 w-6 rounded-full bg-[#e2e8f0]" />
            </div>
            {[...Array(count)].map((_, card) => (
              <div key={card} className="rounded-[8px] border border-[#e2e8f0] bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
                  <Skeleton className="h-5 w-14 rounded-full bg-[#e2e8f0]" />
                </div>
                <Skeleton className="h-3 w-32 bg-[#e2e8f0]" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-3 w-16 bg-[#e2e8f0]" />
                  <Skeleton className="h-3 w-12 bg-[#e2e8f0]" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
