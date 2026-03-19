"use client";

import { User, Stethoscope, BriefcaseMedical } from "lucide-react";

interface SidebarUserCardProps {
  name?: string | null;
  email?: string | null;
  initials?: string | null;
  role?: string | null;
}

export function SidebarUserCard({
  name,
  email,
  initials,
  role,
}: SidebarUserCardProps) {
  const isDoctor = role === "doctor";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafb] border border-slate-100 mb-3">
      <div className="w-10 h-10 rounded-full bg-[#1db0b0] flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
        {initials || <User className="w-5 h-5" />}
      </div>
      <div className="flex flex-col overflow-hidden gap-0.5 min-w-0">
        <span className="text-sm font-bold text-[#1e293b] leading-tight truncate">
          {name || "—"}
        </span>
        <span className="text-[10px] text-slate-400 truncate">
          {email || "—"}
        </span>
        {role != null && (
          <div
            className={`inline-flex items-center gap-1.5 mt-1 w-fit px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
              isDoctor
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-teal-50 text-teal-600 border-teal-200"
            }`}
          >
            {isDoctor ? (
              <>
                <Stethoscope className="w-3 h-3" />
                Doctor
              </>
            ) : (
              <>
                <BriefcaseMedical className="w-3 h-3" />
                Sales Rep
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
