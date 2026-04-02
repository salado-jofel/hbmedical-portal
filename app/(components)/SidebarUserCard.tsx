"use client";

import { User, Stethoscope, BriefcaseMedical, ShieldCheck, HeadsetIcon } from "lucide-react";

interface SidebarUserCardProps {
  name?: string | null;
  email?: string | null;
  initials?: string | null;
  role?: string | null;
}

function getRoleBadge(role: string) {
  if (role === "admin") {
    return {
      className: "bg-[#EFF6FF] text-[#15689E]",
      icon: <ShieldCheck className="w-3 h-3" />,
      label: "ADMIN",
    };
  }
  if (role === "sales_representative") {
    return {
      className: "bg-orange-50 text-[#E8821A]",
      icon: <BriefcaseMedical className="w-3 h-3" />,
      label: "SALES REP",
    };
  }
  if (role === "support_staff") {
    return {
      className: "bg-purple-50 text-purple-700",
      icon: <HeadsetIcon className="w-3 h-3" />,
      label: "SUPPORT STAFF",
    };
  }
  if (role === "clinical_provider") {
    return {
      className: "bg-teal-50 text-teal-700",
      icon: <Stethoscope className="w-3 h-3" />,
      label: "CLINICAL PROVIDER",
    };
  }
  if (role === "clinical_staff") {
    return {
      className: "bg-slate-100 text-slate-600",
      icon: <User className="w-3 h-3" />,
      label: "CLINICAL STAFF",
    };
  }
  return {
    className: "bg-orange-50 text-[#E8821A]",
    icon: <BriefcaseMedical className="w-3 h-3" />,
    label: "STAFF",
  };
}

export function SidebarUserCard({
  name,
  email,
  initials,
  role,
}: SidebarUserCardProps) {
  return (
    <div className="px-3 py-3 border-t border-[#E2E8F0] mt-auto flex items-center gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[#15689E] flex items-center justify-center text-white text-xs font-semibold shrink-0">
        {initials || <User className="w-4 h-4" />}
      </div>

      {/* Name / email / role badge */}
      <div className="flex flex-col overflow-hidden gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-[#0F172A] leading-tight truncate">
          {name || "—"}
        </span>
        <span className="text-[10px] text-[#94A3B8] truncate">
          {email || "—"}
        </span>

        {role != null && (() => {
          const badge = getRoleBadge(role);
          return (
            <div
              className={`inline-flex items-center gap-1 mt-0.5 w-fit px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wide ${badge.className}`}
            >
              {badge.icon}
              {badge.label}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
