"use client";

import { ReactNode, useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showGreetingText = mounted && showGreeting && !!userData.name;

  return (
    <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-[var(--border)]">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-[13px] font-semibold text-[var(--navy)] leading-tight">
            {title}
          </h1>

          {showGreeting ? (
            <p
              className="text-[11px] text-[var(--text3)] mt-0.5 min-h-[18px]"
              suppressHydrationWarning
            >
              {showGreetingText ? (
                <>
                  Welcome back,{" "}
                  <span className="font-semibold text-[var(--navy)]">
                    {userData.name}
                  </span>
                  ! Here&apos;s your sales overview.
                </>
              ) : (
                "\u00A0"
              )}
            </p>
          ) : description ? (
            <p className="text-[11px] text-[var(--text3)] mt-0.5">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
