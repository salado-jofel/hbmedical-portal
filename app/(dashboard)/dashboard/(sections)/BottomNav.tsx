"use client";

import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  CheckSquare,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/utils/utils";
import type { UserRole } from "@/utils/helpers/role";
import type { LucideIcon } from "lucide-react";

interface BottomNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  allowedRoles: NonNullable<UserRole>[];
}

const bottomNavItems: BottomNavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Home",
    href: "/dashboard",
    allowedRoles: ["sales_representative", "support_staff", "clinical_provider", "clinical_staff"],
  },
  {
    icon: ShoppingCart,
    label: "Orders",
    href: "/dashboard/orders",
    allowedRoles: ["support_staff", "clinical_provider", "clinical_staff"],
  },
  {
    icon: Building2,
    label: "Accounts",
    href: "/dashboard/accounts",
    allowedRoles: ["sales_representative", "admin", "support_staff"],
  },
  {
    icon: CheckSquare,
    label: "Tasks",
    href: "/dashboard/tasks",
    allowedRoles: ["sales_representative", "admin"],
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/dashboard/settings",
    allowedRoles: ["sales_representative", "support_staff", "clinical_provider", "clinical_staff"],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;

  const visibleItems = bottomNavItems.filter(
    (item) => role && item.allowedRoles.includes(role as NonNullable<UserRole>),
  );

  if (visibleItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-[#E2E8F0] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 md:hidden">
      {visibleItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 transition-colors",
              isActive ? "text-[#15689E] font-medium text-[10px]" : "text-[#94A3B8] text-[10px]",
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
