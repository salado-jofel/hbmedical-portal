export default function SignUpFormSkeleton() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[linear-gradient(135deg,#0a1f2e_0%,#0d2d35_50%,#0a2420_100%)] p-4 relative overflow-hidden">
      <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/5 backdrop-blur-2xl border-[#00d4c8]/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse mb-4" />
          <div className="h-6 w-52 bg-white/10 animate-pulse rounded-md mb-2" />
          <div className="h-4 w-44 bg-white/10 animate-pulse rounded-md" />
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-white/10 animate-pulse rounded-md" />
              <div className="h-12 w-full bg-white/10 animate-pulse rounded-md" />
            </div>

            <div className="space-y-2">
              <div className="h-4 w-24 bg-white/10 animate-pulse rounded-md" />
              <div className="h-12 w-full bg-white/10 animate-pulse rounded-md" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-white/10 animate-pulse rounded-sm" />
            <div className="h-4 w-24 bg-white/10 animate-pulse rounded-md" />
          </div>

          <div className="space-y-4 pt-2">
            <div className="h-12 w-full bg-white/10 animate-pulse rounded-md" />

            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <div className="h-3 w-6 bg-white/10 animate-pulse rounded" />
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="h-12 w-full bg-white/10 animate-pulse rounded-md" />
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="h-4 w-32 bg-white/10 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  );
}
