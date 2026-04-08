"use client";

import { NavItem } from "@/app/(components)/NavItem";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/utils/helpers/role";

export interface NavItemDef {
  icon: LucideIcon;
  label: string;
  href: string;
  visible: (role: UserRole) => boolean;
}

interface SidebarNavItemProps {
  item: NavItemDef;
  pathname: string;
  collapsed: boolean;
}

export function SidebarNavItem({ item, pathname, collapsed }: SidebarNavItemProps) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

  return (
    <NavItem
      icon={item.icon}
      label={item.label}
      href={item.href}
      isActive={isActive}
      collapsed={collapsed}
    />
  );
}
