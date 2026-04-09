"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils/utils";
import { CountBadge } from "./CountBadge";

export function KanbanColumn({
  label,
  count,
  dot,
  labelClassName,
  countVariant = "default",
  children,
  className,
  bodyClassName,
}: {
  label: string;
  count: number;
  dot?: string;
  labelClassName?: string;
  countVariant?: "default" | "overdue" | "muted" | "accent";
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col bg-[var(--bg)] border border-[var(--border)] rounded-xl",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {dot && <div className={cn("w-2 h-2 rounded-full", dot)} />}
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]",
              labelClassName,
            )}
          >
            {label}
          </span>
        </div>
        <CountBadge count={count} variant={countVariant} />
      </div>
      <div className={cn("flex flex-col gap-3 p-3 flex-1 overflow-y-auto", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
