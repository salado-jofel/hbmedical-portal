"use client";

import Link from "next/link";
import { cn } from "@/utils/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive: boolean;
  collapsed?: boolean;
}

export function NavItem({
  icon: Icon,
  label,
  href,
  isActive,
  collapsed = false,
}: NavItemProps) {
  const link = (
    <Link
      href={href}
      className={cn(
        "relative flex items-center text-sm font-normal transition-all duration-150 select-none outline-none rounded-lg",
        collapsed
          ? "justify-center w-10 h-10 mx-auto"
          : "gap-2.5 px-3 py-[7px]",
        isActive
          ? "bg-[#EBF4FF] text-[#15689E] font-medium"
          : "text-[#475569] hover:bg-[#F5F8FB] hover:text-[#0F172A]",
      )}
    >
      {/* Left accent bar — expanded active only */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-[#15689E]" />
      )}

      {/* Active dot — collapsed only */}
      {isActive && collapsed && (
        <span className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#15689E]" />
      )}

      <Icon
        className={cn(
          "shrink-0 transition-colors duration-150",
          collapsed ? "w-[17px] h-[17px]" : "w-[15px] h-[15px]",
          isActive ? "text-[#15689E]" : "text-[#94A3B8]",
        )}
        strokeWidth={isActive ? 2.2 : 1.8}
      />

      {!collapsed && (
        <span className="truncate leading-none tracking-[-0.01em]">{label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="text-xs font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
