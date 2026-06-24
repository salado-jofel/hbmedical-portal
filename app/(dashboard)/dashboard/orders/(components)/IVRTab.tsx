"use client";

import { useState, useTransition } from "react";
import type { IOrderIVR, DashboardOrder } from "@/utils/interfaces/orders";
import { IVRFormDocument } from "./IVRFormDocument";
import { IVRUploadView } from "./IVRUploadView";
import { switchIvrMode } from "../(services)/order-ivr-actions";
import { cn } from "@/utils/utils";
import { ClipboardCheck, Upload, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Order statuses past which switching IVR mode is forbidden. Mirrors the
// server-side IVR_MODE_LOCKED_STATUSES in order-ivr-actions.ts. Keep in
// sync if either list is updated.
const IVR_MODE_LOCKED_STATUSES = new Set([
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
  "canceled",
]);

function FormSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-9 bg-gray-100 rounded-xl w-full" />
        </div>
      ))}
      <div className="h-4 bg-gray-200 rounded w-1/4 mt-6" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-9 bg-gray-100 rounded-xl w-full" />
        </div>
      ))}
    </div>
  );
}

interface IVRTabProps {
  isActive: boolean;
  order: DashboardOrder;
  canEdit: boolean;
  canSign: boolean;
  currentUserName: string | null;
  ivrData: Partial<IOrderIVR> | null;
  resetIvrKey: number;
  isReady: boolean;
  isExtracting?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (saved: Partial<IOrderIVR>) => void | Promise<void>;
}

export function IVRTab({
  isActive,
  order,
  canEdit,
  canSign,
  currentUserName,
  ivrData,
  resetIvrKey,
  isReady,
  onDirtyChange,
  onSave,
}: IVRTabProps) {
  const [switching, startSwitching] = useTransition();
  // Local "in flight" mode value during the server round-trip. Lets the
  // toggle visually flip immediately while we wait for revalidation to
  // bring the fresh ivrData prop through.
  const [pendingMode, setPendingMode] = useState<"built" | "uploaded" | null>(null);

  const currentMode: "built" | "uploaded" =
    pendingMode ?? (ivrData?.ivrMode ?? "built");
  // The IVR is "locked" when it's been signed (built path) or marked
  // complete (uploaded path). Both flows stamp physician_signed_at.
  const isLocked = !!ivrData?.physicianSignedAt;
  const isModeLocked =
    isLocked || IVR_MODE_LOCKED_STATUSES.has(order.order_status);

  function handleSwitch(target: "built" | "uploaded") {
    if (target === currentMode) return;
    if (isModeLocked) {
      toast.error(
        "IVR mode can no longer be changed — order has progressed past pending signature.",
      );
      return;
    }
    // Destructive-action confirmation — switching wipes the other mode's
    // data per product spec.
    const message =
      target === "uploaded"
        ? "Switch to Upload mode? Any data filled into the built IVR form will be erased."
        : "Switch back to Build mode? Any uploaded IVR documents will be deleted.";
    if (!window.confirm(message)) return;

    setPendingMode(target);
    startSwitching(async () => {
      const res = await switchIvrMode(order.id, target);
      if (!res.success) {
        toast.error(res.error ?? "Failed to switch IVR mode.");
        setPendingMode(null);
        return;
      }
      toast.success(
        target === "uploaded"
          ? "Switched to Upload mode."
          : "Switched to Build mode.",
      );
      // Trigger a parent reload so ivrData refreshes from the server.
      await onSave({});
      setPendingMode(null);
    });
  }

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-3",
        !isActive && "hidden",
      )}
    >
      {!isReady ? (
        <FormSkeleton />
      ) : (
        <>
          {/* ── Mode picker (hidden once mode is locked by order status) ── */}
          {!isModeLocked && (
            <div className="flex items-center gap-2 px-2 py-3 border-b border-[var(--border)] mb-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                IVR source
              </span>
              <div className="inline-flex rounded-lg border border-[var(--border)] bg-white overflow-hidden">
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch("built")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors",
                    currentMode === "built"
                      ? "bg-[var(--navy)] text-white"
                      : "text-[var(--text2)] hover:bg-[var(--bg)]",
                  )}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Build in portal
                </button>
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch("uploaded")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors border-l border-[var(--border)]",
                    currentMode === "uploaded"
                      ? "bg-[var(--navy)] text-white"
                      : "text-[var(--text2)] hover:bg-[var(--bg)]",
                  )}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload completed document
                </button>
              </div>
              {switching && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text3)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Switching…
                </span>
              )}
            </div>
          )}

          {/* ── Mode body ── */}
          {currentMode === "built" ? (
            <IVRFormDocument
              key={resetIvrKey}
              order={order}
              canEdit={canEdit}
              canSign={canSign}
              currentUserName={currentUserName}
              ivrData={ivrData}
              onDirtyChange={onDirtyChange}
              onSaved={onSave}
            />
          ) : (
            <IVRUploadView
              order={order}
              isLocked={isLocked}
              canEdit={canEdit}
              onChange={() => onSave({})}
            />
          )}
        </>
      )}
    </div>
  );
}
