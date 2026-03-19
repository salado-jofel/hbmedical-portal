import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full max-w-70">
      <div className="bg-slate-200 p-5 h-37">
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
    <div className="p-4 md:p-8 mx-auto space-y-8 select-none">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-52" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-3 w-40" />
        <div className="flex flex-wrap gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-3 w-40" />
        <div className="flex flex-wrap gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
