"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

export default function ConfirmModal({
  open,
  onOpenChange,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isLoading) onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* ── Top accent bar ───────────────────────────────────── */}
        <div className="h-1 w-full bg-linear-to-r from-red-400 via-red-500 to-rose-500" />

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-2 flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
            </div>
            {/* Ping ring */}
            <span className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-30" />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-slate-800">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="mx-6 border-t border-slate-100 mt-4" />

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex gap-3 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl h-11"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl h-11 shadow-sm shadow-red-200"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {confirmLabel}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
