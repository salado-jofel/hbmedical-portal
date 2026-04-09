import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-32 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-56 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-3">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-28 bg-[#e2e8f0]" />
            <Skeleton className="h-1 w-full rounded-full bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Calculator + Rates row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-4">
          <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28 bg-[#e2e8f0]" />
              <Skeleton className="h-6 w-full rounded bg-[#e2e8f0]" />
            </div>
          ))}
          <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-2 mt-2">
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-32 bg-[#e2e8f0]" />
          </div>
        </div>
        <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
            <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
            <Skeleton className="h-8 w-24 rounded-lg bg-[#e2e8f0]" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-[13px] border-b border-[#f1f5f9]">
              <Skeleton className="h-8 w-8 rounded-full bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-12 bg-[#e2e8f0] ml-auto" />
              <Skeleton className="h-7 w-7 rounded bg-[#e2e8f0]" />
            </div>
          ))}
        </div>
      </div>

      {/* Commission ledger */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          <div className="space-y-1">
            <Skeleton className="h-4 w-36 bg-[#e2e8f0]" />
            <Skeleton className="h-3 w-24 bg-[#e2e8f0]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-lg bg-[#e2e8f0]" />
            <Skeleton className="h-9 w-24 rounded-lg bg-[#e2e8f0]" />
          </div>
        </div>
        <div className="grid grid-cols-8 gap-3 px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-3 w-16 bg-[#e2e8f0]" />)}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-8 gap-3 px-4 py-[12px] border-b border-[#f1f5f9] items-center">
            <Skeleton className="h-4 w-5 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-20 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-14 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-7 w-7 rounded bg-[#e2e8f0]" />
          </div>
        ))}
      </div>

      {/* Payouts table */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36 rounded-lg bg-[#e2e8f0]" />
            <Skeleton className="h-9 w-32 rounded-lg bg-[#e2e8f0]" />
          </div>
        </div>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 px-4 py-[13px] border-b border-[#f1f5f9] items-center">
            <Skeleton className="h-4 w-24 bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-16 bg-[#e2e8f0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
