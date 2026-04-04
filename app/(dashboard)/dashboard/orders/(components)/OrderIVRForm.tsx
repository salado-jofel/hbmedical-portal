"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle } from "lucide-react";
import { getOrderIVR, upsertOrderIVR } from "../(services)/actions";
import type { IOrderIVR } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

interface OrderIVRFormProps {
  orderId: string;
  canEdit: boolean;
}

type IVRFieldKey = keyof Omit<
  IOrderIVR,
  "id" | "orderId" | "aiExtracted" | "createdAt" | "updatedAt"
>;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function OrderIVRForm({ orderId, canEdit }: OrderIVRFormProps) {
  const [ivr, setIvr] = useState<Partial<IOrderIVR>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getOrderIVR(orderId).then((data) => {
      if (data) setIvr(data);
      setLoading(false);
    });
  }, [orderId]);

  const scheduleSave = useCallback(
    (field: IVRFieldKey, value: unknown) => {
      if (!canEdit) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await upsertOrderIVR(orderId, {
          [field]: value,
        } as Partial<IOrderIVR>);
        if (result.success) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      }, 800);
    },
    [orderId, canEdit]
  );

  function handleChange(
    field: IVRFieldKey,
    value: string | number | boolean | null
  ) {
    setIvr((prev) => ({ ...prev, [field]: value }));
    scheduleSave(field, value);
  }

  function textInput(field: IVRFieldKey, placeholder?: string) {
    return (
      <Input
        value={(ivr[field] as string) ?? ""}
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
          value={(ivr[field] as number) ?? ""}
          disabled={!canEdit}
          className={cn("text-sm", prefix ? "pl-7" : "")}
          onChange={(e) =>
            handleChange(
              field,
              e.target.value ? Number(e.target.value) : null
            )
          }
        />
      </div>
    );
  }

  function dateInput(field: IVRFieldKey) {
    return (
      <Input
        type="date"
        value={(ivr[field] as string) ?? ""}
        disabled={!canEdit}
        className="text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function yesNoRadio(field: IVRFieldKey) {
    const val = ivr[field] as boolean | undefined;
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
              !canEdit && "opacity-60 cursor-not-allowed"
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
    options: { value: string; label: string }[]
  ) {
    return (
      <select
        value={(ivr[field] as string) ?? ""}
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Save status banner */}
      {saveStatus !== "idle" && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            saveStatus === "saving" && "bg-blue-50 text-blue-700",
            saveStatus === "saved" && "bg-green-50 text-green-700",
            saveStatus === "error" && "bg-red-50 text-red-700"
          )}
        >
          {saveStatus === "saving" && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {saveStatus === "saved" && <CheckCircle className="w-3.5 h-3.5" />}
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "Change is saved"}
          {saveStatus === "error" && "Failed to save — please try again"}
        </div>
      )}

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
        <FieldRow label="Subscriber DOB">{dateInput("subscriberDob")}</FieldRow>
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
        <FieldRow label="Coverage End">{dateInput("coverageEndDate")}</FieldRow>
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
        {ivr.priorAuthRequired && (
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
        <FieldRow label="Verified Date">{dateInput("verifiedDate")}</FieldRow>
        <FieldRow label="Reference Number">
          {textInput("verificationReference", "Call reference #")}
        </FieldRow>
        <FieldRow label="Notes">
          <Textarea
            value={(ivr.notes as string) ?? ""}
            placeholder="Additional notes..."
            disabled={!canEdit}
            rows={3}
            className="text-sm resize-none"
            onChange={(e) => handleChange("notes", e.target.value || null)}
          />
        </FieldRow>
      </FormSection>
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
