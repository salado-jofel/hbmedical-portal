"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/utils/utils";
import type { UserRole } from "@/utils/helpers/role";
import { isSalesRep } from "@/utils/helpers/role";
import { NAV_GROUPS } from "./Sidebar";

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function TabNav() {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.dashboard.role) as UserRole;

  // Flatten all groups → visible items for this role (Settings/Profile live in avatar dropdown)
  const visibleItems = NAV_GROUPS.flatMap((group) =>
    group.items.filter((item) => role && item.visible(role)),
  ).filter(
    (item) =>
      item.href !== "/dashboard/settings" &&
      item.href !== "/dashboard/tasks" &&
      item.href !== "/dashboard/onboarding",
  );

  if (visibleItems.length === 0) return null;

  return (
    <div
      className="mb-5 flex gap-[3px] overflow-x-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1"
      style={{ scrollbarWidth: "none" }}
    >
      {visibleItems.map((item) => {
        const active = isActive(item.href, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-[7px] text-[12px] font-medium transition-all duration-150",
              "min-w-[80px] text-center",
              active
                ? "bg-[var(--navy)] text-white"
                : "text-[var(--text2)] hover:bg-[var(--bg)]",
            )}
          >
            <Icon className="h-[13px] w-[13px] shrink-0" strokeWidth={1.8} />
            <span>
              {item.href === "/dashboard/rep-performance"
                ? isSalesRep(role) ? "My Performance" : "Rep Performance"
                : item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
