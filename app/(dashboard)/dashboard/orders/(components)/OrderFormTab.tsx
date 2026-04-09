"use client";

import { CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { IOrderForm } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

export type AiStatus = "idle" | "processing" | "complete" | "error";

interface OrderFormTabProps {
  isActive: boolean;
  aiStatus: AiStatus;
  orderForm: IOrderForm | null;
}

function ExtractionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-4">
        <Loader2 className="w-5 h-5 animate-spin text-[#0d7a6b] shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#0d7a6b]">AI is analyzing your documents...</p>
          <p className="text-xs text-[#0d7a6b]/70">Fields will be auto-filled when complete</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        {[
          { label: "w-28", value: "w-3/4" },
          { label: "w-20", value: "w-1/2" },
          { label: "w-24", value: "w-20" },
          { label: "w-24", value: "w-20" },
          { label: "w-16", value: "w-20" },
          { label: "w-20", value: "w-2/3" },
          { label: "w-28", value: "w-full h-20" },
        ].map((row, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-4 px-4 py-3 border-b border-gray-50 last:border-0",
              i % 2 === 0 ? "bg-white" : "bg-gray-50/40",
            )}
          >
            <Skeleton className={cn("h-3 shrink-0 mt-0.5 bg-[#e2e8f0]", row.label)} />
            <Skeleton className={cn("h-4 bg-[#e2e8f0]", row.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderFormTab({ isActive, aiStatus, orderForm }: OrderFormTabProps) {
  const isLoading =
    aiStatus === "processing" ||
    (aiStatus === "complete" && orderForm === null);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-6 py-6 space-y-4",
        !isActive && "hidden",
      )}
    >
      {/* SKELETON: AI processing or initial data fetch */}
      {isLoading && <ExtractionSkeleton />}

      {/* SUCCESS: show extracted data */}
      {!isLoading && orderForm && (
        <>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700">
                AI extraction complete
              </p>
              <p className="text-xs text-green-500 mt-0.5">
                Review the auto-filled fields below and correct any errors
                before signing.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            {[
              { label: "Chief Complaint", value: orderForm.chiefComplaint },
              { label: "ICD-10 Code", value: orderForm.icd10Code },
              {
                label: "Wound Visit #",
                value:
                  orderForm.woundVisitNumber != null
                    ? `#${orderForm.woundVisitNumber}`
                    : null,
              },
              { label: "Wound Site", value: orderForm.woundSite },
              { label: "Wound Stage", value: orderForm.woundStage },
              {
                label: "Measurements",
                value:
                  orderForm.woundLengthCm != null
                    ? `${orderForm.woundLengthCm}L × ${orderForm.woundWidthCm}W × ${orderForm.woundDepthCm}D cm`
                    : null,
              },
              {
                label: "Vasculitis/Burns",
                value: orderForm.hasVasculitisOrBurns ? "Yes" : "No",
              },
              {
                label: "Home Health",
                value: orderForm.isReceivingHomeHealth ? "Yes" : "No",
              },
              {
                label: "At SNF",
                value: orderForm.isPatientAtSnf ? "Yes" : "No",
              },
              {
                label: "Follow-up",
                value:
                  orderForm.followupDays != null
                    ? `${orderForm.followupDays} days`
                    : null,
              },
              {
                label: "Symptoms",
                value: orderForm.subjectiveSymptoms?.length
                  ? orderForm.subjectiveSymptoms.join(", ")
                  : null,
              },
              { label: "Clinical Notes", value: orderForm.clinicalNotes },
            ]
              .filter((f) => f.value != null && f.value !== "")
              .map((field, i) => (
                <div
                  key={field.label}
                  className={cn(
                    "flex items-start gap-4 px-4 py-3 border-b border-gray-50 last:border-0",
                    i % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                  )}
                >
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 shrink-0 pt-0.5">
                    {field.label}
                  </span>
                  <span className="text-sm text-gray-800 flex-1 leading-relaxed">
                    {field.value}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {/* PENDING: no docs uploaded yet */}
      {!isLoading && !orderForm && aiStatus === "idle" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              AI extraction pending
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Upload patient facesheet or clinical documentation. AI will
              extract data automatically.
            </p>
          </div>
        </div>
      )}

      {/* ERROR: timeout */}
      {!isLoading && aiStatus === "error" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-600">
              AI extraction timed out
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Please fill the form manually or try uploading the document again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
