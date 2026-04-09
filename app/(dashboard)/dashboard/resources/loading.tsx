import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full max-w-70">
      <div className="bg-slate-200 p-5 h-[148px]">
        <div className="flex items-start justify-between">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="space-y-1.5 mt-4">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1 justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="p-6 md:p-8 mx-auto space-y-8 select-none">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* Sub-tabs skeleton */}
      <div className="flex gap-[3px] rounded-[10px] border border-slate-200 bg-white p-1">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1 rounded-[7px]" />
        ))}
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-9 w-full rounded-[7px]" />

      {/* Group 1 */}
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>

      {/* Group 2 */}
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
