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
      className="flex gap-[3px] overflow-x-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1"
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
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-[7px] text-[12px] font-medium transition-all duration-150 min-w-[80px]",
              active
                ? "bg-[var(--navy)] text-white"
                : "text-[var(--text2)] hover:bg-[var(--bg)]",
            )}
          >
            <span>{tab}</span>
            {count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-none",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--bg)] text-[var(--text3)]",
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
