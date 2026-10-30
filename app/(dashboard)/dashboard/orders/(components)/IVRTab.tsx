"use client";

import { useState } from "react";
import type { IOrderIVR, DashboardOrder } from "@/utils/interfaces/orders";
import { IVRFormDocument } from "./IVRFormDocument";
import { IVRUploadView } from "./IVRUploadView";
import { IvrExternalApprovalBanner } from "./IvrExternalApprovalBanner";
import { cn } from "@/utils/utils";

import {
  IVR_LOCKED_STATUSES,
  isIvrLockedForUser,
} from "@/utils/constants/orders";

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
  /** Admin bypasses the status lock on the IVR form's fields. */
  isAdmin: boolean;
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
 * Lock semantics — status only. There is no signature lock: the
 * physician_signed_at / "Mark IVR Complete" gate was removed on 2026-06-26,
 * and the IVR's submission signature gate on 2026-10-30. Signing an IVR
 * locks nothing and blocks nothing.
 *   - Order statuses from manufacturer_review on lock the IVR, so it cannot
 *     change under the manufacturer once queued (IVR_LOCKED_STATUSES)
 *   - Admin bypasses that lock on the built form's fields and can correct
 *     the IVR at any status (isIvrLockedForUser)
 *   - The upload / mode-switch section stays locked for everyone, admin
 *     included, because switchIvrMode enforces the same statuses on the
 *     server — bypassing it here would offer an action the server refuses
 */
export function IVRTab({
  isActive,
  order,
  canEdit,
  canSign,
  isAdmin,
  currentUserName,
  ivrData,
  resetIvrKey,
  isReady,
  onDirtyChange,
  onSave,
  onUploadDeleted,
  onUploadAdded,
}: IVRTabProps) {
  // Upload + mode switching: status-locked for everyone, admin included,
  // because switchIvrMode enforces the same statuses server-side. Users can
  // freely delete and re-upload IVR files until the order is under review.
  const isLocked = IVR_LOCKED_STATUSES.has(order.order_status);
  // The built form's own fields: admin bypasses the status lock so a wrong
  // MAC/TIN on a submitted order can still be corrected in place.
  const formLocked = isIvrLockedForUser(order.order_status, isAdmin);
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
          {ivrData?.linkedStandaloneIvrId && (
            <IvrExternalApprovalBanner
              standaloneIvrId={ivrData.linkedStandaloneIvrId}
            />
          )}
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

          {/* Built IVR form, editable — no uploaded document, and not locked
              for this user (admin is never locked here). */}
          {!hasUploadedDoc && !formLocked && (
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

          {/* Locked view: keep the form visible read-only so audit/PDF
              preview stays available, but no upload swap is possible. Only
              non-admins reach this branch. */}
          {!hasUploadedDoc && formLocked && (
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
