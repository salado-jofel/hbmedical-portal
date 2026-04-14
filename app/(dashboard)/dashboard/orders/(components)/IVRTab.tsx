"use client";

import type { IOrderIVR, DashboardOrder } from "@/utils/interfaces/orders";
import { IVRFormDocument } from "./IVRFormDocument";
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
  isExtracting = false,
  onDirtyChange,
  onSave,
}: IVRTabProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-3",
        !isActive && "hidden",
      )}
    >
      {!isReady || isExtracting ? (
        <FormSkeleton />
      ) : (
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
    </div>
  );
}
