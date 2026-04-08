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
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0]",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[#64748B] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
