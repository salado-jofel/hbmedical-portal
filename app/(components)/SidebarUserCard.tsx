"use client";

import {
  User,
  Stethoscope,
  BriefcaseMedical,
  ShieldCheck,
  HeadsetIcon,
} from "lucide-react";
import { cn } from "@/utils/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarUserCardProps {
  name?: string | null;
  email?: string | null;
  initials?: string | null;
  role?: string | null;
  isSubRep?: boolean;
  collapsed?: boolean;
}

function getRoleBadge(role: string, isSubRep?: boolean) {
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
      label: isSubRep ? "SUB SALES REP" : "SALES REP",
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
  isSubRep,
  collapsed = false,
}: SidebarUserCardProps) {
  const avatar = (
    <div className="w-8 h-8 rounded-full bg-[#15689E] flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ring-2 ring-white">
      {initials || <User className="w-4 h-4" />}
    </div>
  );

  if (collapsed) {
    return (
      <div className="px-3 py-3 border-t border-[#E8EFF5] flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="cursor-default" type="button">
              {avatar}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="text-xs">
            <p className="font-medium">{name || "—"}</p>
            <p className="text-[10px] opacity-70">{email || "—"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-t border-[#E8EFF5] flex items-center gap-2.5">
      {avatar}

      <div className="flex flex-col overflow-hidden gap-0.5 min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-[#0F172A] leading-tight truncate tracking-[-0.01em]">
          {name || "—"}
        </span>
        <span className="text-[10px] text-[#94A3B8] truncate leading-none">
          {email || "—"}
        </span>

        {role != null &&
          (() => {
            const badge = getRoleBadge(role, isSubRep);
            return (
              <div
                className={cn(
                  "inline-flex items-center gap-1 mt-1 w-fit px-1.5 py-[3px] rounded text-[9px] font-bold uppercase tracking-[0.06em]",
                  badge.className,
                )}
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
