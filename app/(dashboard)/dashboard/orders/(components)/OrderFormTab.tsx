"use client";

import { AlertCircle, Clock, Loader2 } from "lucide-react";
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
  patientName: string | null;
  onSaved?: (updated: IOrderForm) => void;
}

function ExtractionSkeleton() {
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

export function OrderFormTab({
  isActive,
  aiStatus,
  orderForm,
  order,
  canEdit,
  patientName,
  onSaved,
}: OrderFormTabProps) {
  const isLoading =
    aiStatus === "processing" ||
    (aiStatus === "complete" && orderForm === null);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-3",
        !isActive && "hidden",
      )}
    >
      {/* Skeleton while AI is running */}
      {isLoading && <ExtractionSkeleton />}

      {/* Document form when data is available (or no extraction yet, for manual entry) */}
      {!isLoading && (aiStatus === "complete" || aiStatus === "idle") && (
        <OrderFormDocument
          orderId={order.id}
          orderForm={orderForm}
          order={order}
          canEdit={canEdit}
          aiStatus={aiStatus}
          patientName={patientName}
          onSaved={onSaved}
        />
      )}

      {/* Error state */}
      {!isLoading && aiStatus === "error" && (
        <>
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
          <OrderFormDocument
            orderId={order.id}
            orderForm={orderForm}
            order={order}
            canEdit={canEdit}
            aiStatus={aiStatus}
            patientName={patientName}
            onSaved={onSaved}
          />
        </>
      )}
    </div>
  );
}
