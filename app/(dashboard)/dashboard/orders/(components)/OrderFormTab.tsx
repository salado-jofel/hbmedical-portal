"use client";

import { AlertCircle, Loader2 } from "lucide-react";
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
  currentUserName: string | null;
  patientName: string | null;
  onSaved?: (updated: IOrderForm) => void;
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
  currentUserName,
  patientName,
  onSaved,
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
      {aiStatus === "error" && (
        <div className="flex items-center gap-3 m-4 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-600">
              AI extraction timed out
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Fill the form manually or re-upload the document to try again.
            </p>
          </div>
        </div>
      )}
      <OrderFormDocument
        orderId={order.id}
        orderForm={orderForm}
        order={order}
        canEdit={canEdit}
        canSign={canSign}
        currentUserName={currentUserName}
        aiStatus={aiStatus}
        patientName={patientName}
        onSaved={onSaved}
      />
    </div>
  );
}
