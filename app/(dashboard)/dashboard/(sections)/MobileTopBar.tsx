"use client";

import { Menu, X } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { toggleSidebar } from "../(redux)/dashboard-slice";

export function MobileTopBar() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm">

      <MeridianLogo variant="light" size="md" />

      <button
        onClick={() => dispatch(toggleSidebar())}
        className="p-2 rounded-lg text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--navy)] transition-colors"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </header>
  );
}
