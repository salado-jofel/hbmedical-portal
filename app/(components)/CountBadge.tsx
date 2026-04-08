"use client";

import { cn } from "@/utils/utils";

export function CountBadge({
  count,
  variant = "default",
  className,
}: {
  count: number;
  variant?: "default" | "overdue" | "muted" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-5 h-5 inline-flex items-center justify-center rounded-full text-xs font-bold px-1.5",
        variant === "default" && "bg-[#15689E] text-white",
        variant === "overdue" && "bg-red-50 text-red-600 border border-red-200",
        variant === "muted" && "bg-[#F1F5F9] text-[#64748B]",
        variant === "accent" && "bg-blue-50 text-blue-700",
        className,
      )}
    >
      {count}
    </span>
  );
}
