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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isActive
        ? "bg-[#f5a255]/15 text-[#f5a255] border-l-4 border-[#f5a255] rounded-l-none"
        : "text-white/60 hover:bg-white/8 hover:text-white"
        }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${isActive ? "text-[#f5a255]" : "text-white/40"
          }`}
      />
      {label}
    </Link>
  );
}
