"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { upsertOrderIVR } from "../(services)/actions";
import type { IOrderIVR } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface OrderIVRFormProps {
  orderId: string;
  canEdit: boolean;
  initialData: Partial<IOrderIVR> | null;
  isReady: boolean;
  onSave?: (data: Partial<IOrderIVR>) => void;
}

type IVRFieldKey = keyof Omit<
  IOrderIVR,
  "id" | "orderId" | "aiExtracted" | "createdAt" | "updatedAt"
>;

export function OrderIVRForm({
  orderId,
  canEdit,
  initialData,
  isReady,
  onSave,
}: OrderIVRFormProps) {
  const [savedData, setSavedData] = useState<Partial<IOrderIVR> | null>(
    initialData ?? null,
  );
  const [draftData, setDraftData] = useState<Partial<IOrderIVR> | null>(
    initialData ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync when initialData changes (modal reopened for different order)
  useEffect(() => {
    setSavedData(initialData ?? {});
    setDraftData(initialData ?? {});
  }, [initialData]);

  const isDirty = JSON.stringify(draftData) !== JSON.stringify(savedData);

  function handleChange(
    field: IVRFieldKey,
    value: string | number | boolean | null,
  ) {
    setDraftData((prev) => ({ ...(prev ?? {}), [field]: value }));
  }

  function handleDiscard() {
    setDraftData(savedData);
  }

  async function handleSave() {
    if (!draftData) return;
    setIsSaving(true);
    try {
      const result = await upsertOrderIVR(
        orderId,
        draftData as Partial<IOrderIVR>,
      );
      if (result.success) {
        setSavedData(draftData);
        onSave?.(draftData as Partial<IOrderIVR>);
        toast.success("IVR form saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  }

  /* ── Field helpers — all read from draftData ── */

  function textInput(field: IVRFieldKey, placeholder?: string) {
    return (
      <Input
        value={(draftData?.[field] as string) ?? ""}
        placeholder={placeholder}
        disabled={!canEdit}
        className="text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function numberInput(field: IVRFieldKey, prefix?: string) {
    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={(draftData?.[field] as number) ?? ""}
          disabled={!canEdit}
          className={cn("text-sm", prefix ? "pl-7" : "")}
          onChange={(e) =>
            handleChange(field, e.target.value ? Number(e.target.value) : null)
          }
        />
      </div>
    );
  }

  function dateInput(field: IVRFieldKey) {
    return (
      <Input
        type="date"
        value={(draftData?.[field] as string) ?? ""}
        disabled={!canEdit}
        className="text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function yesNoRadio(field: IVRFieldKey) {
    const val = draftData?.[field] as boolean | undefined;
    return (
      <div className="flex gap-3">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={!canEdit}
            onClick={() => handleChange(field, v)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-all",
              val === v
                ? "border-[#15689E] bg-blue-50 text-[#15689E]"
                : "border-slate-200 text-slate-500 hover:border-slate-300",
              !canEdit && "opacity-60 cursor-not-allowed",
            )}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  function selectInput(
    field: IVRFieldKey,
    options: { value: string; label: string }[],
  ) {
    return (
      <select
        value={(draftData?.[field] as string) ?? ""}
        disabled={!canEdit}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] bg-white disabled:opacity-60"
        onChange={(e) => handleChange(field, e.target.value || null)}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (!isReady) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-10  bg-white border-b border-gray-300 py-3 flex items-center justify-between ">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          IVR Form
          {isDirty && (
            <span className="ml-2 text-amber-500 normal-case font-normal tracking-normal">
              • Unsaved changes
            </span>
          )}
        </h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg",
                "border border-gray-200 text-gray-500",
                "hover:bg-gray-50 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-lg",
                "bg-[#15689E] text-white",
                "hover:bg-[#15689E]/90 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "flex items-center gap-2",
              )}
            >
              {isSaving && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {/* ── Form content ── */}
      <div className="space-y-6 pb-4">
        {!canEdit && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            You have read-only access to this IVR record.
          </p>
        )}

        {/* Insurance Information */}
        <FormSection title="Insurance Information">
          <FieldRow label="Insurance Provider">
            {textInput("insuranceProvider", "e.g. Blue Cross")}
          </FieldRow>
          <FieldRow label="Plan Name">{textInput("planName")}</FieldRow>
          <FieldRow label="Plan Type">
            {selectInput("planType", [
              { value: "Medicare", label: "Medicare" },
              { value: "Medicaid", label: "Medicaid" },
              { value: "HMO", label: "HMO" },
              { value: "PPO", label: "PPO" },
              { value: "Other", label: "Other" },
            ])}
          </FieldRow>
          <FieldRow label="Member ID">{textInput("memberId")}</FieldRow>
          <FieldRow label="Group Number">{textInput("groupNumber")}</FieldRow>
          <FieldRow label="Insurance Phone">
            {textInput("insurancePhone", "1-800-...")}
          </FieldRow>
        </FormSection>

        {/* Subscriber Details */}
        <FormSection title="Subscriber Details">
          <FieldRow label="Subscriber Name">
            {textInput("subscriberName")}
          </FieldRow>
          <FieldRow label="Subscriber DOB">
            {dateInput("subscriberDob")}
          </FieldRow>
          <FieldRow label="Relationship">
            {selectInput("subscriberRelationship", [
              { value: "Self", label: "Self" },
              { value: "Spouse", label: "Spouse" },
              { value: "Child", label: "Child" },
              { value: "Other", label: "Other" },
            ])}
          </FieldRow>
        </FormSection>

        {/* Coverage Details */}
        <FormSection title="Coverage Details">
          <FieldRow label="Coverage Start">
            {dateInput("coverageStartDate")}
          </FieldRow>
          <FieldRow label="Coverage End">
            {dateInput("coverageEndDate")}
          </FieldRow>
          <FieldRow label="Deductible Amount">
            {numberInput("deductibleAmount", "$")}
          </FieldRow>
          <FieldRow label="Deductible Met">
            {numberInput("deductibleMet", "$")}
          </FieldRow>
          <FieldRow label="Out of Pocket Max">
            {numberInput("outOfPocketMax", "$")}
          </FieldRow>
          <FieldRow label="Out of Pocket Met">
            {numberInput("outOfPocketMet", "$")}
          </FieldRow>
          <FieldRow label="Copay Amount">
            {numberInput("copayAmount", "$")}
          </FieldRow>
          <FieldRow label="Coinsurance">
            {numberInput("coinsurancePercent", "%")}
          </FieldRow>
        </FormSection>

        {/* DME / Wound Care Coverage */}
        <FormSection title="DME / Wound Care Coverage">
          <FieldRow label="DME Covered?">{yesNoRadio("dmeCovered")}</FieldRow>
          <FieldRow label="Wound Care Covered?">
            {yesNoRadio("woundCareCovered")}
          </FieldRow>
          <FieldRow label="Prior Auth Required?">
            {yesNoRadio("priorAuthRequired")}
          </FieldRow>
          {draftData?.priorAuthRequired && (
            <>
              <FieldRow label="Prior Auth Number">
                {textInput("priorAuthNumber")}
              </FieldRow>
              <FieldRow label="Auth Start Date">
                {dateInput("priorAuthStartDate")}
              </FieldRow>
              <FieldRow label="Auth End Date">
                {dateInput("priorAuthEndDate")}
              </FieldRow>
              <FieldRow label="Units Authorized">
                {numberInput("unitsAuthorized")}
              </FieldRow>
            </>
          )}
        </FormSection>

        {/* Verification Details */}
        <FormSection title="Verification Details">
          <FieldRow label="Verified By">
            {textInput("verifiedBy", "Name of person who called")}
          </FieldRow>
          <FieldRow label="Verified Date">
            {dateInput("verifiedDate")}
          </FieldRow>
          <FieldRow label="Reference Number">
            {textInput("verificationReference", "Call reference #")}
          </FieldRow>
          <FieldRow label="Notes">
            <Textarea
              value={(draftData?.notes as string) ?? ""}
              placeholder="Additional notes..."
              disabled={!canEdit}
              rows={3}
              className="text-sm resize-none"
              onChange={(e) => handleChange("notes", e.target.value || null)}
            />
          </FieldRow>
        </FormSection>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
        {title}
      </h4>
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="text-xs text-slate-500 w-36 shrink-0 pt-2">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
