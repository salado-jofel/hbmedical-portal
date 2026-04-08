"use client";

import type { DashboardOrder, IOrderIVR } from "@/utils/interfaces/orders";
import { OrderIVRForm } from "./OrderIVRForm";
import { cn } from "@/utils/utils";

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
  orderId: string;
  canEdit: boolean;
  ivrData: Partial<IOrderIVR> | null;
  hcfaData: Record<string, unknown> | null;
  order: DashboardOrder;
  resetIvrKey: number;
  isReady: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (saved: Partial<IOrderIVR>) => void | Promise<void>;
}

export function IVRTab({
  isActive,
  orderId,
  canEdit,
  ivrData,
  hcfaData,
  order,
  resetIvrKey,
  isReady,
  onDirtyChange,
  onSave,
}: IVRTabProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-6",
        !isActive && "hidden",
      )}
    >
      {!isReady ? (
        <FormSkeleton />
      ) : (
        <OrderIVRForm
          key={resetIvrKey}
          orderId={orderId}
          canEdit={canEdit}
          initialData={ivrData}
          isReady={true}
          order={order}
          hcfaData={hcfaData}
          onDirtyChange={onDirtyChange}
          onSave={onSave}
        />
      )}
    </div>
  );
}
