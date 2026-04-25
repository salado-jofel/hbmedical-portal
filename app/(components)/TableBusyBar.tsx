"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/utils";

interface TableBusyBarProps {
  busy: boolean;
  /** Optional label override. Default: "Updating…" */
  label?: string;
  className?: string;
}

/**
 * Visible busy indicator for paginated tables — sits at the top of the table
 * card and shows a thin animated progress bar plus a "Updating…" label so
 * filter / sort / pagination clicks have immediate feedback even if the
 * underlying fetch (or re-render) settles fast enough that the user might
 * not otherwise notice.
 *
 * Renders nothing (and takes no layout space) when `busy` is false — the
 * only visible footprint while idle is a hairline divider underneath the
 * table header, which the calling card already provides.
 */
export function TableBusyBar({ busy, label = "Updating…", className }: TableBusyBarProps) {
  if (!busy) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 border-b border-[var(--border)] bg-[var(--navy)]/[.04] px-4 py-1.5 text-[11px] font-medium text-[var(--navy)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--navy)] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--navy)]" />
      </span>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
