"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { IOrderForm, DashboardOrder } from "@/utils/interfaces/orders";
import { OrderFormDocument } from "./OrderFormDocument";
import { cn } from "@/utils/utils";

export type AiStatus = "idle" | "processing" | "complete" | "error";

interface OrderFormTabProps {
  isActive: boolean;
  aiStatus: AiStatus;
  orderForm: IOrderForm | null;
  order: DashboardOrder;
  canEdit: boolean;
  canSign: boolean;
  /** Admin bypasses status-based item-edit locks. */
  isAdmin: boolean;
  currentUserName: string | null;
  patientName: string | null;
  patientDob: string | null;
  onSaved?: (updated: IOrderForm) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/* Shown only while AI extraction is actively running (new orders) */
function AiExtractionSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-4">
        <Loader2 className="w-5 h-5 animate-spin text-[#0d7a6b] shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#0d7a6b]">
            AI is analyzing your documents…
          </p>
          <p className="text-xs text-[#0d7a6b]/70">
            Fields will be auto-filled when complete
          </p>
        </div>
      </div>
      {[72, 48, 32, 32, 20, 56, 96].map((h, i) => (
        <Skeleton
          key={i}
          className={cn("w-full bg-[#e2e8f0] rounded")}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

/* Shown while loading existing order data from DB */
function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {[72, 48, 32, 32, 20, 56, 96].map((h, i) => (
        <Skeleton
          key={i}
          className={cn("w-full bg-[#e2e8f0] rounded")}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

export function OrderFormTab({
  isActive,
  aiStatus,
  orderForm,
  order,
  canEdit,
  canSign,
  isAdmin,
  currentUserName,
  patientName,
  patientDob,
  onSaved,
  onDirtyChange,
}: OrderFormTabProps) {
  // New order: AI actively extracting
  if (aiStatus === "processing") {
    return (
      <div className={cn("absolute inset-0 overflow-y-auto px-3", !isActive && "hidden")}>
        <AiExtractionSkeleton />
      </div>
    );
  }

  // Existing order: brief wait while orderForm data arrives from DB
  if (aiStatus === "complete" && orderForm === null) {
    return (
      <div className={cn("absolute inset-0 overflow-y-auto px-3", !isActive && "hidden")}>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0 overflow-y-auto px-3", !isActive && "hidden")}>
      {/* Extraction failures are surfaced by the modal-level banner
          (visible from every tab, with Retry) — no per-tab copy here. */}

      {/* Admin is read-only on the Order Form only (the IVR, HCFA and invoice
          stay editable), so say which door to use instead of leaving a form
          that silently refuses to save. Same shape as Form1500Tab's notice. */}
      {!canEdit && isAdmin && (
        <p className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          The order form is the clinic&apos;s document and is read-only here.
          To get a correction, use Request Info to send the order back to the
          clinic.
        </p>
      )}

      <OrderFormDocument
        orderId={order.id}
        orderForm={orderForm}
        order={order}
        canEdit={canEdit}
        canSign={canSign}
        isAdmin={isAdmin}
        currentUserName={currentUserName}
        aiStatus={aiStatus}
        patientName={patientName}
        patientDob={patientDob}
        onSaved={onSaved}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}
