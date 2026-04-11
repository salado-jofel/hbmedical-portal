"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertForm1500 } from "../(services)/order-document-actions";
import type { IServiceLine } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

/* ── Design tokens ── */
const RED = "#cc0000";
const LS = {
  fontSize: 6,
  color: RED,
  textTransform: "uppercase" as const,
  fontWeight: 700,
  letterSpacing: "0.05em",
  lineHeight: 1.4,
} as const;

/* ── Form state ── */
type F = {
  insuranceType: string;
  insuredIdNumber: string;
  patientLastName: string; patientFirstName: string; patientMiddleInitial: string;
  patientDob: string; patientSex: string;
  insuredLastName: string; insuredFirstName: string; insuredMiddleInitial: string;
  patientAddress: string; patientCity: string; patientState: string; patientZip: string; patientPhone: string;
  patientRelationship: string;
  insuredAddress: string; insuredCity: string; insuredState: string; insuredZip: string; insuredPhone: string;
  otherInsuredName: string; otherInsuredPolicy: string; otherInsuredDob: string; otherInsuredSex: string;
  otherInsuredEmployer: string; otherInsuredPlan: string;
  conditionEmployment: boolean; conditionAutoAccident: boolean; conditionAutoState: string; conditionOtherAccident: boolean;
  insuredPolicyGroup: string; insuredDob: string; insuredSex: string; insuredEmployer: string; insuredPlanName: string;
  anotherHealthBenefit: boolean;
  patientSignature: string; patientSignatureDate: string; insuredSignature: string;
  illnessDate: string; illnessQualifier: string;
  otherDate: string; otherDateQualifier: string;
  unableWorkFrom: string; unableWorkTo: string;
  referringProviderName: string; referringProviderNpi: string; referringProviderQual: string;
  hospitalizationFrom: string; hospitalizationTo: string;
  additionalClaimInfo: string;
  outsideLab: boolean; outsideLabCharges: string;
  diagnosisA: string; diagnosisB: string; diagnosisC: string; diagnosisD: string;
  diagnosisE: string; diagnosisF: string; diagnosisG: string; diagnosisH: string;
  diagnosisI: string; diagnosisJ: string; diagnosisK: string; diagnosisL: string;
  resubmissionCode: string; originalRefNumber: string; priorAuthNumber: string;
  serviceLines: IServiceLine[];
  federalTaxId: string; taxIdSsn: boolean; patientAccountNumber: string;
  acceptAssignment: boolean; totalCharge: string; amountPaid: string; rsvdNucc: string;
  physicianSignature: string; physicianSignatureDate: string;
  serviceFacilityName: string; serviceFacilityAddress: string; serviceFacilityNpi: string;
  billingProviderName: string; billingProviderAddress: string; billingProviderPhone: string;
  billingProviderNpi: string; billingProviderTaxId: string;
};

function buildFormState(d: Record<string, unknown> | null): F {
  const r = d ?? {};
  const s = (k: string) => (r[k] as string) ?? "";
  const b = (k: string) => !!(r[k] as boolean);
  return {
    insuranceType: s("insurance_type"), insuredIdNumber: s("insured_id_number"),
    patientLastName: s("patient_last_name"), patientFirstName: s("patient_first_name"), patientMiddleInitial: s("patient_middle_initial"),
    patientDob: s("patient_dob"), patientSex: s("patient_sex"),
    insuredLastName: s("insured_last_name"), insuredFirstName: s("insured_first_name"), insuredMiddleInitial: s("insured_middle_initial"),
    patientAddress: s("patient_address"), patientCity: s("patient_city"), patientState: s("patient_state"),
    patientZip: s("patient_zip"), patientPhone: s("patient_phone"),
    patientRelationship: s("patient_relationship"),
    insuredAddress: s("insured_address"), insuredCity: s("insured_city"), insuredState: s("insured_state"),
    insuredZip: s("insured_zip"), insuredPhone: s("insured_phone"),
    otherInsuredName: s("other_insured_name"), otherInsuredPolicy: s("other_insured_policy"),
    otherInsuredDob: s("other_insured_dob"), otherInsuredSex: s("other_insured_sex"),
    otherInsuredEmployer: s("other_insured_employer"), otherInsuredPlan: s("other_insured_plan"),
    conditionEmployment: b("condition_employment"), conditionAutoAccident: b("condition_auto_accident"),
    conditionAutoState: s("condition_auto_state"), conditionOtherAccident: b("condition_other_accident"),
    insuredPolicyGroup: s("insured_policy_group"), insuredDob: s("insured_dob"), insuredSex: s("insured_sex"),
    insuredEmployer: s("insured_employer"), insuredPlanName: s("insured_plan_name"),
    anotherHealthBenefit: b("another_health_benefit"),
    patientSignature: s("patient_signature"), patientSignatureDate: s("patient_signature_date"),
    insuredSignature: s("insured_signature"),
    illnessDate: s("illness_date"), illnessQualifier: s("illness_qualifier"),
    otherDate: s("other_date"), otherDateQualifier: s("other_date_qualifier"),
    unableWorkFrom: s("unable_work_from"), unableWorkTo: s("unable_work_to"),
    referringProviderName: s("referring_provider_name"), referringProviderNpi: s("referring_provider_npi"),
    referringProviderQual: s("referring_provider_qual"),
    hospitalizationFrom: s("hospitalization_from"), hospitalizationTo: s("hospitalization_to"),
    additionalClaimInfo: s("additional_claim_info"),
    outsideLab: b("outside_lab"), outsideLabCharges: s("outside_lab_charges"),
    diagnosisA: s("diagnosis_a"), diagnosisB: s("diagnosis_b"), diagnosisC: s("diagnosis_c"), diagnosisD: s("diagnosis_d"),
    diagnosisE: s("diagnosis_e"), diagnosisF: s("diagnosis_f"), diagnosisG: s("diagnosis_g"), diagnosisH: s("diagnosis_h"),
    diagnosisI: s("diagnosis_i"), diagnosisJ: s("diagnosis_j"), diagnosisK: s("diagnosis_k"), diagnosisL: s("diagnosis_l"),
    resubmissionCode: s("resubmission_code"), originalRefNumber: s("original_ref_number"), priorAuthNumber: s("prior_auth_number"),
    serviceLines: (r["service_lines"] as IServiceLine[]) ?? [],
    federalTaxId: s("federal_tax_id"), taxIdSsn: b("tax_id_ssn"), patientAccountNumber: s("patient_account_number"),
    acceptAssignment: b("accept_assignment"), totalCharge: s("total_charge"), amountPaid: s("amount_paid"), rsvdNucc: s("rsvd_nucc"),
    physicianSignature: s("physician_signature"), physicianSignatureDate: s("physician_signature_date"),
    serviceFacilityName: s("service_facility_name"), serviceFacilityAddress: s("service_facility_address"),
    serviceFacilityNpi: s("service_facility_npi"),
    billingProviderName: s("billing_provider_name"), billingProviderAddress: s("billing_provider_address"),
    billingProviderPhone: s("billing_provider_phone"), billingProviderNpi: s("billing_provider_npi"),
    billingProviderTaxId: s("billing_provider_tax_id"),
  };
}

