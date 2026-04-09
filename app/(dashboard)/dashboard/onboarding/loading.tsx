import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* PageHeader */}
      <div>
        <Skeleton className="h-7 w-32 bg-[#e2e8f0]" />
        <Skeleton className="h-4 w-56 mt-2 bg-[#e2e8f0]" />
      </div>

      {/* Info banner */}
      <Skeleton className="h-14 w-full rounded-[10px] bg-[#e2e8f0]" />

      {/* Invite form card */}
      <div className="rounded-[10px] border border-[#e2e8f0] p-5 space-y-4">
        <Skeleton className="h-4 w-32 bg-[#e2e8f0]" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
              <Skeleton className="h-9 w-full rounded-lg bg-[#e2e8f0]" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-lg bg-[#e2e8f0]" />
        </div>
      </div>

      {/* Invite tokens section */}
      <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
          <Skeleton className="h-3 w-20 bg-[#e2e8f0]" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-[14px] border-b border-[#f1f5f9]">
            <Skeleton className="h-4 w-40 bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-20 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-5 w-16 rounded-full bg-[#e2e8f0]" />
            <Skeleton className="h-4 w-24 bg-[#e2e8f0] ml-auto" />
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
