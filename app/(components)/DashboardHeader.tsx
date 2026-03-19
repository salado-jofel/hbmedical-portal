"use client";

import { ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  showGreeting?: boolean;
  actions?: ReactNode;
}

export function DashboardHeader({
  title,
  description,
  showGreeting = false,
  actions,
}: DashboardHeaderProps) {
  const userData = useAppSelector((state) => state.dashboard);

  return (
    <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
            {title}
          </h1>
          {showGreeting && userData.name && (
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Welcome back,{" "}
              <span className="font-semibold text-slate-600">
                {userData.name}
              </span>
              ! Here&apos;s your sales overview.
            </p>
          )}
          {description && !showGreeting && (
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
