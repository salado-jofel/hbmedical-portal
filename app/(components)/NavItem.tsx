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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
        isActive
          ? "bg-[#f0f9f9] text-[#2db0b0] border-l-4 border-[#2db0b0] rounded-l-none"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${
          isActive ? "text-[#2db0b0]" : "text-slate-400"
        }`}
      />
      {label}
    </Link>
  );
}
