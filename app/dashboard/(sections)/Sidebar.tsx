"use client";

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  UserCircle,
  Megaphone,
  ScrollText,
  BookOpen,
  LogOut,
  Hospital,
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

const navItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    doctorHidden: false,
  },
  {
    icon: ShoppingCart,
    label: "Orders",
    href: "/dashboard/orders",
    doctorHidden: false,
  },
  {
    icon: Package,
    label: "Products",
    href: "/dashboard/products",
    doctorHidden: false,
  },
  {
    icon: UserCircle,
    label: "Profile",
    href: "/dashboard/profile",
    doctorHidden: false,
  },
  {
    icon: Megaphone,
    label: "Marketing",
    href: "/dashboard/marketing",
    doctorHidden: true,
  },
  {
    icon: ScrollText,
    label: "Contracts",
    href: "/dashboard/contracts",
    doctorHidden: false,
  },
  {
    icon: BookOpen,
    label: "Trainings",
    href: "/dashboard/trainings",
    doctorHidden: true,
  },
  {
    icon: Hospital,
    label: "Hospital Onboarding",
    href: "/dashboard/hospital-onboarding",
    doctorHidden: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);
  const userData = useAppSelector((state) => state.dashboard);
  const isDoctor = userData.role === "doctor";

  useEffect(() => {
    dispatch(closeSidebar());
  }, [pathname]);

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
        {/* ── Logo (desktop only) ── */}
        <div className="hidden md:flex p-6 pb-4 flex-col items-center border-b border-white/8">
          <HBLogo variant="dark" size="md" />
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-4">
          {navItems
            .filter((item) => !(isDoctor && item.doctorHidden))
            .map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={pathname === item.href}
              />
            ))}
        </nav>

        {/* ── Footer — user card + logout ── */}
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
