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
      className: "border",
      style: { background: "rgba(21,104,158,0.25)", color: "#7dd3f8", borderColor: "rgba(21,104,158,0.4)" },
      icon: <ShieldCheck className="w-3 h-3" />,
      label: "ADMIN",
    };
  }
  if (role === "sales_representative") {
    return {
      className: "border",
      style: { background: "rgba(232,130,26,0.2)", color: "#f5a255", borderColor: "rgba(232,130,26,0.35)" },
      icon: <BriefcaseMedical className="w-3 h-3" />,
      label: "SALES REP",
    };
  }
  if (role === "support_staff") {
    return {
      className: "border",
      style: { background: "rgba(124,58,237,0.2)", color: "#c4b5fd", borderColor: "rgba(124,58,237,0.35)" },
      icon: <HeadsetIcon className="w-3 h-3" />,
      label: "SUPPORT STAFF",
    };
  }
  if (role === "clinical_provider") {
    return {
      className: "border",
      style: { background: "rgba(13,148,136,0.2)", color: "#5eead4", borderColor: "rgba(13,148,136,0.35)" },
      icon: <Stethoscope className="w-3 h-3" />,
      label: "CLINICAL PROVIDER",
    };
  }
  if (role === "clinical_staff") {
    return {
      className: "border",
      style: { background: "rgba(71,85,105,0.25)", color: "#cbd5e1", borderColor: "rgba(71,85,105,0.4)" },
      icon: <User className="w-3 h-3" />,
      label: "CLINICAL STAFF",
    };
  }
  return {
    className: "border",
    style: { background: "rgba(232,130,26,0.15)", color: "#f5a255", borderColor: "rgba(232,130,26,0.3)" },
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
            <div
              className={`inline-flex items-center gap-1.5 mt-1 w-fit px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
              style={badge.style}
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
