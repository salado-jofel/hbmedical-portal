"use client";

import { Menu, X } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { HBMedicalBrand } from "@/app/(components)/HBMedicalBrand";
import { toggleSidebar } from "../(redux)/dashboard-slice";

export function MobileTopBar() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 shadow-sm">
      <HBMedicalBrand layout="row" iconSize="w-7 h-7" textSize="text-sm" />

      <button
        onClick={() => dispatch(toggleSidebar())}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </header>
  );
}
