"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/utils/utils";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" renders a red confirm button; "default" renders navy. */
  tone?: "default" | "destructive";
  /** Disables both buttons + swaps the confirm icon for a spinner. */
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * Shared confirmation modal used in place of window.confirm anywhere in
 * the portal (per feedback 2026-07-07: never native browser dialogs).
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(false);
 *   <Button onClick={() => setConfirm(true)}>Delete</Button>
 *   <ConfirmModal
 *     open={confirm}
 *     onOpenChange={setConfirm}
 *     title="Delete this IVR?"
 *     body="Uploaded files will be removed."
 *     tone="destructive"
 *     confirmLabel="Delete IVR"
 *     onConfirm={() => { setConfirm(false); doDelete(); }}
 *   />
 */
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  pending = false,
  onConfirm,
}: ConfirmModalProps) {
  const Icon = tone === "destructive" ? AlertTriangle : HelpCircle;
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Icon
              className={cn(
                "w-4 h-4",
                tone === "destructive" ? "text-red-500" : "text-[var(--navy)]",
              )}
            />
            {title}
          </DialogTitle>
        </DialogHeader>
        {body && (
          <div className="px-5 py-4 text-[13px] text-[var(--text2)] leading-relaxed">
            {body}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "gap-1.5",
              tone === "destructive" && "bg-red-600 hover:bg-red-700",
            )}
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