/* ── Primitives ── */
function CI({
  v, onChange, disabled, placeholder, type = "text", mono = true, style,
}: {
  v: string; onChange: (x: string) => void; disabled?: boolean;
  placeholder?: string; type?: string; mono?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={v}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-none outline-none disabled:opacity-60"
      style={{ fontSize: 10, fontFamily: mono ? "monospace" : "inherit", color: "#000", width: "100%", ...style }}
    />
  );
}

function CC({
  checked, onChange, disabled, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string;
}) {
  return (
    <label className={cn("inline-flex items-center gap-0.5", disabled ? "opacity-60" : "cursor-pointer")}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 9, height: 9, border: `1px solid ${RED}`, cursor: disabled ? "default" : "pointer" }}
      >
        {checked && <div style={{ width: 5, height: 5, backgroundColor: RED }} />}
      </div>
      {label && <span style={{ fontSize: 7, fontFamily: "monospace", color: "#000", textTransform: "uppercase" }}>{label}</span>}
    </label>
  );
}

// Box cell
function BX({
  num, title, children, flex, nb, nr, style, className,
}: {
  num?: string; title?: string; children?: React.ReactNode;
  flex?: number | string; nb?: boolean; nr?: boolean;
  style?: React.CSSProperties; className?: string;
}) {
  return (
    <div
      className={cn("p-[3px]", className)}
      style={{
        flex: flex ?? 1,
        borderRight: nr ? "none" : `1px solid ${RED}`,
        borderBottom: nb ? "none" : `1px solid ${RED}`,
        minHeight: 26,
        overflow: "hidden",
        ...style,
      }}
    >
      {(num || title) && (
        <div style={LS}>
          {num && <span>{num}. </span>}{title}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex", className)}>{children}</div>;
}

/* ── Component ── */
export function HCFA1500Document({
  orderId,
  canEdit,
  initialData,
  onDirtyChange,
  onSave,
}: {
  orderId: string;
  canEdit: boolean;
  initialData: Record<string, unknown> | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSave?: (data: Record<string, unknown>) => void;
}) {
  const [formData, setFormData] = useState<F>(() => buildFormState(initialData));
  const [isSaving, setIsSaving] = useState(false);

  const baseline = useMemo(() => buildFormState(initialData), [initialData]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof F>(key: K, value: F[K]) {
    setFormData((p) => ({ ...p, [key]: value }));
  }

  function handleDiscard() { setFormData(buildFormState(initialData)); }

  /* ── Service lines ── */
  function lines() { return formData.serviceLines; }
  function addLine() {
    set("serviceLines", [
      ...lines(),
      { id: crypto.randomUUID(), dos_from: "", dos_to: "", place_of_service: "", emg: false,
        cpt_code: "", modifier_1: "", modifier_2: "", modifier_3: "", modifier_4: "",
        diagnosis_pointer: "", charges: "", days_units: "1", epsdt: "", id_qualifier: "", rendering_npi: "" },
    ]);
  }
  function removeLine(id: string) { set("serviceLines", lines().filter((l) => l.id !== id)); }
  function updateLine(id: string, field: keyof IServiceLine, value: string | boolean) {
    set("serviceLines", lines().map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  /* ── Save ── */
  async function handleSave() {
    setIsSaving(true);
    const ns = (v: string) => v.trim() || null;
    const payload: Record<string, unknown> = {
      insurance_type: ns(formData.insuranceType), insured_id_number: ns(formData.insuredIdNumber),
      patient_last_name: ns(formData.patientLastName), patient_first_name: ns(formData.patientFirstName),
      patient_middle_initial: ns(formData.patientMiddleInitial),
      patient_dob: ns(formData.patientDob), patient_sex: ns(formData.patientSex),
      insured_last_name: ns(formData.insuredLastName), insured_first_name: ns(formData.insuredFirstName),
      insured_middle_initial: ns(formData.insuredMiddleInitial),
      patient_address: ns(formData.patientAddress), patient_city: ns(formData.patientCity),
      patient_state: ns(formData.patientState), patient_zip: ns(formData.patientZip),
      patient_phone: ns(formData.patientPhone), patient_relationship: ns(formData.patientRelationship),
      insured_address: ns(formData.insuredAddress), insured_city: ns(formData.insuredCity),
      insured_state: ns(formData.insuredState), insured_zip: ns(formData.insuredZip),
      insured_phone: ns(formData.insuredPhone),
      other_insured_name: ns(formData.otherInsuredName), other_insured_policy: ns(formData.otherInsuredPolicy),
      other_insured_dob: ns(formData.otherInsuredDob), other_insured_sex: ns(formData.otherInsuredSex),
      other_insured_employer: ns(formData.otherInsuredEmployer), other_insured_plan: ns(formData.otherInsuredPlan),
      condition_employment: formData.conditionEmployment, condition_auto_accident: formData.conditionAutoAccident,
      condition_auto_state: ns(formData.conditionAutoState), condition_other_accident: formData.conditionOtherAccident,
      insured_policy_group: ns(formData.insuredPolicyGroup), insured_dob: ns(formData.insuredDob),
      insured_sex: ns(formData.insuredSex), insured_employer: ns(formData.insuredEmployer),
      insured_plan_name: ns(formData.insuredPlanName), another_health_benefit: formData.anotherHealthBenefit,
      patient_signature: ns(formData.patientSignature), patient_signature_date: ns(formData.patientSignatureDate),
      insured_signature: ns(formData.insuredSignature),
      illness_date: ns(formData.illnessDate), illness_qualifier: ns(formData.illnessQualifier),
      other_date: ns(formData.otherDate), other_date_qualifier: ns(formData.otherDateQualifier),
      unable_work_from: ns(formData.unableWorkFrom), unable_work_to: ns(formData.unableWorkTo),
      referring_provider_name: ns(formData.referringProviderName), referring_provider_npi: ns(formData.referringProviderNpi),
      referring_provider_qual: ns(formData.referringProviderQual),
      hospitalization_from: ns(formData.hospitalizationFrom), hospitalization_to: ns(formData.hospitalizationTo),
      additional_claim_info: ns(formData.additionalClaimInfo),
      outside_lab: formData.outsideLab, outside_lab_charges: ns(formData.outsideLabCharges),
      diagnosis_a: ns(formData.diagnosisA), diagnosis_b: ns(formData.diagnosisB),
      diagnosis_c: ns(formData.diagnosisC), diagnosis_d: ns(formData.diagnosisD),
      diagnosis_e: ns(formData.diagnosisE), diagnosis_f: ns(formData.diagnosisF),
      diagnosis_g: ns(formData.diagnosisG), diagnosis_h: ns(formData.diagnosisH),
      diagnosis_i: ns(formData.diagnosisI), diagnosis_j: ns(formData.diagnosisJ),
      diagnosis_k: ns(formData.diagnosisK), diagnosis_l: ns(formData.diagnosisL),
      resubmission_code: ns(formData.resubmissionCode), original_ref_number: ns(formData.originalRefNumber),
      prior_auth_number: ns(formData.priorAuthNumber),
      service_lines: formData.serviceLines,
      federal_tax_id: ns(formData.federalTaxId), tax_id_ssn: formData.taxIdSsn,
      patient_account_number: ns(formData.patientAccountNumber), accept_assignment: formData.acceptAssignment,
      total_charge: ns(formData.totalCharge), amount_paid: ns(formData.amountPaid), rsvd_nucc: ns(formData.rsvdNucc),
      physician_signature: ns(formData.physicianSignature), physician_signature_date: ns(formData.physicianSignatureDate),
      service_facility_name: ns(formData.serviceFacilityName), service_facility_address: ns(formData.serviceFacilityAddress),
      service_facility_npi: ns(formData.serviceFacilityNpi),
      billing_provider_name: ns(formData.billingProviderName), billing_provider_address: ns(formData.billingProviderAddress),
      billing_provider_phone: ns(formData.billingProviderPhone), billing_provider_npi: ns(formData.billingProviderNpi),
      billing_provider_tax_id: ns(formData.billingProviderTaxId),
    };
    const result = await upsertForm1500(orderId, payload);
    setIsSaving(false);
    if (!result.success) { toast.error(result.error ?? "Failed to save."); return; }
    toast.success("HCFA-1500 saved.");
    onSave?.(payload);
    fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, formType: "hcfa_1500" }),
    }).catch((err) => console.error("[HCFA1500] PDF generation failed:", err));
  }

  const dis = !canEdit;

  /* ── Render ── */
  return (
    <div className="relative">
      {/* ── Sticky save/discard bar ── */}
      {isDirty && canEdit && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <span className="text-[13px] text-amber-700 font-medium">Unsaved changes</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDiscard} disabled={isSaving} className="h-7 px-3 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 px-3 text-xs bg-[#1a3c5e] hover:bg-[#1a3c5e]/90">
              {isSaving ? <span className="w-3 h-3 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          CMS-1500 PAPER FORM
          ═══════════════════════════════════════ */}
      <div
        className="mx-auto my-4 bg-white"
        style={{ maxWidth: 900, border: `1px solid ${RED}`, fontFamily: "system-ui, sans-serif" }}
      >
        {/* ── Header ── */}
        <div style={{ borderBottom: `1px solid ${RED}`, padding: "4px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 8, color: RED, fontWeight: 700, letterSpacing: "0.08em" }}>
            HEALTH INSURANCE CLAIM FORM
          </div>
          <div style={{ fontSize: 6, color: "#555", marginTop: 1 }}>
            APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12 &nbsp;&nbsp; PICA | PICA
          </div>
        </div>

        {/* ── Row 1: Box 1 / 1a ── */}
        <Row>
          <BX num="1" title="Medicare  Medicaid  TRICARE  CHAMPVA  Group Health Plan  FECA/Blk Lung  Other" flex={3}>
            <div className="flex gap-3 flex-wrap mt-0.5">
              {(["Medicare","Medicaid","TRICARE","CHAMPVA","Group Health Plan","FECA/Blk Lung","Other"] as const).map((opt) => (
                <CC key={opt} checked={formData.insuranceType === opt.toLowerCase().replace(/[\s/]/g, "_")}
                  onChange={() => set("insuranceType", opt.toLowerCase().replace(/[\s/]/g, "_"))}
                  disabled={dis} label={opt} />
              ))}
            </div>
          </BX>
          <BX num="1a" title="Insured's I.D. Number" flex={1} nr>
            <CI v={formData.insuredIdNumber} onChange={(v) => set("insuredIdNumber", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 2: Box 2 / 3 / 4 ── */}
        <Row>
          <BX num="2" title="Patient's Name (Last, First, Middle Initial)" flex={3}>
            <div className="flex gap-1">
              <CI v={formData.patientLastName} onChange={(v) => set("patientLastName", v)} disabled={dis} placeholder="Last" />
              <span style={{ fontSize: 10, color: "#aaa" }}>,</span>
              <CI v={formData.patientFirstName} onChange={(v) => set("patientFirstName", v)} disabled={dis} placeholder="First" />
              <CI v={formData.patientMiddleInitial} onChange={(v) => set("patientMiddleInitial", v)} disabled={dis} placeholder="MI" style={{ maxWidth: 28 }} />
            </div>
          </BX>
          <BX num="3" title="Patient's Birth Date / Sex" flex={2}>
            <CI v={formData.patientDob} onChange={(v) => set("patientDob", v)} disabled={dis} type="date" />
            <div className="flex gap-2 mt-0.5">
              <CC checked={formData.patientSex === "male"} onChange={() => set("patientSex", "male")} disabled={dis} label="M" />
              <CC checked={formData.patientSex === "female"} onChange={() => set("patientSex", "female")} disabled={dis} label="F" />
            </div>
          </BX>
          <BX num="4" title="Insured's Name (Last, First, Middle Initial)" flex={4} nr>
            <div className="flex gap-1">
              <CI v={formData.insuredLastName} onChange={(v) => set("insuredLastName", v)} disabled={dis} placeholder="Last" />
              <span style={{ fontSize: 10, color: "#aaa" }}>,</span>
              <CI v={formData.insuredFirstName} onChange={(v) => set("insuredFirstName", v)} disabled={dis} placeholder="First" />
              <CI v={formData.insuredMiddleInitial} onChange={(v) => set("insuredMiddleInitial", v)} disabled={dis} placeholder="MI" style={{ maxWidth: 28 }} />
            </div>
          </BX>
        </Row>

        {/* ── Row 3a: Box 5 address / Box 6 / Box 7 address ── */}
        <Row>
          <BX num="5" title="Patient's Address (No., Street)" flex={3}>
            <CI v={formData.patientAddress} onChange={(v) => set("patientAddress", v)} disabled={dis} />
          </BX>
          <BX num="6" title="Patient Relationship to Insured" flex={2}>
            <div className="flex gap-1.5 flex-wrap">
              {(["Self","Spouse","Child","Other"] as const).map((r) => (
                <CC key={r} checked={formData.patientRelationship === r.toLowerCase()}
                  onChange={() => set("patientRelationship", r.toLowerCase())} disabled={dis} label={r} />
              ))}
            </div>
          </BX>
          <BX num="7" title="Insured's Address (No., Street)" flex={4} nr>
            <CI v={formData.insuredAddress} onChange={(v) => set("insuredAddress", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 3b: Box 5 city/state/zip / Box 8 reserved / Box 7 city/state/zip ── */}
        <Row>
          <BX title="City / State / ZIP / Phone" flex={3}>
            <div className="flex gap-1">
              <CI v={formData.patientCity} onChange={(v) => set("patientCity", v)} disabled={dis} placeholder="City" />
              <CI v={formData.patientState} onChange={(v) => set("patientState", v)} disabled={dis} placeholder="ST" style={{ maxWidth: 28 }} />
              <CI v={formData.patientZip} onChange={(v) => set("patientZip", v)} disabled={dis} placeholder="ZIP" style={{ maxWidth: 55 }} />
              <CI v={formData.patientPhone} onChange={(v) => set("patientPhone", v)} disabled={dis} placeholder="Phone" type="tel" />
            </div>
          </BX>
          <BX num="8" title="Reserved for NUCC Use" flex={2}>
            <CI v="" onChange={() => {}} disabled />
          </BX>
          <BX title="City / State / ZIP / Phone" flex={4} nr>
            <div className="flex gap-1">
              <CI v={formData.insuredCity} onChange={(v) => set("insuredCity", v)} disabled={dis} placeholder="City" />
              <CI v={formData.insuredState} onChange={(v) => set("insuredState", v)} disabled={dis} placeholder="ST" style={{ maxWidth: 28 }} />
              <CI v={formData.insuredZip} onChange={(v) => set("insuredZip", v)} disabled={dis} placeholder="ZIP" style={{ maxWidth: 55 }} />
              <CI v={formData.insuredPhone} onChange={(v) => set("insuredPhone", v)} disabled={dis} placeholder="Phone" type="tel" />
            </div>
          </BX>
        </Row>

        {/* ── Row 4a: Box 9 / Box 10 header / Box 11 ── */}
        <Row>
          <BX num="9" title="Other Insured's Name (Last, First, MI)" flex={3}>
            <CI v={formData.otherInsuredName} onChange={(v) => set("otherInsuredName", v)} disabled={dis} />
          </BX>
          <BX num="10" title="Is Patient's Condition Related To:" flex={2}>
            <div />
          </BX>
          <BX num="11" title="Insured's Policy Group or FECA Number" flex={4} nr>
            <CI v={formData.insuredPolicyGroup} onChange={(v) => set("insuredPolicyGroup", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 4b: Box 9a / Box 10a / Box 11a ── */}
        <Row>
          <BX num="9a" title="Other Insured's Policy or Group Number" flex={3}>
            <CI v={formData.otherInsuredPolicy} onChange={(v) => set("otherInsuredPolicy", v)} disabled={dis} />
          </BX>
          <BX num="10a" title="Employment? (Current or Previous)" flex={2}>
            <div className="flex gap-3">
              <CC checked={formData.conditionEmployment} onChange={(v) => set("conditionEmployment", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.conditionEmployment} onChange={(v) => set("conditionEmployment", !v)} disabled={dis} label="No" />
            </div>
          </BX>
          <BX num="11a" title="Insured's Date of Birth / Sex" flex={4} nr>
            <div className="flex gap-2">
              <CI v={formData.insuredDob} onChange={(v) => set("insuredDob", v)} disabled={dis} type="date" />
              <CC checked={formData.insuredSex === "male"} onChange={() => set("insuredSex", "male")} disabled={dis} label="M" />
              <CC checked={formData.insuredSex === "female"} onChange={() => set("insuredSex", "female")} disabled={dis} label="F" />
            </div>
          </BX>
        </Row>

        {/* ── Row 4c: Box 9b / Box 10b / Box 11b ── */}
        <Row>
          <BX num="9b" title="Reserved for NUCC Use" flex={3}>
            <CI v={formData.otherInsuredDob} onChange={(v) => set("otherInsuredDob", v)} disabled={dis} type="date" placeholder="Other DOB" />
          </BX>
          <BX num="10b" title="Auto Accident? / Place (State)" flex={2}>
            <div className="flex gap-3 mb-0.5">
              <CC checked={formData.conditionAutoAccident} onChange={(v) => set("conditionAutoAccident", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.conditionAutoAccident} onChange={(v) => set("conditionAutoAccident", !v)} disabled={dis} label="No" />
            </div>
            {formData.conditionAutoAccident && (
              <CI v={formData.conditionAutoState} onChange={(v) => set("conditionAutoState", v)} disabled={dis} placeholder="State" />
            )}
          </BX>
          <BX num="11b" title="Employer's Name or School Name" flex={4} nr>
            <CI v={formData.insuredEmployer} onChange={(v) => set("insuredEmployer", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 4d: Box 9c / Box 10c / Box 11c ── */}
        <Row>
          <BX num="9c" title="Reserved for NUCC Use" flex={3}>
            <div className="flex gap-2">
              <CI v={formData.otherInsuredSex === "male" ? "Male" : formData.otherInsuredSex === "female" ? "Female" : ""} onChange={() => {}} disabled />
              <CC checked={formData.otherInsuredSex === "male"} onChange={() => set("otherInsuredSex", "male")} disabled={dis} label="M" />
              <CC checked={formData.otherInsuredSex === "female"} onChange={() => set("otherInsuredSex", "female")} disabled={dis} label="F" />
            </div>
          </BX>
          <BX num="10c" title="Other Accident?" flex={2}>
            <div className="flex gap-3">
              <CC checked={formData.conditionOtherAccident} onChange={(v) => set("conditionOtherAccident", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.conditionOtherAccident} onChange={(v) => set("conditionOtherAccident", !v)} disabled={dis} label="No" />
            </div>
          </BX>
          <BX num="11c" title="Insurance Plan Name or Program Name" flex={4} nr>
            <CI v={formData.insuredPlanName} onChange={(v) => set("insuredPlanName", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 4e: Box 9d / Box 10d / Box 11d ── */}
        <Row>
          <BX num="9d" title="Insurance Plan Name or Program Name" flex={3}>
            <CI v={formData.otherInsuredPlan} onChange={(v) => set("otherInsuredPlan", v)} disabled={dis} />
          </BX>
          <BX num="10d" title="Claim Codes (Designated by NUCC)" flex={2}>
            <CI v="" onChange={() => {}} disabled />
          </BX>
          <BX num="11d" title="Is There Another Health Benefit Plan?" flex={4} nr>
            <div className="flex gap-3">
              <CC checked={formData.anotherHealthBenefit} onChange={(v) => set("anotherHealthBenefit", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.anotherHealthBenefit} onChange={(v) => set("anotherHealthBenefit", !v)} disabled={dis} label="No" />
            </div>
          </BX>
        </Row>

        {/* ── Row 5: Box 12 / 13 ── */}
        <Row>
          <BX num="12" title="Patient's or Authorized Person's Signature / Date" flex={3}>
            <div className="flex gap-2">
              <CI v={formData.patientSignature} onChange={(v) => set("patientSignature", v)} disabled={dis} placeholder="Signature on File" />
              <CI v={formData.patientSignatureDate} onChange={(v) => set("patientSignatureDate", v)} disabled={dis} type="date" style={{ maxWidth: 130 }} />
            </div>
          </BX>
          <BX num="13" title="Insured's or Authorized Person's Signature" flex={2} nr>
            <CI v={formData.insuredSignature} onChange={(v) => set("insuredSignature", v)} disabled={dis} placeholder="Signature on File" />
          </BX>
        </Row>

        {/* ── Row 6: Box 14 / 15 / 16 ── */}
        <Row>
          <BX num="14" title="Date of Current Illness, Injury, Pregnancy / Qual." flex={3}>
            <div className="flex gap-1">
              <CI v={formData.illnessDate} onChange={(v) => set("illnessDate", v)} disabled={dis} type="date" />
              <CI v={formData.illnessQualifier} onChange={(v) => set("illnessQualifier", v)} disabled={dis} placeholder="431/484/453" style={{ maxWidth: 80 }} />
            </div>
          </BX>
          <BX num="15" title="Other Date / Qual." flex={2}>
            <div className="flex gap-1">
              <CI v={formData.otherDateQualifier} onChange={(v) => set("otherDateQualifier", v)} disabled={dis} placeholder="Qual" style={{ maxWidth: 50 }} />
              <CI v={formData.otherDate} onChange={(v) => set("otherDate", v)} disabled={dis} type="date" />
            </div>
          </BX>
          <BX num="16" title="Dates Patient Unable to Work in Current Occupation" flex={4} nr>
            <div className="flex gap-2">
              <div>
                <div style={{ ...LS, fontSize: 5 }}>From</div>
                <CI v={formData.unableWorkFrom} onChange={(v) => set("unableWorkFrom", v)} disabled={dis} type="date" />
              </div>
              <div>
                <div style={{ ...LS, fontSize: 5 }}>To</div>
                <CI v={formData.unableWorkTo} onChange={(v) => set("unableWorkTo", v)} disabled={dis} type="date" />
              </div>
            </div>
          </BX>
        </Row>

        {/* ── Row 7: Box 17 / 17a+b / 18 / 19 ── */}
        <Row>
          <BX num="17" title="Name of Referring Provider or Other Source" flex={3}>
            <div className="flex gap-1 mb-1">
              <CI v={formData.referringProviderQual} onChange={(v) => set("referringProviderQual", v)} disabled={dis} placeholder="Qual" style={{ maxWidth: 40 }} />
              <CI v={formData.referringProviderName} onChange={(v) => set("referringProviderName", v)} disabled={dis} placeholder="Name" />
            </div>
            <div style={{ ...LS, fontSize: 5 }}>17b. NPI</div>
            <CI v={formData.referringProviderNpi} onChange={(v) => set("referringProviderNpi", v)} disabled={dis} />
          </BX>
          <BX num="18" title="Hospitalization Dates Related to Current Services" flex={2}>
            <div>
              <div style={{ ...LS, fontSize: 5 }}>From</div>
              <CI v={formData.hospitalizationFrom} onChange={(v) => set("hospitalizationFrom", v)} disabled={dis} type="date" />
            </div>
            <div>
              <div style={{ ...LS, fontSize: 5 }}>To</div>
              <CI v={formData.hospitalizationTo} onChange={(v) => set("hospitalizationTo", v)} disabled={dis} type="date" />
            </div>
          </BX>
          <BX num="19" title="Additional Claim Information (Designated by NUCC)" flex={4} nr>
            <CI v={formData.additionalClaimInfo} onChange={(v) => set("additionalClaimInfo", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 8: Box 20 / 21 / 22+23 ── */}
        <Row>
          <BX num="20" title="Outside Lab?  $ Charges" flex={1}>
            <div className="flex gap-2 mb-1">
              <CC checked={formData.outsideLab} onChange={(v) => set("outsideLab", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.outsideLab} onChange={(v) => set("outsideLab", !v)} disabled={dis} label="No" />
            </div>
            {formData.outsideLab && (
              <CI v={formData.outsideLabCharges} onChange={(v) => set("outsideLabCharges", v)} disabled={dis} placeholder="0.00" />
            )}
          </BX>
          <BX num="21" title="Diagnosis or Nature of Illness or Injury — ICD Ind. 0" flex={4}>
            <div className="grid grid-cols-4 gap-0.5">
              {(["A","B","C","D","E","F","G","H","I","J","K","L"] as const).map((ltr) => {
                const key = `diagnosis${ltr}` as keyof F;
                return (
                  <div key={ltr} className="flex items-center gap-0.5">
                    <span style={{ fontSize: 7, color: RED, fontWeight: 700, minWidth: 8 }}>{ltr}.</span>
                    <CI v={formData[key] as string} onChange={(v) => set(key, v)} disabled={dis} placeholder="X00.0" />
                  </div>
                );
              })}
            </div>
          </BX>
          <BX num="22" title="Resubmission Code / Original Ref. No." flex={1}>
            <CI v={formData.resubmissionCode} onChange={(v) => set("resubmissionCode", v)} disabled={dis} placeholder="Code" />
            <CI v={formData.originalRefNumber} onChange={(v) => set("originalRefNumber", v)} disabled={dis} placeholder="Orig Ref #" />
          </BX>
          <BX num="23" title="Prior Authorization Number" flex={2} nr>
            <CI v={formData.priorAuthNumber} onChange={(v) => set("priorAuthNumber", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Box 24: Service Lines ── */}
        {/* Column header */}
        <Row>
          {[
            { label: "24A. Date(s) of Service\nFrom / To", flex: 3 },
            { label: "24B\nPOS", flex: 1 },
            { label: "24C\nEMG", flex: 1 },
            { label: "24D. Procedures, Services or Supplies\nCPT/HCPCS / Modifier", flex: 4 },
            { label: "24E\nDiag\nPtr", flex: 1 },
            { label: "24F\n$ Charges", flex: 2 },
            { label: "24G\nDays or\nUnits", flex: 1 },
            { label: "24J\nRendering\nProvider NPI", flex: 2 },
          ].map((col, i, arr) => (
            <div
              key={i}
              style={{
                flex: col.flex, borderRight: i < arr.length - 1 ? `1px solid ${RED}` : "none",
                borderBottom: `1px solid ${RED}`, padding: "2px 3px",
                backgroundColor: "#fff8f8",
              }}
            >
              <div style={{ ...LS, fontSize: 5, whiteSpace: "pre-line" }}>{col.label}</div>
            </div>
          ))}
        </Row>
        {/* Lines */}
        {lines().map((line, idx) => (
          <Row key={line.id}>
            <div style={{ flex: 3, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px", display: "flex", gap: 2 }}>
              <div style={{ ...LS, fontSize: 5, minWidth: 20 }}>{idx + 1}</div>
              <CI v={line.dos_from} onChange={(v) => updateLine(line.id, "dos_from", v)} disabled={dis} type="date" />
              <CI v={line.dos_to} onChange={(v) => updateLine(line.id, "dos_to", v)} disabled={dis} type="date" />
            </div>
            <div style={{ flex: 1, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px" }}>
              <CI v={line.place_of_service} onChange={(v) => updateLine(line.id, "place_of_service", v)} disabled={dis} placeholder="11" />
            </div>
            <div style={{ flex: 1, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CC checked={line.emg} onChange={(v) => updateLine(line.id, "emg", v)} disabled={dis} />
            </div>
            <div style={{ flex: 4, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px", display: "flex", gap: 2 }}>
              <CI v={line.cpt_code} onChange={(v) => updateLine(line.id, "cpt_code", v)} disabled={dis} placeholder="CPT" />
              {(["modifier_1","modifier_2","modifier_3","modifier_4"] as const).map((m) => (
                <CI key={m} v={line[m]} onChange={(v) => updateLine(line.id, m, v)} disabled={dis} placeholder="mod" style={{ maxWidth: 28 }} />
              ))}
            </div>
            <div style={{ flex: 1, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px" }}>
              <CI v={line.diagnosis_pointer} onChange={(v) => updateLine(line.id, "diagnosis_pointer", v)} disabled={dis} placeholder="A" />
            </div>
            <div style={{ flex: 2, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px" }}>
              <CI v={line.charges} onChange={(v) => updateLine(line.id, "charges", v)} disabled={dis} placeholder="0.00" />
            </div>
            <div style={{ flex: 1, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "2px 3px" }}>
              <CI v={line.days_units} onChange={(v) => updateLine(line.id, "days_units", v)} disabled={dis} />
            </div>
            <div style={{ flex: 2, borderBottom: `1px solid ${RED}`, padding: "2px 3px", display: "flex", alignItems: "center", gap: 2 }}>
              <CI v={line.rendering_npi} onChange={(v) => updateLine(line.id, "rendering_npi", v)} disabled={dis} />
              {canEdit && (
                <button type="button" onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <Trash2 style={{ width: 10, height: 10 }} />
                </button>
              )}
            </div>
          </Row>
        ))}
        {/* Add service line */}
        {canEdit && (
          <div style={{ borderBottom: `1px solid ${RED}`, padding: "4px 6px" }}>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-[10px] font-medium hover:opacity-70"
              style={{ color: RED }}
            >
              <Plus style={{ width: 10, height: 10 }} /> Add Service Line
            </button>
          </div>
        )}

        {/* ── Row 9: Box 25 / 26 / 27 / 28 / 29 / 30 ── */}
        <Row>
          <BX num="25" title="Federal Tax I.D. Number  SSN / EIN" flex={2}>
            <CI v={formData.federalTaxId} onChange={(v) => set("federalTaxId", v)} disabled={dis} />
            <div className="flex gap-2 mt-0.5">
              <CC checked={formData.taxIdSsn} onChange={(v) => set("taxIdSsn", v)} disabled={dis} label="SSN" />
              <CC checked={!formData.taxIdSsn} onChange={(v) => set("taxIdSsn", !v)} disabled={dis} label="EIN" />
            </div>
          </BX>
          <BX num="26" title="Patient's Account No." flex={2}>
            <CI v={formData.patientAccountNumber} onChange={(v) => set("patientAccountNumber", v)} disabled={dis} />
          </BX>
          <BX num="27" title="Accept Assignment?" flex={1}>
            <div className="flex gap-2">
              <CC checked={formData.acceptAssignment} onChange={(v) => set("acceptAssignment", v)} disabled={dis} label="Yes" />
              <CC checked={!formData.acceptAssignment} onChange={(v) => set("acceptAssignment", !v)} disabled={dis} label="No" />
            </div>
          </BX>
          <BX num="28" title="Total Charge" flex={2}>
            <CI v={formData.totalCharge} onChange={(v) => set("totalCharge", v)} disabled={dis} placeholder="$ 0.00" />
          </BX>
          <BX num="29" title="Amount Paid" flex={2}>
            <CI v={formData.amountPaid} onChange={(v) => set("amountPaid", v)} disabled={dis} placeholder="$ 0.00" />
          </BX>
          <BX num="30" title="Reserved for NUCC Use" flex={2} nr>
            <CI v={formData.rsvdNucc} onChange={(v) => set("rsvdNucc", v)} disabled={dis} />
          </BX>
        </Row>

        {/* ── Row 10: Box 31 / 32 / 33 ── */}
        <Row>
          <BX num="31" title="Signature of Physician or Supplier / Date" flex={2}>
            <CI v={formData.physicianSignature} onChange={(v) => set("physicianSignature", v)} disabled={dis} placeholder="Signature on File" />
            <CI v={formData.physicianSignatureDate} onChange={(v) => set("physicianSignatureDate", v)} disabled={dis} type="date" />
          </BX>
          <BX num="32" title="Service Facility Location Information" flex={3}>
            <CI v={formData.serviceFacilityName} onChange={(v) => set("serviceFacilityName", v)} disabled={dis} placeholder="Facility Name" />
            <CI v={formData.serviceFacilityAddress} onChange={(v) => set("serviceFacilityAddress", v)} disabled={dis} placeholder="Address" />
          </BX>
          <BX num="33" title="Billing Provider Info & Ph #" flex={3} nr>
            <CI v={formData.billingProviderPhone} onChange={(v) => set("billingProviderPhone", v)} disabled={dis} placeholder="( ) ___-____" type="tel" />
            <CI v={formData.billingProviderName} onChange={(v) => set("billingProviderName", v)} disabled={dis} placeholder="Provider Name" />
            <CI v={formData.billingProviderAddress} onChange={(v) => set("billingProviderAddress", v)} disabled={dis} placeholder="Address" />
          </BX>
        </Row>

        {/* ── Row 11: Box 31 date / 32a NPI / 33a NPI + 33b ── */}
        <Row>
          <BX title="(Reserved / Date)" flex={2} nb>
            <CI v="" onChange={() => {}} disabled />
          </BX>
          <BX num="32a" title="NPI" flex={1.5} nb>
            <CI v={formData.serviceFacilityNpi} onChange={(v) => set("serviceFacilityNpi", v)} disabled={dis} />
          </BX>
          <BX num="32b" title="Other ID #" flex={1.5} nb>
            <CI v="" onChange={() => {}} disabled />
          </BX>
          <BX num="33a" title="NPI" flex={1.5} nb>
            <CI v={formData.billingProviderNpi} onChange={(v) => set("billingProviderNpi", v)} disabled={dis} />
          </BX>
          <BX num="33b" title="Other ID #" flex={1.5} nb nr>
            <CI v={formData.billingProviderTaxId} onChange={(v) => set("billingProviderTaxId", v)} disabled={dis} />
          </BX>
        </Row>
      </div>
    </div>
  );
}
