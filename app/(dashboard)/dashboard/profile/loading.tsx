// app/dashboard/profile/loading.tsx

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" /> {/* "My Profile" */}
        <Skeleton className="h-4 w-48" /> {/* "Manage your account" */}
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
        {/* First Name + Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {["First Name", "Last Name"].map((field) => (
            <div key={field} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Save Changes button */}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
