"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[var(--border)] pb-5 mb-6",
        className,
      )}
    >
      <div>
        <h1 className="text-[18px] font-bold text-[var(--navy)]">{title}</h1>
        {subtitle && (
          <p className="mt-[2px] text-[13px] text-[var(--text3)]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
