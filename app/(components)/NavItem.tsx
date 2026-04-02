"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive: boolean;
}

export function NavItem({ icon: Icon, label, href, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${isActive
        ? "bg-[#EFF6FF] text-[#15689E] font-medium"
        : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-normal"
        }`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${isActive ? "text-[#15689E]" : "text-[#64748B]"
          }`}
      />
      {label}
    </Link>
  );
}
