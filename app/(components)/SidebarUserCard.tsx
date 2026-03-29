"use client";

import { User, Stethoscope, BriefcaseMedical, ShieldCheck } from "lucide-react";

interface SidebarUserCardProps {
  name?: string | null;
  email?: string | null;
  initials?: string | null;
  role?: string | null;
}

function getRoleBadge(role: string) {
  if (role === "admin") {
    return {
      className: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      icon: <ShieldCheck className="w-3 h-3" />,
      label: "Admin",
    };
  }
  if (role === "doctor") {
    return {
      className: "bg-[#15689E]/30 text-white/80 border-[#15689E]/40",
      icon: <Stethoscope className="w-3 h-3" />,
      label: "Physician",
    };
  }
  return {
    className: "bg-[#f5a255]/15 text-[#f5a255] border-[#f5a255]/30",
    icon: <BriefcaseMedical className="w-3 h-3" />,
    label: "Sales Rep",
  };
}

export function SidebarUserCard({
  name,
  email,
  initials,
  role,
}: SidebarUserCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 mb-3">
      {/* Avatar — orange bg */}
      <div className="w-10 h-10 rounded-full bg-[#f5a255] flex items-center justify-center text-white font-bold text-sm shrink-0">
        {initials || <User className="w-5 h-5" />}
      </div>

      {/* Name / email / role badge */}
      <div className="flex flex-col overflow-hidden gap-0.5 min-w-0">
        <span className="text-sm font-bold text-white leading-tight truncate">
          {name || "—"}
        </span>
        <span className="text-[10px] text-white/40 truncate">
          {email || "—"}
        </span>

        {role != null && (() => {
          const badge = getRoleBadge(role);
          return (
            <div className={`inline-flex items-center gap-1.5 mt-1 w-fit px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${badge.className}`}>
              {badge.icon}
              {badge.label}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
