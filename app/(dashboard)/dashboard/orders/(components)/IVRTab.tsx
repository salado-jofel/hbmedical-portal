"use client";

import { useState } from "react";
import type { IOrderIVR, DashboardOrder } from "@/utils/interfaces/orders";
import { IVRFormDocument } from "./IVRFormDocument";
import { IVRUploadView } from "./IVRUploadView";
import { cn } from "@/utils/utils";

// Order statuses past which the IVR (built form OR uploaded file) is
// locked from edits. Mirrors the server-side IVR_MODE_LOCKED_STATUSES in
// order-ivr-actions.ts — keep in sync.
const IVR_MODE_LOCKED_STATUSES = new Set<string>([
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
  /** Forwarded to IVRUploadView so the parent can sync localDocuments. */
  onUploadDeleted?: (docId: string) => void;
  onUploadAdded?: (doc: {
    id: string;
    documentType: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
    fileSize: number;
  }) => void;
}

/**
 * IVR tab — supports two paths the user can switch between freely:
 *
 *   1. BUILT — fill the in-portal IVR form (existing IVRFormDocument)
 *   2. UPLOADED — attach a completed external IVR document
 *
 * There is no explicit mode toggle. The UPLOAD section sits at the top
 * and is always visible (until the order is locked). The IVR form sits
 * below and is visible only when no document has been uploaded.
 *
 * Switching paths is implicit:
 *   - First upload after the form had data → wipe prompt → wipe + flip mode
 *   - Last upload deleted → silently flip mode back to "built", empty form
 *     reappears (built data was already wiped during the upload step)
 *
 * Lock semantics:
 *   - physician_signed_at being non-null = IVR locked (works for both
 *     paths: clinician signs the built form, OR clicks "Mark Complete"
 *     on the uploaded path)
 *   - Once locked, neither path can be edited
 *   - Order statuses past pending_signature also lock everything
 */
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
  onUploadDeleted,
  onUploadAdded,
}: IVRTabProps) {
  // Per Dr. Ben (2026-06-26): locking is purely status-based — once the
  // order has moved past pending_signature, neither the built form nor
  // the uploaded IVR can be edited. The old physician_signed_at /
  // "Mark IVR Complete" gate is removed; users can freely delete and
  // re-upload IVR files until the order is under manufacturer review.
  const isLocked = IVR_MODE_LOCKED_STATUSES.has(order.order_status);
  // True once any IVR document is attached (set by IVRUploadView via the
  // onDocCountChange callback). Drives whether to show the built form
  // below the upload section.
  const [hasUploadedDoc, setHasUploadedDoc] = useState<boolean>(
    (ivrData?.ivrMode ?? "built") === "uploaded",
  );

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
          {/* Upload section — always at the top. Hidden once the IVR is
              fully locked (signed or marked complete) since no further
              changes are allowed. */}
          <IVRUploadView
            order={order}
            isLocked={isLocked}
            canEdit={canEdit}
            ivrData={ivrData}
            onChange={() => onSave({})}
            onDocCountChange={(count) => setHasUploadedDoc(count > 0)}
            onUploadDeleted={onUploadDeleted}
            onUploadAdded={onUploadAdded}
          />

          {/* Built IVR form — visible only when there is no uploaded
              document AND the order isn't sign-locked. */}
          {!hasUploadedDoc && !isLocked && (
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
          )}

          {/* Signed-built-form view: keep the form visible read-only so
              audit/PDF preview stays available, but no upload swap is
              possible (locked = locked). */}
          {!hasUploadedDoc && isLocked && (
            <IVRFormDocument
              key={resetIvrKey}
              order={order}
              canEdit={false}
              canSign={false}
              currentUserName={currentUserName}
              ivrData={ivrData}
              onDirtyChange={onDirtyChange}
              onSaved={onSave}
            />
          )}
        </>
      )}
    </div>
  );
}
