"use client";

/**
 * Shared collaboration UI for the four order forms — presence chips above
 * the form, plus a conflict banner when the user has unsaved edits and
 * someone else just saved.
 *
 * Designed to slot in between the FormActionBar and the FormDeficiencyBanner
 * so all four form components have the same vertical rhythm.
 */

import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import type { FormViewer } from "./useFormCollaboration";

interface FormCollaborationStatusProps {
  viewers: FormViewer[];
  /** True when the hook saw a remote update AND the user has unsaved edits.
   *  Caller decides — this component just renders. */
  conflict: boolean;
  /** Whether the Reload button is currently spinning. Flip to true while
   *  awaiting the reload server roundtrip. */
  reloading: boolean;
  onReload: () => void;
}

export function FormCollaborationStatus({
  viewers,
  conflict,
  reloading,
  onReload,
}: FormCollaborationStatusProps) {
  // Filter to "other" viewers and dedupe by name — two tabs from the same
  // user collapse to one chip.
  const others = viewers
    .filter((v) => !v.isSelf)
    .filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i);

  if (others.length === 0 && !conflict) return null;

  return (
    <div className="mx-auto  pt-3 pb-2 space-y-2.5" style={{ maxWidth: 1400 }}>
      {others.length > 0 && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[var(--text3)] font-medium">
            Currently viewing
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {others.map((v) => (
              <span
                key={v.sessionId}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue-lt)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--blue)]"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--blue)]"
                  aria-hidden
                />
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {conflict && (
        <div className="flex items-center gap-3 rounded-[var(--r)] border border-amber-200 bg-amber-50 px-2 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-[12px] text-amber-900 leading-snug">
            <span className="font-semibold">Someone else saved this form.</span>{" "}
            <span className="text-amber-800">
              Your unsaved changes will be replaced if you reload.
            </span>
          </p>
          <button
            type="button"
            onClick={onReload}
            disabled={reloading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {reloading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Reloading…
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Reload
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
