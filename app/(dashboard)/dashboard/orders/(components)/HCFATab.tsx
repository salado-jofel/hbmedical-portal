"use client";

import { Form1500Tab } from "./Form1500Tab";
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

interface HCFATabProps {
  isActive: boolean;
  orderId: string;
  canEdit: boolean;
  hcfaData: Record<string, unknown> | null;
  resetHcfaKey: number;
  isReady: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (saved: Record<string, unknown>) => void | Promise<void>;
}

export function HCFATab({
  isActive,
  orderId,
  canEdit,
  hcfaData,
  resetHcfaKey,
  isReady,
  onDirtyChange,
  onSave,
}: HCFATabProps) {
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
        <Form1500Tab
          key={resetHcfaKey}
          orderId={orderId}
          canEdit={canEdit}
          initialData={hcfaData}
          isReady={true}
          onDirtyChange={onDirtyChange}
          onSave={onSave}
        />
      )}
    </div>
  );
}
