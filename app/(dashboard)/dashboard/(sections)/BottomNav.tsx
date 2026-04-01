"use client";

import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  CheckSquare,
  UserCircle,
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
  allowedRoles: UserRole[];
}

const bottomNavItems: BottomNavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Home",
    href: "/dashboard",
    allowedRoles: ["sales_representative", "doctor"],
  },
  {
    icon: ShoppingCart,
    label: "Orders",
    href: "/dashboard/orders",
    allowedRoles: ["sales_representative", "doctor"],
  },
  {
    icon: Building2,
    label: "Accounts",
    href: "/dashboard/accounts",
    allowedRoles: ["sales_representative", "admin"],
  },
  {
    icon: CheckSquare,
    label: "Tasks",
    href: "/dashboard/tasks",
    allowedRoles: ["sales_representative", "admin"],
  },
  {
    icon: UserCircle,
    label: "Profile",
    href: "/dashboard/profile",
    allowedRoles: ["sales_representative", "doctor"],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;

  const visibleItems = bottomNavItems.filter(
    (item) => role && item.allowedRoles.includes(role),
  );

  if (visibleItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-slate-200 flex items-center md:hidden">
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
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              isActive ? "text-[#15689E]" : "text-slate-400 hover:text-slate-600",
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
