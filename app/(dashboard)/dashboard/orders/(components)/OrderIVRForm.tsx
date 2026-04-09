"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Info, Loader2 } from "lucide-react";
import { upsertOrderIVR } from "../(services)/order-ivr-actions";
import type { DashboardOrder, IOrderIVR } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface OrderIVRFormProps {
  orderId: string;
  canEdit: boolean;
  initialData: Partial<IOrderIVR> | null;
  isReady: boolean;
  onSave?: (data: Partial<IOrderIVR>) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  order: DashboardOrder;
  physicianName?: string | null;
  hcfaData?: Record<string, unknown> | null;
}

const PLAN_TYPE_OPTS = [
  { value: "Medicare", label: "Medicare" },
  { value: "Medicaid", label: "Medicaid" },
  { value: "HMO", label: "HMO" },
  { value: "PPO", label: "PPO" },
  { value: "Other", label: "Other" },
];

const RELATIONSHIP_OPTS = [
  { value: "Self", label: "Self" },
  { value: "Spouse", label: "Spouse" },
  { value: "Child", label: "Child" },
  { value: "Other", label: "Other" },
];

const PARTICIPATES_OPTS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Not Sure", label: "Not Sure" },
];

/* ── Keys prefixed with _ are display-only (shown but not saved to order_ivr) ── */

