"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/utils/utils";

interface SwitchIvrModeModalProps {
  open: boolean;
  /** The mode the user is switching INTO. */
  targetMode: "built" | "uploaded";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for switching between Build / Upload IVR modes.
 * Switching is destructive — the opposite mode's data is wiped server-side
 * — so the user gets an explicit warning and an explicit Confirm action.
 *
 * Design matches CapturePatientSignatureModal (same Dialog wrapper, same
 * padding rhythm, same footer button layout).
 */
export function SwitchIvrModeModal({
  open,
  targetMode,
  loading,
  onConfirm,
  onCancel,
}: SwitchIvrModeModalProps) {
  const isToUpload = targetMode === "uploaded";
  const title = isToUpload
    ? "Switch to Upload mode?"
    : "Switch back to Build mode?";
  const consequence = isToUpload
    ? "Any data already filled into the in-portal IVR form will be permanently erased."
    : "Any IVR documents you uploaded will be permanently deleted from this order.";

  function handleOpenChange(next: boolean) {
    if (loading) return;
    if (!next) onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
            <p className="text-[12px] leading-snug text-amber-900">
              <span className="font-semibold">Heads up:</span> {consequence}
            </p>
          </div>

          <p className="text-[12.5px] text-[#374151] leading-relaxed">
            {isToUpload
              ? "You'll upload a completed external IVR document instead of filling in the in-portal form. Once you mark the upload complete, the IVR will be locked the same way as a signed built form."
              : "You'll return to the in-portal IVR form. You can then fill in fields manually and sign as usual."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-[12.5px] font-medium border border-[#d1d5db] bg-white text-[#374151]",
              "hover:bg-[#f3f4f6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-[12.5px] font-medium text-white",
              "bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
              "flex items-center gap-1.5",
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading
              ? "Switching…"
              : isToUpload
                ? "Switch to Upload"
                : "Switch to Build"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
