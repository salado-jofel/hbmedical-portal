"use client";

import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Save } from "lucide-react";

export function FormActionBar({
  label,
  isDirty,
  isPending,
  onSave,
  onDiscard,
}: {
  label: string;
  isDirty: boolean;
  isPending: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className={cn(
        // Sticky so Save / Discard stays reachable as the form scrolls.
        // The nearest overflow-y-auto ancestor (the tab container in each
        // of Order Form / IVR / HCFA / Invoice) acts as the scroll root.
        "sticky top-0 z-20 -mx-3 px-3 flex items-center justify-between py-2 mb-3 bg-white transition-shadow",
        isDirty
          ? "shadow-[0_1px_0_0_var(--border),0_2px_6px_rgba(15,45,74,0.06)]"
          : "border-b border-[var(--border)]/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{label}</span>
        {isDirty && (
          <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
        )}
      </div>
      {isDirty && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={isPending}
            className="h-8 text-xs gap-1.5 border-[var(--border)]"
          >
            <RotateCcw className="w-3 h-3" />
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isPending}
            className="h-8 text-xs gap-1.5 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
