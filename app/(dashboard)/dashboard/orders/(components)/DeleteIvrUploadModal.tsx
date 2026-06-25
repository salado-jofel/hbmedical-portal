"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { cn } from "@/utils/utils";

interface DeleteIvrUploadModalProps {
  open: boolean;
  fileName: string;
  /** True when this delete will remove the LAST uploaded IVR file — UI
   *  shows an extra note that the built IVR form will reappear. */
  willRevertToBuilt: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for deleting an uploaded IVR file. Matches the
 * design of SwitchIvrModeModal / CapturePatientSignatureModal — same
 * Dialog wrapper, padding rhythm, and footer button layout. The danger
 * action is red because deleting a file from an order is irreversible.
 */
export function DeleteIvrUploadModal({
  open,
  fileName,
  willRevertToBuilt,
  loading,
  onConfirm,
  onCancel,
}: DeleteIvrUploadModalProps) {
  function handleOpenChange(next: boolean) {
    if (loading) return;
    if (!next) onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Delete uploaded IVR file?
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <p className="text-[12px] leading-snug text-red-900">
              <span className="font-semibold">{fileName}</span> will be
              permanently removed from this order.
            </p>
          </div>

          <p className="text-[12.5px] text-[#374151] leading-relaxed">
            {willRevertToBuilt
              ? "This is the last uploaded IVR file. After deletion the in-portal IVR form will reappear so you can build the IVR manually instead."
              : "Other uploaded IVR files will stay on this order."}
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
              "bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
              "flex items-center gap-1.5",
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