export function OrderIVRForm({
  orderId,
  canEdit,
  initialData,
  isReady,
  onSave,
  onDirtyChange,
  order,
  physicianName,
  hcfaData,
}: OrderIVRFormProps) {

  function buildSnapshot(): Record<string, unknown> {
    return {
      // IVR DB fields (includes facilityName, physicianName, patientName with fallbacks applied server-side)
      ...((initialData ?? {}) as Record<string, unknown>),
      // Ensure physician name falls back to prop if not yet in DB
      physicianName: initialData?.physicianName ?? physicianName ?? order.assigned_provider_name ?? order.created_by_name ?? "",
      // Display-only fields (prefixed _ so they're excluded from the save payload)
      _woundType:     order.wound_type
        ? order.wound_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "",
      _dateOfService: order.date_of_service ?? "",
      _icd10Code:     order.icd10_code ?? "",
      _patientAtSnf:  order.is_patient_at_snf ? "Yes" : "No",
    };
  }

  const [formData, setFormData] = useState<Record<string, unknown>>(buildSnapshot);
  const [baseline, setBaseline] = useState<Record<string, unknown>>(buildSnapshot);
  const [isSaving, setIsSaving] = useState(false);

  /* Reset both states when server data (or physician name) changes.
     For _ display fields: only auto-fill when the field is currently empty so that
     user-saved edits are not overwritten when initialData changes after a save. */
  useEffect(() => {
    setFormData((prev) => {
      const snap = buildSnapshot();
      for (const k of Object.keys(snap)) {
        if (k.startsWith("_") && String(prev[k] ?? "") !== "") {
          snap[k] = prev[k];
        }
      }
      return snap;
    });
    setBaseline((prev) => {
      const snap = buildSnapshot();
      for (const k of Object.keys(snap)) {
        if (k.startsWith("_") && String(prev[k] ?? "") !== "") {
          snap[k] = prev[k];
        }
      }
      return snap;
    });
  }, [initialData, physicianName]); // eslint-disable-line react-hooks/exhaustive-deps

  /* HCFA pre-populate — only updates formData (not baseline), so it appears dirty */
  useEffect(() => {
    if (!isReady) return;
    if (initialData?.insuranceProvider) return;
    if (!hcfaData) return;
    const h = hcfaData;
    if (!h.insured_id_number && !h.insured_plan_name) return;
    const ln = (h.insured_last_name as string) || "";
    const fn = (h.insured_first_name as string) || "";
    const subscriberName = ln && fn ? `${ln}, ${fn}` : ln || fn || null;
    setFormData((prev) => ({
      ...prev,
      insuranceProvider:      (h.insured_plan_name    as string) || prev.insuranceProvider     || null,
      memberId:               (h.insured_id_number    as string) || prev.memberId               || null,
      groupNumber:            (h.insured_policy_group as string) || prev.groupNumber            || null,
      subscriberName:         subscriberName                     ?? prev.subscriberName         ?? null,
      subscriberDob:          (h.insured_dob          as string) || prev.subscriberDob          || null,
      subscriberRelationship: (h.patient_relationship as string) || prev.subscriberRelationship || null,
    }));
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPrepopulated =
    !initialData?.insuranceProvider &&
    !!hcfaData &&
    (!!(hcfaData.insured_id_number) || !!(hcfaData.insured_plan_name));

  /* Dirty = any key differs between formData and baseline */
  const isDirty = useMemo(() => {
    const allKeys = new Set([...Object.keys(formData), ...Object.keys(baseline)]);
    return Array.from(allKeys).some(
      (k) => String(formData[k] ?? "") !== String(baseline[k] ?? ""),
    );
  }, [formData, baseline]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(field: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleDiscard() {
    setFormData({ ...baseline });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      /* Extract only IVR fields — exclude _ prefixed display-only keys */
      const ivrPayload = Object.fromEntries(
        Object.entries(formData).filter(([k]) => !k.startsWith("_")),
      ) as Partial<IOrderIVR>;
      const result = await upsertOrderIVR(orderId, ivrPayload);
      if (result.success) {
        setBaseline({ ...formData });
        onSave?.(ivrPayload);
        toast.success("IVR form saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  }

  /* ── Field helpers ── */

  function text(field: string, placeholder?: string) {
    return (
      <Input
        value={(formData[field] as string) ?? ""}
        placeholder={placeholder}
        disabled={!canEdit}
        className="h-9 text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function num(field: string, prefix?: string) {
    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text3)] pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={(formData[field] as number) ?? ""}
          disabled={!canEdit}
          className={cn("h-9 text-sm", prefix ? "pl-7" : "")}
          onChange={(e) => handleChange(field, e.target.value ? Number(e.target.value) : null)}
        />
      </div>
    );
  }

  function date(field: string) {
    return (
      <Input
        type="date"
        value={(formData[field] as string) ?? ""}
        disabled={!canEdit}
        className="h-9 text-sm"
        onChange={(e) => handleChange(field, e.target.value || null)}
      />
    );
  }

  function sel(field: string, options: { value: string; label: string }[]) {
    return (
      <select
        value={(formData[field] as string) ?? ""}
        disabled={!canEdit}
        className="h-9 w-full border border-[var(--border)] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)] bg-white disabled:opacity-60"
        onChange={(e) => handleChange(field, e.target.value || null)}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  function checkField(field: string, label: string) {
    return (
      <label className={cn("flex items-center gap-2 h-9 cursor-pointer select-none", !canEdit && "opacity-60 cursor-not-allowed")}>
        <input
          type="checkbox"
          checked={(formData[field] as boolean) ?? false}
          disabled={!canEdit}
          className="w-4 h-4 rounded accent-[var(--navy)]"
          onChange={(e) => handleChange(field, e.target.checked)}
        />
        <span className="text-sm text-[var(--navy)]">{label}</span>
      </label>
    );
  }

  function yesNo(field: string) {
    const val = formData[field] as boolean | undefined;
    return (
      <div className="flex gap-2 h-9 items-center">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={!canEdit}
            onClick={() => handleChange(field, v)}
            className={cn(
              "flex-1 h-8 text-xs font-medium rounded-lg border-2 transition-all",
              val === v
                ? "border-[var(--navy)] bg-[#EBF4FF] text-[var(--navy)]"
                : "border-[var(--border)] text-[var(--text3)] hover:border-[var(--text3)]",
              !canEdit && "opacity-60 cursor-not-allowed",
            )}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text3)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)] py-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text3)]">
          IVR Form
          {isDirty && (
            <span className="ml-2 text-amber-500 normal-case font-normal tracking-normal">
              · Unsaved changes
            </span>
          )}
        </h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {/* ── Form body ── */}
      <div className="space-y-4 pb-6">
        {!canEdit && (
          <p className="text-xs text-[var(--text3)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2">
            You have read-only access to this IVR record.
          </p>
        )}

        {isPrepopulated && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--r)] bg-amber-50 border border-amber-200">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              Insurance fields pre-filled from the 1500 form. Please verify and update as needed.
            </p>
          </div>
        )}

        {/* 1 — Facility Information */}
        <FormCard title="Facility Information">
          <Field label="Place of Service">
            {sel("placeOfService", [
              { value: "office", label: "Office" },
              { value: "outpatient_hospital", label: "Outpatient Hospital" },
              { value: "ambulatory_surgical_center", label: "Ambulatory Surgical Center" },
              { value: "other", label: "Other" },
            ])}
          </Field>
          <Field label="Facility Name">
            <Input
              value={(formData.facilityName as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("facilityName", e.target.value || null)}
            />
          </Field>
          <Field label="Medicare Admin Contractor">
            {text("medicareAdminContractor")}
          </Field>
          <Field label="Facility NPI">
            {text("facilityNpi")}
          </Field>
          <Field label="Facility TIN">
            {text("facilityTin")}
          </Field>
          <Field label="Facility PTAN">
            {text("facilityPtan")}
          </Field>
          <Field label="Facility Fax">
            {text("facilityFax")}
          </Field>
        </FormCard>

        {/* 2 — Physician Information */}
        <FormCard title="Physician Information">
          <Field label="Physician Name">
            <Input
              value={(formData.physicianName as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("physicianName", e.target.value || null)}
            />
          </Field>
          <Field label="Physician TIN">
            {text("physicianTin")}
          </Field>
          <Field label="Physician Fax">
            {text("physicianFax")}
          </Field>
          <Field label="Physician Address" fullWidth>
            {text("physicianAddress")}
          </Field>
        </FormCard>

        {/* 3 — Patient Information */}
        <FormCard title="Patient Information">
          <Field label="Patient Name">
            <Input
              value={(formData.patientName as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("patientName", e.target.value || null)}
            />
          </Field>
          <Field label="Patient Phone">
            {text("patientPhone")}
          </Field>
          <Field label="Patient Address" fullWidth>
            {text("patientAddress")}
          </Field>
          <Field label="Contact Consent" fullWidth>
            {checkField("okToContactPatient", "OK to Contact Patient?")}
          </Field>
        </FormCard>

        {/* 4 — Primary Insurance */}
        <FormCard title="Primary Insurance">
          <Field label="Insurance Provider">
            {text("insuranceProvider", "e.g. Blue Cross")}
          </Field>
          <Field label="Insurance Phone">
            {text("insurancePhone", "1-800-...")}
          </Field>
          <Field label="Subscriber Name">
            {text("subscriberName")}
          </Field>
          <Field label="Policy Number">
            {text("memberId")}
          </Field>
          <Field label="Subscriber DOB">
            {date("subscriberDob")}
          </Field>
          <Field label="Group Number">
            {text("groupNumber")}
          </Field>
          <Field label="Plan Type">
            {sel("planType", PLAN_TYPE_OPTS)}
          </Field>
          <Field label="Plan Name">
            {text("planName")}
          </Field>
          <Field label="Subscriber Relationship">
            {sel("subscriberRelationship", RELATIONSHIP_OPTS)}
          </Field>
          <Field label="Provider Participates">
            {sel("providerParticipatesPrimary", PARTICIPATES_OPTS)}
          </Field>
          <Field label="Coverage Start">
            {date("coverageStartDate")}
          </Field>
          <Field label="Coverage End">
            {date("coverageEndDate")}
          </Field>
        </FormCard>

        {/* 5 — Secondary Insurance */}
        <FormCard title="Secondary Insurance">
          <Field label="Insurance Provider">
            {text("secondaryInsuranceProvider")}
          </Field>
          <Field label="Insurance Phone">
            {text("secondaryInsurancePhone")}
          </Field>
          <Field label="Subscriber Name">
            {text("secondarySubscriberName")}
          </Field>
          <Field label="Policy Number">
            {text("secondaryPolicyNumber")}
          </Field>
          <Field label="Subscriber DOB">
            {date("secondarySubscriberDob")}
          </Field>
          <Field label="Group Number">
            {text("secondaryGroupNumber")}
          </Field>
          <Field label="Plan Type">
            {sel("secondaryPlanType", PLAN_TYPE_OPTS)}
          </Field>
          <Field label="Subscriber Relationship">
            {sel("secondarySubscriberRelationship", RELATIONSHIP_OPTS)}
          </Field>
          <Field label="Provider Participates">
            {sel("providerParticipatesSecondary", PARTICIPATES_OPTS)}
          </Field>
        </FormCard>

        {/* 6 — Benefits & Coverage */}
        <FormCard title="Benefits & Coverage">
          <Field label="Deductible Amount">
            {num("deductibleAmount", "$")}
          </Field>
          <Field label="Deductible Met">
            {num("deductibleMet", "$")}
          </Field>
          <Field label="Out of Pocket Max">
            {num("outOfPocketMax", "$")}
          </Field>
          <Field label="Out of Pocket Met">
            {num("outOfPocketMet", "$")}
          </Field>
          <Field label="Copay Amount">
            {num("copayAmount", "$")}
          </Field>
          <Field label="Coinsurance %">
            {num("coinsurancePercent", "%")}
          </Field>
          <Field label="DME Covered?" fullWidth>
            {yesNo("dmeCovered")}
          </Field>
          <Field label="Wound Care Covered?" fullWidth>
            {yesNo("woundCareCovered")}
          </Field>
        </FormCard>

        {/* 7 — Prior Authorization */}
        <FormCard title="Prior Authorization">
          <Field label="Prior Auth Required?" fullWidth>
            {yesNo("priorAuthRequired")}
          </Field>
          {!!formData.priorAuthRequired && (
            <>
              <Field label="Auth Number">
                {text("priorAuthNumber")}
              </Field>
              <Field label="Units Authorized">
                {num("unitsAuthorized")}
              </Field>
              <Field label="Auth Start Date">
                {date("priorAuthStartDate")}
              </Field>
              <Field label="Auth End Date">
                {date("priorAuthEndDate")}
              </Field>
            </>
          )}
          <Field label="Authorization Permission" fullWidth>
            {checkField("priorAuthPermission", "Allow us to work with payer on your behalf")}
          </Field>
        </FormCard>

        {/* 8 — Wound & Procedure Information */}
        <FormCard title="Wound & Procedure Information">
          <Field label="Wound Type">
            <Input
              value={(formData._woundType as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("_woundType", e.target.value)}
            />
          </Field>
          <Field label="Date of Procedure">
            <Input
              value={(formData._dateOfService as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("_dateOfService", e.target.value)}
            />
          </Field>
          <Field label="ICD-10 Code">
            <Input
              value={(formData._icd10Code as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("_icd10Code", e.target.value)}
            />
          </Field>
          <Field label="Application CPT Codes">
            {text("applicationCpts", "e.g. 97597, 97598")}
          </Field>
        </FormCard>

        {/* 9 — Additional Information */}
        <FormCard title="Additional Information">
          <Field label="Patient at SNF">
            <Input
              value={(formData._patientAtSnf as string) ?? ""}
              disabled={!canEdit}
              className="h-9 text-sm"
              onChange={(e) => handleChange("_patientAtSnf", e.target.value)}
            />
          </Field>
          <Field label="Specialty Site Name">
            {text("specialtySiteName")}
          </Field>
          <Field label="Surgical Global Period" fullWidth>
            {checkField("surgicalGlobalPeriod", "This procedure falls within a surgical global period")}
          </Field>
          {!!formData.surgicalGlobalPeriod && (
            <Field label="Global Period CPT">
              {text("globalPeriodCpt")}
            </Field>
          )}
        </FormCard>

        {/* 10 — Verification */}
        <FormCard title="Verification">
          <Field label="Verified By">
            {text("verifiedBy", "Name of person who called")}
          </Field>
          <Field label="Verified Date">
            {date("verifiedDate")}
          </Field>
          <Field label="Reference Number">
            {text("verificationReference", "Call reference #")}
          </Field>
          <Field label="Notes" fullWidth>
            <Textarea
              value={(formData.notes as string) ?? ""}
              placeholder="Additional notes..."
              disabled={!canEdit}
              rows={3}
              className="text-sm resize-none"
              onChange={(e) => handleChange("notes", e.target.value || null)}
            />
          </Field>
        </FormCard>
      </div>
    </div>
  );
}

/* ── Section helpers ── */

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--r)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <h4 className="text-[14px] font-semibold text-[var(--navy)]">{title}</h4>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  fullWidth,
  children,
}: {
  label: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", fullWidth && "sm:col-span-2")}>
      <span className="text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.06em]">
        {label}
      </span>
      {children}
    </div>
  );
}
