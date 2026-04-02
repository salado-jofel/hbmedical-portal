"use client";

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Megaphone,
  ScrollText,
  BookOpen,
  LogOut,
  Hospital,
  Building2,
  CheckSquare,
  Share2,
  Settings,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { NavItem } from "@/app/(components)/NavItem";
import { SidebarUserCard } from "@/app/(components)/SidebarUserCard";
import { HBLogo } from "@/app/(components)/HBLogo";
import SubmitButton from "@/app/(components)/SubmitButton";
import { signOut } from "../(services)/actions";
import { closeSidebar } from "../(redux)/dashboard-slice";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/utils/helpers/role";

interface NavItemDef {
  icon: LucideIcon;
  label: string;
  href: string;
  allowedRoles: NonNullable<UserRole>[];
}

const navItems: NavItemDef[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    allowedRoles: ["sales_representative", "support_staff", "clinical_provider", "clinical_staff", "admin"],
  },
  {
    icon: Package,
    label: "Products",
    href: "/dashboard/products",
    allowedRoles: ["admin"],
  },
  {
    icon: Megaphone,
    label: "Marketing",
    href: "/dashboard/marketing",
    allowedRoles: ["admin"],
  },
  {
    icon: ScrollText,
    label: "Contracts",
    href: "/dashboard/contracts",
    allowedRoles: ["admin"],
  },
  {
    icon: BookOpen,
    label: "Trainings",
    href: "/dashboard/trainings",
    allowedRoles: ["admin"],
  },
  {
    icon: Hospital,
    label: "Hospital Onboarding",
    href: "/dashboard/hospital-onboarding",
    allowedRoles: ["admin"],
  },
  {
    icon: Building2,
    label: "Accounts",
    href: "/dashboard/accounts",
    allowedRoles: ["admin", "sales_representative", "support_staff"],
  },
  {
    icon: ShoppingCart,
    label: "Orders",
    href: "/dashboard/orders",
    allowedRoles: ["support_staff", "clinical_provider", "clinical_staff"],
  },
  {
    icon: CheckSquare,
    label: "Tasks",
    href: "/dashboard/tasks",
    allowedRoles: ["admin", "sales_representative"],
  },
  {
    icon: Share2,
    label: "Onboarding",
    href: "/dashboard/onboarding",
    allowedRoles: ["sales_representative"],
  },
  {
    icon: Users,
    label: "Users",
    href: "/dashboard/users",
    allowedRoles: ["admin"],
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/dashboard/settings",
    allowedRoles: ["admin", "sales_representative", "support_staff", "clinical_provider", "clinical_staff"],
  },
];

function isNavItemVisible(item: NavItemDef, role: UserRole | null): boolean {
  if (!role) return false;
  return item.allowedRoles.includes(role as NonNullable<UserRole>);
}

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);
  const userData = useAppSelector((state) => state.dashboard);

  const role = userData.role as UserRole;

  useEffect(() => {
    dispatch(closeSidebar());
  }, [pathname, dispatch]);

  return (
    <>
      {/* ── Mobile overlay ── */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-40 md:hidden top-16
          transition-opacity duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => dispatch(closeSidebar())}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        className={`
          w-64 flex flex-col select-none
          fixed z-50
          top-16 h-[calc(100%-4rem)]
          md:top-0 md:h-full
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "linear-gradient(180deg, #0d4a72 0%, #082d47 100%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* ── Logo ── */}
        <div className="hidden md:flex p-6 pb-4 flex-col items-center border-b border-white/8">
          <HBLogo variant="dark" size="md" />
        </div>

        {/* ── Filtered Nav items ── */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-4">
          {navItems
            .filter((item) => isNavItemVisible(item, role))
            .map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href + "/"))
                }
              />
            ))}
        </nav>

        {/* ── Footer ── */}
        <div
          className="p-4 border-t border-white/8"
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          <SidebarUserCard
            name={userData.name}
            email={userData.email}
            initials={userData.initials}
            role={userData.role}
          />

          <SubmitButton
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => signOut()}
            classname="mt-3 flex items-center gap-2 w-full transition-colors text-white/70 hover:text-white hover:bg-red-500/20 rounded-lg px-3 py-2"
            cta={
              <>
                <LogOut className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium">Logout</span>
              </>
            }
          />
        </div>
      </aside>
    </>
  );
}
