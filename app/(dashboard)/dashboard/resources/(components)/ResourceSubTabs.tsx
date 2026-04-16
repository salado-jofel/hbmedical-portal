"use client";

import { cn } from "@/utils/utils";

const TABS = ["All", "Marketing", "Contracts", "Training", "Onboarding"] as const;

export function ResourceSubTabs({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div
      className="flex gap-6 overflow-x-auto border-b border-slate-200"
      style={{ scrollbarWidth: "none" }}
    >
      {TABS.map((tab) => {
        const count = tab === "All"
          ? Object.values(counts).reduce((s, n) => s + n, 0)
          : counts[tab] ?? 0;
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap px-1 py-2.5 text-[13px] transition-colors border-b-2 -mb-px",
              active
                ? "font-semibold text-[var(--navy)] border-[var(--navy)]"
                : "font-medium text-[var(--text3)] border-transparent hover:text-[var(--navy)]",
            )}
          >
            <span>{tab}</span>
            {count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-[1.6]",
                  active
                    ? "bg-[var(--navy)] text-white"
                    : "bg-slate-100 text-[var(--text3)]",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
