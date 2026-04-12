"use client";

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
    <div className="flex items-center justify-between mb-3">
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
