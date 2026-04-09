import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-36 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-52 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Hero banner */}
      <div className="rounded-[10px] overflow-hidden border border-[#e2e8f0]">
        <div className="flex items-center justify-between px-6 py-5 bg-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full bg-[#cbd5e1]" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36 bg-[#cbd5e1]" />
              <Skeleton className="h-3 w-48 bg-[#cbd5e1]" />
            </div>
          </div>
          <div className="text-right space-y-1.5">
            <Skeleton className="h-9 w-20 bg-[#cbd5e1] ml-auto" />
            <Skeleton className="h-3 w-28 bg-[#cbd5e1] ml-auto" />
          </div>
        </div>
        <div className="px-6 py-5 space-y-2">
          <Skeleton className="h-3 w-full rounded-full bg-[#e2e8f0]" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-32 bg-[#e2e8f0]" />
            <Skeleton className="h-3 w-10 bg-[#e2e8f0]" />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Skeleton className="h-2 w-2 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
          </div>
        </div>
      </div>

      {/* Quick log banner */}
      <Skeleton className="h-14 w-full rounded-[10px] bg-[#e2e8f0]" />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-28 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Revenue chart + Sub-rep table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
          <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
          <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
          <Skeleton className="h-[200px] w-full rounded-lg bg-[#e2e8f0]" />
        </div>
        <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
            <Skeleton className="h-3 w-24 mt-1 bg-[#e2e8f0]" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 items-center px-4 py-[12px] border-b border-[#f1f5f9]">
              <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-20 bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
              <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0] ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
