"use client";

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderOpen,
  LogOut,
  Building2,
  CheckSquare,
  Share2,
  Settings,
  Users,
  ChevronLeft,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { SidebarNavItem, type NavItemDef } from "../(components)/SidebarNavItem";
import { SidebarUserCard } from "@/app/(components)/SidebarUserCard";
import { NotificationBell } from "@/app/(dashboard)/(components)/NotificationBell";
import { HBLogo } from "@/app/(components)/HBLogo";
import SubmitButton from "@/app/(components)/SubmitButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { signOut } from "../(services)/actions";
import { closeSidebar } from "../(redux)/dashboard-slice";
import { cn } from "@/utils/utils";
import type { UserRole } from "@/utils/helpers/role";
import {
  isAdmin,
  isSalesRep,
  isSupport,
  isClinicalProvider,
  isClinicalStaff,
} from "@/utils/helpers/role";

const STORAGE_KEY = "hb-sidebar-collapsed";

export interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    label: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/dashboard",
        visible: (role) => !!role,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        icon: Package,
        label: "Products",
        href: "/dashboard/products",
        visible: isAdmin,
      },
      {
        icon: FolderOpen,
        label: "Resources",
        href: "/dashboard/resources",
        visible: (role) => isAdmin(role) || isSalesRep(role),
      },
    ],
  },
  {
    label: "Clinic",
    items: [
      {
        icon: ShoppingCart,
        label: "Orders",
        href: "/dashboard/orders",
        visible: (role) => isClinicalProvider(role) || isClinicalStaff(role),
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        icon: Building2,
        label: "Accounts",
        href: "/dashboard/accounts",
        visible: (role) => isAdmin(role) || isSalesRep(role) || isSupport(role),
      },
      // Same page, different label per role: reps manage their sub-reps ("My Team"),
      // admins manage every sales rep system-wide ("Sales Reps").
      {
        icon: Users,
        label: "Sales Reps",
        href: "/dashboard/my-team",
        visible: isAdmin,
      },
      {
        icon: Users,
        label: "My Team",
        href: "/dashboard/my-team",
        visible: isSalesRep,
      },
      {
        icon: CheckSquare,
        label: "Tasks",
        href: "/dashboard/tasks",
        visible: (role) => isAdmin(role) || isSalesRep(role),
      },
      {
        icon: Share2,
        label: "Onboarding",
        href: "/dashboard/onboarding",
        visible: (role) =>
          isSalesRep(role) || isAdmin(role) || isClinicalProvider(role),
      },
      {
        icon: Users,
        label: "Users",
        href: "/dashboard/users",
        visible: isAdmin,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        icon: DollarSign,
        label: "Commissions",
        href: "/dashboard/commissions",
        visible: (role) => isSalesRep(role),
      },
      // Admin sees system-wide analytics ("Reports"), reps see their own ("My Performance").
      {
        icon: TrendingUp,
        label: "Reports",
        href: "/dashboard/rep-performance",
        visible: isAdmin,
      },
      {
        icon: TrendingUp,
        label: "My Performance",
        href: "/dashboard/rep-performance",
        visible: isSalesRep,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        icon: Settings,
        label: "Settings",
        href: "/dashboard/settings",
        visible: (role) => !!role,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);
  const userData = useAppSelector((state) => state.dashboard);

  const role = userData.role as UserRole;
  const isSubRep = userData.isSubRep ?? false;

  const [collapsed, setCollapsed] = useState(false);

  // Restore collapse preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    dispatch(closeSidebar());
  }, [pathname, dispatch]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  // Filter groups — only show a group if at least one item is visible for this role
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => role && item.visible(role)),
  })).filter((group) => group.items.length > 0);

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Mobile overlay ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 md:hidden top-16 transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={() => dispatch(closeSidebar())}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          // Layout
          "flex flex-col select-none shrink-0",
          // Mobile: fixed overlay; Desktop: sticky in flex flow
          "fixed z-50 md:sticky md:top-0",
          "top-16 h-[calc(100%-4rem)] md:h-screen",
          // Width — drives layout on desktop via sticky
          collapsed ? "w-[60px]" : "w-[220px]",
          // Smooth width + slide
          "transition-[width,transform] duration-200 ease-in-out",
          // Visual
          "bg-white border-r border-[#E8EFF5]",
          // Mobile slide
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* ── Logo header — desktop only ── */}
        <div
          className={cn(
            "hidden md:flex items-center border-b border-[#E8EFF5] relative min-h-[62px]",
            collapsed ? "justify-center" : "px-4",
          )}
        >
          {/*
            Single HBLogo — text span hidden via CSS selector when collapsed.
            HBLogo renders: <span.flex.gap-2.5> <svg/> <span>HB Medical</span> </span>
            [&>span>span:last-child]:hidden targets that inner text span.
          */}
          <div className={cn(collapsed && "[&>span>span:last-child]:hidden")}>
            <HBLogo
              variant="light"
              size={collapsed ? "sm" : "md"}
              asLink={false}
            />
          </div>

          {/* Collapse toggle button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "absolute -right-3 top-1/2 -translate-y-1/2 z-10",
              "w-6 h-6 rounded-full bg-white border border-[#E8EFF5] shadow-sm",
              "flex items-center justify-center",
              "text-[var(--text3)] hover:text-[var(--navy)] hover:border-[#c7dff0]",
              "transition-colors duration-150",
            )}
          >
            <ChevronLeft
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* ── Nav with categories ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {/* ── Notifications — always first ── */}
          <div className={cn(
            "mb-2 pb-2 border-b border-[#E8EFF5]",
            collapsed ? "px-[10px]" : "px-2",
          )}>
            <NotificationBell
              currentUserId={userData.userId ?? ""}
              collapsed={collapsed}
            />
          </div>

          {visibleGroups.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && "mt-4")}>
              {/* Category label — hidden when collapsed */}
              {!collapsed && (
                <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text3)] select-none">
                  {group.label}
                </p>
              )}

              {/* Separator line when collapsed (replaces label) */}
              {collapsed && gi > 0 && (
                <div className="mx-3 mb-2 border-t border-[#E8EFF5]" />
              )}

              <div className={cn("space-y-0.5", collapsed ? "px-[10px]" : "px-2")}>
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="flex flex-col">
          {(() => {
            const isPendingSetup = userData.name === "Pending Setup" || !userData.name;
            const displayName = isPendingSetup ? userData.email ?? "—" : userData.name;
            const displayInitials = isPendingSetup
              ? (userData.email?.[0] ?? "U").toUpperCase()
              : userData.initials;
            return (
              <SidebarUserCard
                name={displayName}
                email={userData.email}
                initials={displayInitials}
                role={userData.role}
                isSubRep={isSubRep}
                collapsed={collapsed}
              />
            );
          })()}

          <div className={cn("pb-3", collapsed ? "px-[10px]" : "px-2")}>
            <SubmitButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              classname={cn(
                "flex items-center gap-2 w-full rounded-lg transition-colors duration-150",
                "text-[var(--text3)] hover:text-red-500 hover:bg-red-50/60",
                collapsed
                  ? "justify-center px-0 py-2 w-10 mx-auto"
                  : "px-3 py-2",
              )}
              cta={
                <>
                  <LogOut className="w-[15px] h-[15px] shrink-0" strokeWidth={1.8} />
                  {!collapsed && (
                    <span className="text-sm font-medium">Logout</span>
                  )}
                </>
              }
            />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
