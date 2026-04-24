"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from "react";
import {
  Loader2,
  MapPin,
  Mail,
  Globe,
  Phone,
  Check,
  PenLine,
} from "lucide-react";
import { HBLogo } from "@/app/(components)/HBLogo";
import { upsertOrderIVR } from "../(services)/order-ivr-actions";
import {
  verifyProviderPin,
  signIVRWithSpecimen,
  unsignIVR,
} from "../(services)/order-workflow-actions";
import type { IOrderIVR, DashboardOrder } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import { FormDeficiencyBanner } from "./FormDeficiencyBanner";
import { FormActionBar } from "./FormActionBar";
import { SignOrderModal } from "./SignOrderModal";

/* ── Design tokens ── */
const NAVY = "#0f2d4a";
const TEAL = "#0d7a6b";

/* ── Form state ── */
type IVRFormState = {
  salesRepName: string;
  placeOfService: string;
  facilityName: string;
  medicareAdminContractor: string;
  facilityAddress: string;
  facilityNpi: string;
  facilityContact: string;
  facilityTin: string;
  facilityPhone: string;
  facilityPtan: string;
  facilityFax: string;
  physicianName: string;
  physicianFax: string;
  physicianAddress: string;
  physicianNpi: string;
  physicianPhone: string;
  physicianTin: string;
  patientName: string;
  patientPhone: string;
  patientAddress: string;
  okToContactPatient: boolean | null;
  patientDob: string;
  subscriberName: string;
  memberId: string;
  subscriberDob: string;
  planType: string;
  insurancePhone: string;
  providerParticipatesPrimary: string;
  secondarySubscriberName: string;
  secondaryPolicyNumber: string;
  secondarySubscriberDob: string;
  secondaryPlanType: string;
  secondaryInsurancePhone: string;
  providerParticipatesSecondary: string;
  woundType: string;
  woundSizes: string;
  applicationCpts: string;
  dateOfProcedure: string;
  icd10Codes: string;
  productInformation: string;
  isPatientAtSnf: boolean | null;
  surgicalGlobalPeriod: boolean | null;
  globalPeriodCpt: string;
  priorAuthPermission: boolean | null;
  specialtySiteName: string;
  physicianSignature: string;
  physicianSignatureDate: string;
  physicianSignedAt: string | null;
  physicianSignedBy: string | null;
  // ── Chronic-only fields ──
  // Rendered only when order.wound_type === "chronic". Post-surgical leaves
  // these untouched (values persist in DB if set previously, but the UI +
  // PDF don't display them). Allows chronic IVR to carry full back-office
  // data (benefits, verification, detailed auth) while post-surgical
  // matches the physician-facing template.
  groupNumber: string;
  planName: string;
  subscriberRelationship: string;
  coverageStartDate: string;
  coverageEndDate: string;
  secondaryGroupNumber: string;
  secondarySubscriberRelationship: string;
  deductibleAmount: string;
  deductibleMet: string;
  outOfPocketMax: string;
  outOfPocketMet: string;
  copayAmount: string;
  coinsurancePercent: string;
  dmeCovered: boolean | null;
  woundCareCovered: boolean | null;
  priorAuthRequired: boolean | null;
  priorAuthNumber: string;
  unitsAuthorized: string;
  priorAuthStartDate: string;
  priorAuthEndDate: string;
  verifiedBy: string;
  verifiedDate: string;
  verificationReference: string;
  notes: string;
};

function buildFormState(ivr: Partial<IOrderIVR> | null): IVRFormState {
  const s = (v: string | null | undefined) => v ?? "";
  return {
    salesRepName: s(ivr?.salesRepName),
    placeOfService: s(ivr?.placeOfService),
    facilityName: s(ivr?.facilityName),
    medicareAdminContractor: s(ivr?.medicareAdminContractor),
    facilityAddress: s(ivr?.facilityAddress),
    facilityNpi: s(ivr?.facilityNpi),
    facilityContact: s(ivr?.facilityContact),
    facilityTin: s(ivr?.facilityTin),
    facilityPhone: s(ivr?.facilityPhone),
    facilityPtan: s(ivr?.facilityPtan),
    facilityFax: s(ivr?.facilityFax),
    physicianName: s(ivr?.physicianName),
    physicianFax: s(ivr?.physicianFax),
    physicianAddress: s(ivr?.physicianAddress),
    physicianNpi: s(ivr?.physicianNpi),
    physicianPhone: s(ivr?.physicianPhone),
    physicianTin: s(ivr?.physicianTin),
    patientName: s(ivr?.patientName),
    patientPhone: s(ivr?.patientPhone),
    patientAddress: s(ivr?.patientAddress),
    okToContactPatient: ivr?.okToContactPatient ?? null,
    patientDob: s(ivr?.patientDob),
    subscriberName: s(ivr?.subscriberName),
    memberId: s(ivr?.memberId),
    subscriberDob: s(ivr?.subscriberDob),
    planType: s(ivr?.planType),
    insurancePhone: s(ivr?.insurancePhone),
    providerParticipatesPrimary: s(ivr?.providerParticipatesPrimary),
    secondarySubscriberName: s(ivr?.secondarySubscriberName),
    secondaryPolicyNumber: s(ivr?.secondaryPolicyNumber),
    secondarySubscriberDob: s(ivr?.secondarySubscriberDob),
    secondaryPlanType: s(ivr?.secondaryPlanType),
    secondaryInsurancePhone: s(ivr?.secondaryInsurancePhone),
    providerParticipatesSecondary: s(ivr?.providerParticipatesSecondary),
    woundType: s(ivr?.woundType),
    woundSizes: s(ivr?.woundSizes),
    applicationCpts: s(ivr?.applicationCpts),
    dateOfProcedure: s(ivr?.dateOfProcedure),
    icd10Codes: s(ivr?.icd10Codes),
    productInformation: s(ivr?.productInformation),
    isPatientAtSnf: ivr?.isPatientAtSnf ?? null,
    surgicalGlobalPeriod: ivr?.surgicalGlobalPeriod ?? null,
    globalPeriodCpt: s(ivr?.globalPeriodCpt),
    priorAuthPermission: ivr?.priorAuthPermission ?? null,
    specialtySiteName: s(ivr?.specialtySiteName),
    physicianSignature: s(ivr?.physicianSignature),
    physicianSignatureDate: s(ivr?.physicianSignatureDate),
    physicianSignedAt:  ivr?.physicianSignedAt  ?? null,
    physicianSignedBy:  ivr?.physicianSignedBy  ?? null,
    // Chronic-only — numbers stringified for input controls.
    groupNumber: s(ivr?.groupNumber),
    planName: s(ivr?.planName),
    subscriberRelationship: s(ivr?.subscriberRelationship),
    coverageStartDate: s(ivr?.coverageStartDate),
    coverageEndDate: s(ivr?.coverageEndDate),
    secondaryGroupNumber: s(ivr?.secondaryGroupNumber),
    secondarySubscriberRelationship: s(ivr?.secondarySubscriberRelationship),
    deductibleAmount: ivr?.deductibleAmount != null ? String(ivr.deductibleAmount) : "",
    deductibleMet: ivr?.deductibleMet != null ? String(ivr.deductibleMet) : "",
    outOfPocketMax: ivr?.outOfPocketMax != null ? String(ivr.outOfPocketMax) : "",
    outOfPocketMet: ivr?.outOfPocketMet != null ? String(ivr.outOfPocketMet) : "",
    copayAmount: ivr?.copayAmount != null ? String(ivr.copayAmount) : "",
    coinsurancePercent: ivr?.coinsurancePercent != null ? String(ivr.coinsurancePercent) : "",
    dmeCovered: typeof ivr?.dmeCovered === "boolean" ? ivr.dmeCovered : null,
    woundCareCovered: typeof ivr?.woundCareCovered === "boolean" ? ivr.woundCareCovered : null,
    priorAuthRequired: typeof ivr?.priorAuthRequired === "boolean" ? ivr.priorAuthRequired : null,
    priorAuthNumber: s(ivr?.priorAuthNumber),
    unitsAuthorized: ivr?.unitsAuthorized != null ? String(ivr.unitsAuthorized) : "",
    priorAuthStartDate: s(ivr?.priorAuthStartDate),
    priorAuthEndDate: s(ivr?.priorAuthEndDate),
    verifiedBy: s(ivr?.verifiedBy),
    verifiedDate: s(ivr?.verifiedDate),
    verificationReference: s(ivr?.verificationReference),
    notes: s(ivr?.notes),
  };
}

/* ── Paper-form primitives ── */

function FormCheckbox({
  checked,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1 select-none cursor-pointer",
        className,
      )}
    >
      <span
        onClick={() => onChange(!checked)}
        className={cn(
          "w-3.5 h-3.5 border-[1.5px] flex items-center justify-center shrink-0 transition-colors",
          checked ? "border-[#0d7a6b] bg-[#0d7a6b]" : "border-[#666] bg-white",
        )}
      >
        {checked && (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        )}
      </span>
      <span className="text-[12px] text-[#333] leading-none">{label}</span>
    </label>
  );
}

function FormInput({
  value,
  onChange,
  deficient,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "required"> & {
  value: string;
  onChange: (v: string) => void;
  deficient?: boolean;
}) {
  const isDeficient = deficient && !value;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isDeficient ? "Required" : props.placeholder}
      className={cn(
        "border-0 border-b text-[13px] outline-none bg-transparent",
        "focus:border-[#0d7a6b] transition-colors px-1 py-0.5 leading-tight text-[#222]",
        isDeficient
          ? "border-red-400 placeholder:text-red-400"
          : "border-[#333] placeholder:text-[#bbb]",
        className,
      )}
      {...props}
    />
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  minRows = 2,
  className,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={minRows}
      className={cn(
        "w-full border border-[#ccc] text-[13px] text-[#222] outline-none resize-none overflow-hidden",
        "focus:border-[#0d7a6b] transition-colors px-2 py-1.5 leading-relaxed bg-white",
        "placeholder:text-[#bbb]",
        className,
      )}
      style={{ minHeight: `${minRows * 20}px` }}
      {...props}
    />
  );
}

/* Bold uppercase section label */
function FL({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-bold uppercase tracking-wide text-[#333] shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Section header bar */
function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide text-white w-full mt-3"
      style={{ backgroundColor: NAVY }}
    >
      {title}
    </div>
  );
}

/* Two-column grid within a section */
function TwoCol({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-2 px-2 pt-2 pb-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* Single labeled field block */
function FieldBlock({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <FL>{label}</FL>
      {children}
    </div>
  );
}

/* YES / NO radio pair */
function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <FL>{label}</FL>}
      <FormCheckbox
        checked={value === true}
        onChange={() => onChange(true)}
        label="Yes"
      />
      <FormCheckbox
        checked={value === false}
        onChange={() => onChange(false)}
        label="No"
      />
    </div>
  );
}

/* YES / NO / Not Sure triple */
function TriRadio({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-3">
      {["Yes", "No", "Not Sure"].map((opt) => (
        <FormCheckbox
          key={opt}
          checked={value === opt}
          onChange={() => onChange(value === opt ? "" : opt)}
          label={opt}
        />
      ))}
    </div>
  );
}

/* ── IVR wound types ── */
const IVR_WOUND_TYPES = [
  { value: "Diabetic Foot Ulcer", label: "Diabetic Foot Ulcer" },
  { value: "Venous Leg Ulcer", label: "Venous Leg Ulcer" },
  { value: "Pressure Ulcer", label: "Pressure Ulcer" },
  { value: "Traumatic Burns", label: "Traumatic Burns" },
  { value: "Radiation Burns", label: "Radiation Burns" },
  { value: "Necrotizing Fasciitis", label: "Necrotizing Fasciitis" },
  { value: "Dehisced Surgical Wound", label: "Dehisced Surgical Wound" },
] as const;

const KNOWN_PRODUCTS = [
  "CompleteAA",
  "Membrane Wrap",
  "Hydro Membrane Wrap",
  "WoundPlus",
  "ESANO",
] as const;

function parseProducts(str: string): {
  selected: Set<string>;
  otherText: string;
} {
  const parts = str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selected = new Set<string>();
  let otherText = "";
  for (const p of parts) {
    const known = KNOWN_PRODUCTS.find((k) => p === k);
    if (known) {
      selected.add(known);
    } else if (p.startsWith("Other:")) {
      otherText = p.slice(6).trim();
    } else {
      otherText = p;
    }
  }
  return { selected, otherText };
}

function buildProductString(selected: Set<string>, otherText: string): string {
  const parts = KNOWN_PRODUCTS.filter((k) => selected.has(k)) as string[];
  if (otherText.trim()) parts.push(`Other: ${otherText.trim()}`);
  return parts.join(", ");
}

/* ── Component props ── */
interface IVRFormDocumentProps {
  order: DashboardOrder;
  ivrData: Partial<IOrderIVR> | null;
  canEdit: boolean;
  canSign: boolean;
  currentUserName: string | null;
  onSaved?: (saved: Partial<IOrderIVR>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function IVRFormDocument({
  order,
  ivrData,
  canEdit,
  canSign,
  currentUserName,
  onSaved,
  onDirtyChange,
}: IVRFormDocumentProps) {
  const orderId = order.id;
  // Template variant — chronic gets the full back-office IVR (Benefits &
  // Coverage, Verification, extended insurance, detailed Prior Auth).
  // Post-surgical renders the lean physician-facing form per the client's
  // template. Bound to order.wound_type so subtype edits in the form don't
  // flip the variant mid-session.
  const isPostSurgical = order.wound_type === "post_surgical";
  const [formData, setFormData] = useState<IVRFormState>(() =>
    buildFormState(ivrData),
  );
  const [baseline, setBaseline] = useState<IVRFormState>(() =>
    buildFormState(ivrData),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  // Anchor for the "please sign before saving" auto-scroll behavior.
  const signatureSectionRef = useRef<HTMLDivElement | null>(null);
  // Session-only specimen signature. Same rationale as OrderFormDocument.
  const [specimenSignatureUrl, setSpecimenSignatureUrl] = useState<string | null>(
    ivrData?.physicianSignatureImage ?? null,
  );
  // Resync from the server copy on load / parent refresh.
  useEffect(() => {
    setSpecimenSignatureUrl(ivrData?.physicianSignatureImage ?? null);
  }, [ivrData?.physicianSignatureImage]);
  // PIN buffered from the sign modal, committed at save-time.
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  useEffect(() => {
    const snap = buildFormState(ivrData);
    setFormData(snap);
    setBaseline(snap);
  }, [ivrData?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable — set once on mount from the initial ivrData; survives parent re-renders
  // caused by onSaved callbacks that replace ivrData with a payload lacking aiExtracted.
  const [aiExtracted] = useState(() => ivrData?.aiExtracted ?? false);

  const deficiencyCount = useMemo(() => {
    if (!aiExtracted) return 0;
    const f = formData;
    const requiredText = [
      f.salesRepName,
      f.facilityName,
      f.medicareAdminContractor,
      f.facilityAddress,
      f.facilityNpi,
      f.facilityContact,
      f.facilityTin,
      f.facilityPhone,
      f.facilityPtan,
      f.facilityFax,
      f.physicianName,
      f.physicianFax,
      f.physicianAddress,
      f.physicianNpi,
      f.physicianTin,
      f.patientName,
      f.patientPhone,
      f.patientAddress,
      f.patientDob,
      f.subscriberName,
      f.memberId,
      f.subscriberDob,
      f.insurancePhone,
      f.woundSizes,
      f.applicationCpts,
      f.dateOfProcedure,
      f.icd10Codes,
    ];
    const requiredSelect = [
      f.placeOfService,
      f.planType,
      f.woundType,
      f.productInformation,
      f.okToContactPatient !== null ? "ok" : "",
      f.providerParticipatesPrimary,
    ];
    return [...requiredText, ...requiredSelect].filter((v) => !v || v === "")
      .length;
  }, [aiExtracted, formData]);

  function set<K extends keyof IVRFormState>(key: K, value: IVRFormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleDiscard() {
    setFormData(baseline);
    setPendingPin(null);
    if (!baseline.physicianSignedAt) {
      setSpecimenSignatureUrl(null);
    }
  }

  async function handleSave() {
    setIsSaving(true);

    // Detect sign-state change relative to last saved baseline.
    const wasSigned = !!baseline.physicianSignedAt;
    const isSigned = !!formData.physicianSignedAt;
    const signIntent: "sign" | "unsign" | "none" = !wasSigned && isSigned
      ? "sign"
      : wasSigned && !isSigned
        ? "unsign"
        : "none";

    if (signIntent === "sign" && (!pendingPin || !specimenSignatureUrl)) {
      setIsSaving(false);
      toast.error("Signature data missing — please re-open Sign.");
      return;
    }

    const ns = (v: string) => v.trim() || null;
    // physicianSignedAt/By intentionally omitted — committed via
    // signIVRWithSpecimen / unsignIVR below so they never land in the DB
    // without a PIN check.
    const payload: Partial<IOrderIVR> = {
      salesRepName: ns(formData.salesRepName),
      placeOfService: ns(formData.placeOfService),
      facilityName: ns(formData.facilityName),
      medicareAdminContractor: ns(formData.medicareAdminContractor),
      facilityAddress: ns(formData.facilityAddress),
      facilityNpi: ns(formData.facilityNpi),
      facilityContact: ns(formData.facilityContact),
      facilityTin: ns(formData.facilityTin),
      facilityPhone: ns(formData.facilityPhone),
      facilityPtan: ns(formData.facilityPtan),
      facilityFax: ns(formData.facilityFax),
      physicianName: ns(formData.physicianName),
      physicianFax: ns(formData.physicianFax),
      physicianAddress: ns(formData.physicianAddress),
      physicianNpi: ns(formData.physicianNpi),
      physicianPhone: ns(formData.physicianPhone),
      physicianTin: ns(formData.physicianTin),
      patientName: ns(formData.patientName),
      patientPhone: ns(formData.patientPhone),
      patientAddress: ns(formData.patientAddress),
      okToContactPatient: formData.okToContactPatient,
      patientDob: ns(formData.patientDob),
      subscriberName: ns(formData.subscriberName),
      memberId: ns(formData.memberId),
      subscriberDob: ns(formData.subscriberDob),
      planType: ns(formData.planType),
      insurancePhone: ns(formData.insurancePhone),
      providerParticipatesPrimary: ns(formData.providerParticipatesPrimary),
      secondarySubscriberName: ns(formData.secondarySubscriberName),
      secondaryPolicyNumber: ns(formData.secondaryPolicyNumber),
      secondarySubscriberDob: ns(formData.secondarySubscriberDob),
      secondaryPlanType: ns(formData.secondaryPlanType),
      secondaryInsurancePhone: ns(formData.secondaryInsurancePhone),
      providerParticipatesSecondary: ns(formData.providerParticipatesSecondary),
      woundType: ns(formData.woundType),
      woundSizes: ns(formData.woundSizes),
      applicationCpts: ns(formData.applicationCpts),
      dateOfProcedure: ns(formData.dateOfProcedure),
      icd10Codes: ns(formData.icd10Codes),
      productInformation: ns(formData.productInformation),
      isPatientAtSnf: formData.isPatientAtSnf,
      surgicalGlobalPeriod: formData.surgicalGlobalPeriod,
      globalPeriodCpt: ns(formData.globalPeriodCpt),
      priorAuthPermission: formData.priorAuthPermission,
      specialtySiteName: ns(formData.specialtySiteName),
      physicianSignature: ns(formData.physicianSignature),
      physicianSignatureDate: ns(formData.physicianSignatureDate),
      // Chronic-only fields. Persist for post-surgical too so toggling
      // wound_type doesn't destroy data — the UI just hides them.
      groupNumber: ns(formData.groupNumber),
      planName: ns(formData.planName),
      subscriberRelationship: ns(formData.subscriberRelationship),
      coverageStartDate: ns(formData.coverageStartDate),
      coverageEndDate: ns(formData.coverageEndDate),
      secondaryGroupNumber: ns(formData.secondaryGroupNumber),
      secondarySubscriberRelationship: ns(formData.secondarySubscriberRelationship),
      deductibleAmount: formData.deductibleAmount.trim() === "" ? null : Number(formData.deductibleAmount),
      deductibleMet: formData.deductibleMet.trim() === "" ? null : Number(formData.deductibleMet),
      outOfPocketMax: formData.outOfPocketMax.trim() === "" ? null : Number(formData.outOfPocketMax),
      outOfPocketMet: formData.outOfPocketMet.trim() === "" ? null : Number(formData.outOfPocketMet),
      copayAmount: formData.copayAmount.trim() === "" ? null : Number(formData.copayAmount),
      coinsurancePercent: formData.coinsurancePercent.trim() === "" ? null : Number(formData.coinsurancePercent),
      dmeCovered: formData.dmeCovered === true,
      woundCareCovered: formData.woundCareCovered === true,
      priorAuthRequired: formData.priorAuthRequired === true,
      priorAuthNumber: ns(formData.priorAuthNumber),
      unitsAuthorized: formData.unitsAuthorized.trim() === "" ? null : Number(formData.unitsAuthorized),
      priorAuthStartDate: ns(formData.priorAuthStartDate),
      priorAuthEndDate: ns(formData.priorAuthEndDate),
      verifiedBy: ns(formData.verifiedBy),
      verifiedDate: ns(formData.verifiedDate),
      verificationReference: ns(formData.verificationReference),
      notes: ns(formData.notes),
    };
    const result = await upsertOrderIVR(orderId, payload);
    if (!result.success) {
      setIsSaving(false);
      toast.error(result.error ?? "Failed to save.");
      return;
    }

    // Commit sign/unsign if the local diff implies one — each branch also
    // regenerates the IVR PDF with the correct signed/unsigned rendering.
    if (signIntent === "sign") {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "additional_ivr", status: "start" },
        }),
      );
      const signRes = await signIVRWithSpecimen(
        orderId,
        pendingPin as string,
        specimenSignatureUrl as string,
      );
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "additional_ivr", status: "done" },
        }),
      );
      if (!signRes.success) {
        setIsSaving(false);
        toast.error(signRes.error ?? "Sign failed — PIN may be wrong.");
        return;
      }
    } else if (signIntent === "unsign") {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "additional_ivr", status: "start" },
        }),
      );
      const unsignRes = await unsignIVR(orderId);
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "additional_ivr", status: "done" },
        }),
      );
      if (!unsignRes.success) {
        setIsSaving(false);
        toast.error(unsignRes.error ?? "Failed to unsign.");
        return;
      }
    } else {
      // Field-only save — regenerate PDF via the standard endpoint.
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "additional_ivr", status: "start" },
        }),
      );
      fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formType: "ivr" }),
      })
        .catch((err) => console.error("[IVRForm] PDF generation failed:", err))
        .finally(() => {
          window.dispatchEvent(
            new CustomEvent("pdf-regenerating", {
              detail: { type: "additional_ivr", status: "done" },
            }),
          );
        });
    }

    setIsSaving(false);
    toast.success(
      signIntent === "sign"
        ? "IVR signed + saved."
        : signIntent === "unsign"
          ? "Unsigned + saved."
          : "IVR form saved.",
    );
    setBaseline({ ...formData });
    onSaved?.(payload);
    setPendingPin(null);
    if (signIntent === "unsign") {
      setSpecimenSignatureUrl(null);
    }
  }

  /* ── Render ── */
  return (
    <div className="relative">
      <FormActionBar
        label="IVR Form"
        isDirty={isDirty && canEdit}
        isPending={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* ── Deficiency banner ── */}
      <FormDeficiencyBanner
        aiExtracted={aiExtracted}
        deficiencyCount={deficiencyCount}
      />

      {/* ════════════════════════════════════════════
          PAPER DOCUMENT
          ════════════════════════════════════════════ */}
      <div
        className="mx-auto bg-white border border-[#ddd] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        style={{
          maxWidth: 800,
          padding: "28px 32px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* ── 1. HEADER ── */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="[&>span>span:last-child]:hidden shrink-0">
              <HBLogo variant="light" size="lg" asLink={false} />
            </div>
            <div>
              <div
                className="text-[17px] font-bold tracking-widest leading-none"
                style={{ color: NAVY }}
              >
                MERIDIAN
              </div>
              <div
                className="text-[10px] font-semibold tracking-wider leading-tight mt-0.5"
                style={{ color: TEAL }}
              >
                SURGICAL SUPPLIES
              </div>
              <div
                className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 leading-tight"
                style={{ color: TEAL }}
              >
                Empowering Patients From Their Home
              </div>
            </div>
          </div>
          <div className="text-right space-y-0.5">
            {[
              {
                Icon: MapPin,
                text: "235 Singleton Ridge Road Suite 105, Conway SC 29526",
              },
              { Icon: Mail, text: "Support@meridiansurgicalsupplies.com" },
              { Icon: Globe, text: "www.meridiansurgicalsupplies.com" },
              { Icon: Phone, text: "(843) 733-9261" },
            ].map(({ Icon, text }) => (
              <div
                key={text}
                className="flex items-center justify-end gap-1 text-[10px] text-[#555]"
              >
                <Icon className="w-2.5 h-2.5 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form title */}
        <div className="text-center py-2.5">
          <h1
            className="font-serif text-[18px] font-medium tracking-wide"
            style={{ color: NAVY }}
          >
            Patient Insurance Support Form
          </h1>
          <div
            className="mx-auto mt-1.5 w-28 border-b-2"
            style={{ borderColor: TEAL }}
          />
          <p className="text-[11px] text-[#555] mt-1.5">
            Please fax completed form to toll-free HIPAA compliant fax:{" "}
            <strong>223.336.4751</strong>
          </p>
          <p className="text-[11px] text-[#555]">
            Or email to <strong>Reimbursement@MeridianSurgical.com</strong>
          </p>
        </div>

        {/* ── 2. SALES REP ── */}
        <div className="flex items-end gap-2 py-2 border-b border-[#e5e5e5]">
          <FL>Sales Rep</FL>
          <FormInput
            value={formData.salesRepName}
            onChange={(v) => set("salesRepName", v)}
            deficient={aiExtracted}
            className="flex-1 max-w-xs"
            placeholder="Sales representative name"
            disabled={!canEdit}
          />
        </div>

        {/* ── 3. FACILITY INFORMATION ── */}
        <SectionHeader title="Facility Information" />
        <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5]">
          {/* Place of Service — full-width row */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 rounded px-1",
              aiExtracted &&
                !formData.placeOfService &&
                "bg-red-50/50 ring-1 ring-red-300",
            )}
          >
            <FL>Place of Service</FL>
            {[
              "Office",
              "Outpatient Hospital",
              "Ambulatory Surgical Center",
              "Other",
            ].map((pos) => (
              <FormCheckbox
                key={pos}
                checked={formData.placeOfService === pos}
                onChange={(checked) =>
                  set("placeOfService", checked ? pos : "")
                }
                label={pos}
              />
            ))}
          </div>
          <TwoCol className="px-0">
            <FieldBlock label="Facility Name">
              <FormInput
                value={formData.facilityName}
                onChange={(v) => set("facilityName", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Medicare Admin Contractor">
              <FormInput
                value={formData.medicareAdminContractor}
                onChange={(v) => set("medicareAdminContractor", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Address">
              <FormInput
                value={formData.facilityAddress}
                onChange={(v) => set("facilityAddress", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="NPI">
              <FormInput
                value={formData.facilityNpi}
                onChange={(v) => set("facilityNpi", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Contact Name">
              <FormInput
                value={formData.facilityContact}
                onChange={(v) => set("facilityContact", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="TIN">
              <FormInput
                value={formData.facilityTin}
                onChange={(v) => set("facilityTin", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Phone">
              <FormInput
                value={formData.facilityPhone}
                onChange={(v) => set("facilityPhone", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="PTAN">
              <FormInput
                value={formData.facilityPtan}
                onChange={(v) => set("facilityPtan", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Fax" className="col-span-1">
              <FormInput
                value={formData.facilityFax}
                onChange={(v) => set("facilityFax", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
          </TwoCol>
        </div>

        {/* ── 4. PHYSICIAN INFORMATION ── */}
        <SectionHeader title="Physician Information" />
        <div className="border-b border-[#e5e5e5]">
          <TwoCol>
            <FieldBlock label="Physician Name">
              <FormInput
                value={formData.physicianName}
                onChange={(v) => set("physicianName", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Fax">
              <FormInput
                value={formData.physicianFax}
                onChange={(v) => set("physicianFax", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Address">
              <FormInput
                value={formData.physicianAddress}
                onChange={(v) => set("physicianAddress", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="NPI">
              <FormInput
                value={formData.physicianNpi}
                onChange={(v) => set("physicianNpi", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Phone">
              <FormInput
                value={formData.physicianPhone}
                onChange={(v) => set("physicianPhone", v)}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="TIN">
              <FormInput
                value={formData.physicianTin}
                onChange={(v) => set("physicianTin", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
          </TwoCol>
        </div>

        {/* ── 5. PATIENT INFORMATION ── */}
        <SectionHeader title="Patient Information" />
        <div className="border-b border-[#e5e5e5]">
          <TwoCol>
            <FieldBlock label="Patient Name">
              <FormInput
                value={formData.patientName}
                onChange={(v) => set("patientName", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Phone">
              <FormInput
                value={formData.patientPhone}
                onChange={(v) => set("patientPhone", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock
              label="Address (City / State / Zip)"
              className="col-span-2"
            >
              <FormInput
                value={formData.patientAddress}
                onChange={(v) => set("patientAddress", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Date of Birth">
              <FormInput
                value={formData.patientDob}
                onChange={(v) => set("patientDob", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
                placeholder="MM/DD/YYYY"
              />
            </FieldBlock>
            <div className="flex flex-col gap-0.5">
              <FL>OK to Contact Patient?</FL>
              <div
                className={cn(
                  "flex gap-3 py-0.5 rounded px-1",
                  aiExtracted &&
                    formData.okToContactPatient === null &&
                    "bg-red-50/50 ring-1 ring-red-300",
                )}
              >
                <FormCheckbox
                  checked={formData.okToContactPatient === true}
                  onChange={() =>
                    set(
                      "okToContactPatient",
                      formData.okToContactPatient === true ? null : true,
                    )
                  }
                  label="Yes"
                />
                <FormCheckbox
                  checked={formData.okToContactPatient === false}
                  onChange={() =>
                    set(
                      "okToContactPatient",
                      formData.okToContactPatient === false ? null : false,
                    )
                  }
                  label="No"
                />
              </div>
            </div>
          </TwoCol>
        </div>

        {/* ── 6. INSURANCE INFORMATION ── */}
        <SectionHeader title="Insurance Information" />
        <div className="border-b border-[#e5e5e5]">
          <div className="grid grid-cols-2 divide-x divide-[#e5e5e5]">
            {/* Primary */}
            <div className="pr-4 pt-2 pb-1 pl-2 space-y-2">
              <div
                className="text-[11px] font-bold tracking-wide pb-1 border-b border-[#e5e5e5]"
                style={{ color: NAVY }}
              >
                Primary Insurance
              </div>
              <FieldBlock label="Subscriber Name">
                <FormInput
                  value={formData.subscriberName}
                  onChange={(v) => set("subscriberName", v)}
                  deficient={aiExtracted}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <FieldBlock label="Policy / Member ID">
                <FormInput
                  value={formData.memberId}
                  onChange={(v) => set("memberId", v)}
                  deficient={aiExtracted}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <FieldBlock label="Subscriber DOB">
                <FormInput
                  value={formData.subscriberDob}
                  onChange={(v) => set("subscriberDob", v)}
                  deficient={aiExtracted}
                  className="w-full"
                  placeholder="MM/DD/YYYY"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <div className="flex flex-col gap-0.5">
                <FL>Type of Plan</FL>
                <div
                  className={cn(
                    "flex flex-wrap gap-3 rounded px-1",
                    aiExtracted &&
                      !formData.planType &&
                      "bg-red-50/50 ring-1 ring-red-300",
                  )}
                >
                  {["HMO", "PPO", "Other"].map((t) => (
                    <FormCheckbox
                      key={t}
                      checked={formData.planType === t}
                      onChange={() =>
                        set("planType", formData.planType === t ? "" : t)
                      }
                      label={t}
                    />
                  ))}
                </div>
              </div>
              <FieldBlock label="Insurance Phone Number">
                <FormInput
                  value={formData.insurancePhone}
                  onChange={(v) => set("insurancePhone", v)}
                  deficient={aiExtracted}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <div className="flex flex-col gap-0.5">
                <FL>Does Provider Participate with Network?</FL>
                <div
                  className={cn(
                    "rounded px-1",
                    aiExtracted &&
                      !formData.providerParticipatesPrimary &&
                      "bg-red-50/50 ring-1 ring-red-300",
                  )}
                >
                  <TriRadio
                    value={formData.providerParticipatesPrimary}
                    onChange={(v) => set("providerParticipatesPrimary", v)}
                  />
                </div>
              </div>
            </div>

            {/* Secondary */}
            <div className="pl-4 pt-2 pb-1 pr-2 space-y-2">
              <div
                className="text-[11px] font-bold tracking-wide pb-1 border-b border-[#e5e5e5]"
                style={{ color: NAVY }}
              >
                Secondary Insurance
              </div>
              <FieldBlock label="Subscriber Name">
                <FormInput
                  value={formData.secondarySubscriberName}
                  onChange={(v) => set("secondarySubscriberName", v)}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <FieldBlock label="Policy Number">
                <FormInput
                  value={formData.secondaryPolicyNumber}
                  onChange={(v) => set("secondaryPolicyNumber", v)}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <FieldBlock label="Subscriber DOB">
                <FormInput
                  value={formData.secondarySubscriberDob}
                  onChange={(v) => set("secondarySubscriberDob", v)}
                  className="w-full"
                  placeholder="MM/DD/YYYY"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <div className="flex flex-col gap-0.5">
                <FL>Type of Plan</FL>
                <div className="flex flex-wrap gap-3">
                  {["HMO", "PPO", "Other"].map((t) => (
                    <FormCheckbox
                      key={t}
                      checked={formData.secondaryPlanType === t}
                      onChange={() =>
                        set(
                          "secondaryPlanType",
                          formData.secondaryPlanType === t ? "" : t,
                        )
                      }
                      label={t}
                    />
                  ))}
                </div>
              </div>
              <FieldBlock label="Insurance Phone Number">
                <FormInput
                  value={formData.secondaryInsurancePhone}
                  onChange={(v) => set("secondaryInsurancePhone", v)}
                  className="w-full"
                  disabled={!canEdit}
                />
              </FieldBlock>
              <div className="flex flex-col gap-0.5">
                <FL>Does Provider Participate with Network?</FL>
                <TriRadio
                  value={formData.providerParticipatesSecondary}
                  onChange={(v) => set("providerParticipatesSecondary", v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 6b. CHRONIC-ONLY SUPPLEMENTAL SECTIONS ──
            Back-office fields populated after the insurance call. Not on the
            post-surgical physician-facing template. Data persists in DB even
            when hidden, so switching wound_type is non-destructive. */}
        {!isPostSurgical && (
          <>
            {/* Insurance details — Primary */}
            <SectionHeader title="Insurance Details — Primary" />
            <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
              <TwoCol className="px-0">
                <FieldBlock label="Group Number">
                  <FormInput
                    value={formData.groupNumber}
                    onChange={(v) => set("groupNumber", v)}
                    className="w-full"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Plan Name">
                  <FormInput
                    value={formData.planName}
                    onChange={(v) => set("planName", v)}
                    className="w-full"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Subscriber Relationship">
                  <div className="flex flex-wrap gap-3 pt-0.5">
                    {["Self", "Spouse", "Child", "Other"].map((t) => (
                      <FormCheckbox
                        key={t}
                        checked={formData.subscriberRelationship === t}
                        onChange={() =>
                          set(
                            "subscriberRelationship",
                            formData.subscriberRelationship === t ? "" : t,
                          )
                        }
                        label={t}
                      />
                    ))}
                  </div>
                </FieldBlock>
                <FieldBlock label="Coverage Start">
                  <FormInput
                    value={formData.coverageStartDate}
                    onChange={(v) => set("coverageStartDate", v)}
                    className="w-full"
                    placeholder="MM/DD/YYYY"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Coverage End">
                  <FormInput
                    value={formData.coverageEndDate}
                    onChange={(v) => set("coverageEndDate", v)}
                    className="w-full"
                    placeholder="MM/DD/YYYY"
                    disabled={!canEdit}
                  />
                </FieldBlock>
              </TwoCol>
            </div>

            {/* Insurance details — Secondary */}
            <SectionHeader title="Insurance Details — Secondary" />
            <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
              <TwoCol className="px-0">
                <FieldBlock label="Group Number">
                  <FormInput
                    value={formData.secondaryGroupNumber}
                    onChange={(v) => set("secondaryGroupNumber", v)}
                    className="w-full"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Subscriber Relationship">
                  <div className="flex flex-wrap gap-3 pt-0.5">
                    {["Self", "Spouse", "Child", "Other"].map((t) => (
                      <FormCheckbox
                        key={t}
                        checked={formData.secondarySubscriberRelationship === t}
                        onChange={() =>
                          set(
                            "secondarySubscriberRelationship",
                            formData.secondarySubscriberRelationship === t ? "" : t,
                          )
                        }
                        label={t}
                      />
                    ))}
                  </div>
                </FieldBlock>
              </TwoCol>
            </div>

            {/* Benefits & Coverage */}
            <SectionHeader title="Benefits & Coverage" />
            <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
              <TwoCol className="px-0">
                <FieldBlock label="Deductible Amount">
                  <FormInput
                    value={formData.deductibleAmount}
                    onChange={(v) => set("deductibleAmount", v)}
                    className="w-full"
                    placeholder="$"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Deductible Met">
                  <FormInput
                    value={formData.deductibleMet}
                    onChange={(v) => set("deductibleMet", v)}
                    className="w-full"
                    placeholder="$"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Out of Pocket Max">
                  <FormInput
                    value={formData.outOfPocketMax}
                    onChange={(v) => set("outOfPocketMax", v)}
                    className="w-full"
                    placeholder="$"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Out of Pocket Met">
                  <FormInput
                    value={formData.outOfPocketMet}
                    onChange={(v) => set("outOfPocketMet", v)}
                    className="w-full"
                    placeholder="$"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Copay Amount">
                  <FormInput
                    value={formData.copayAmount}
                    onChange={(v) => set("copayAmount", v)}
                    className="w-full"
                    placeholder="$"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Coinsurance %">
                  <FormInput
                    value={formData.coinsurancePercent}
                    onChange={(v) => set("coinsurancePercent", v)}
                    className="w-full"
                    placeholder="%"
                    disabled={!canEdit}
                  />
                </FieldBlock>
              </TwoCol>
              <div className="pt-1 space-y-2">
                <YesNo
                  label="DME Covered?"
                  value={formData.dmeCovered}
                  onChange={(v) => set("dmeCovered", v)}
                />
                <YesNo
                  label="Wound Care Covered?"
                  value={formData.woundCareCovered}
                  onChange={(v) => set("woundCareCovered", v)}
                />
              </div>
            </div>

            {/* Prior Authorization — detailed */}
            <SectionHeader title="Prior Authorization" />
            <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
              <YesNo
                label="Prior Auth Required?"
                value={formData.priorAuthRequired}
                onChange={(v) => set("priorAuthRequired", v)}
              />
              {formData.priorAuthRequired === true && (
                <TwoCol className="px-0">
                  <FieldBlock label="Auth Number">
                    <FormInput
                      value={formData.priorAuthNumber}
                      onChange={(v) => set("priorAuthNumber", v)}
                      className="w-full"
                      disabled={!canEdit}
                    />
                  </FieldBlock>
                  <FieldBlock label="Units Authorized">
                    <FormInput
                      value={formData.unitsAuthorized}
                      onChange={(v) => set("unitsAuthorized", v)}
                      className="w-full"
                      disabled={!canEdit}
                    />
                  </FieldBlock>
                  <FieldBlock label="Auth Start Date">
                    <FormInput
                      value={formData.priorAuthStartDate}
                      onChange={(v) => set("priorAuthStartDate", v)}
                      className="w-full"
                      placeholder="MM/DD/YYYY"
                      disabled={!canEdit}
                    />
                  </FieldBlock>
                  <FieldBlock label="Auth End Date">
                    <FormInput
                      value={formData.priorAuthEndDate}
                      onChange={(v) => set("priorAuthEndDate", v)}
                      className="w-full"
                      placeholder="MM/DD/YYYY"
                      disabled={!canEdit}
                    />
                  </FieldBlock>
                </TwoCol>
              )}
            </div>
          </>
        )}

        {/* ── 7. WOUND INFORMATION ── */}
        <SectionHeader title="Wound Information" />
        <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
          <div>
            <FL className="block mb-1">Wound Type</FL>
            <div
              className={cn(
                "flex flex-wrap gap-x-4 gap-y-1 rounded px-1",
                aiExtracted &&
                  !formData.woundType &&
                  "bg-red-50/50 ring-1 ring-red-300",
              )}
            >
              {IVR_WOUND_TYPES.map(({ value, label }) => (
                <FormCheckbox
                  key={value}
                  checked={formData.woundType === value}
                  onChange={() =>
                    set("woundType", formData.woundType === value ? "" : value)
                  }
                  label={label}
                />
              ))}
              {(() => {
                const isOther =
                  !!formData.woundType &&
                  !IVR_WOUND_TYPES.some((t) => t.value === formData.woundType);
                return (
                  <>
                    <FormCheckbox
                      checked={isOther}
                      onChange={(checked) => {
                        if (!checked) set("woundType", "");
                      }}
                      label="Other"
                    />
                    {isOther && (
                      <FormInput
                        value={formData.woundType}
                        onChange={(v) => set("woundType", v)}
                        className="w-28"
                        placeholder="Specify"
                        disabled={!canEdit}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <TwoCol className="px-0">
            <FieldBlock label="Wound Size(s)">
              <FormInput
                value={formData.woundSizes}
                onChange={(v) => set("woundSizes", v)}
                deficient={aiExtracted}
                className="w-full"
                placeholder="e.g. 3cm × 2cm × 0.5cm"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Application CPT(s)">
              <FormInput
                value={formData.applicationCpts}
                onChange={(v) => set("applicationCpts", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="Date of Procedure">
              <FormInput
                value={formData.dateOfProcedure}
                onChange={(v) => set("dateOfProcedure", v)}
                deficient={aiExtracted}
                className="w-full"
                placeholder="MM/DD/YYYY"
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label="ICD-10 Diagnosis Code(s)">
              <FormInput
                value={formData.icd10Codes}
                onChange={(v) => set("icd10Codes", v)}
                deficient={aiExtracted}
                className="w-full"
                disabled={!canEdit}
              />
            </FieldBlock>
          </TwoCol>
          <div>
            <FL className="block mb-1">Product Information</FL>
            {(() => {
              const { selected, otherText } = parseProducts(
                formData.productInformation,
              );
              const isOtherChecked = !!otherText;
              return (
                <div
                  className={cn(
                    "flex flex-wrap gap-x-4 gap-y-1 rounded px-1",
                    aiExtracted &&
                      !formData.productInformation &&
                      "bg-red-50/50 ring-1 ring-red-300",
                  )}
                >
                  {KNOWN_PRODUCTS.map((product) => (
                    <FormCheckbox
                      key={product}
                      checked={selected.has(product)}
                      onChange={(checked) => {
                        const next = new Set(selected);
                        checked ? next.add(product) : next.delete(product);
                        set(
                          "productInformation",
                          buildProductString(next, otherText),
                        );
                      }}
                      label={product}
                    />
                  ))}
                  <FormCheckbox
                    checked={isOtherChecked}
                    onChange={(checked) => {
                      set(
                        "productInformation",
                        buildProductString(selected, checked ? " " : ""),
                      );
                    }}
                    label="Other:"
                  />
                  <FormInput
                    value={otherText}
                    onChange={(v) =>
                      set("productInformation", buildProductString(selected, v))
                    }
                    className="w-28"
                    placeholder="Specify"
                    disabled={!canEdit}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── 8. ADDITIONAL INFORMATION ── */}
        <SectionHeader title="Additional Information" />
        <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
          <YesNo
            label="Is the patient currently residing in SNF?"
            value={formData.isPatientAtSnf}
            onChange={(v) => set("isPatientAtSnf", v)}
          />
          <YesNo
            label="Is the patient under a surgical Global Period?"
            value={formData.surgicalGlobalPeriod}
            onChange={(v) => set("surgicalGlobalPeriod", v)}
          />
          <FieldBlock label="CPT Code (if global period)">
            <FormInput
              value={formData.globalPeriodCpt}
              onChange={(v) => set("globalPeriodCpt", v)}
              className="w-48"
              disabled={!canEdit}
            />
          </FieldBlock>
          <div className="flex items-start gap-2 pt-1">
            <FormCheckbox
              checked={formData.priorAuthPermission === true}
              onChange={(checked) =>
                set("priorAuthPermission", checked ? true : null)
              }
              label=""
            />
            <p className="text-[12px] text-[#333] leading-snug">
              If Prior Authorization is Required, check here to allow us to work
              with payer on your behalf.
            </p>
          </div>
          <p className="text-[11px] text-[#666] italic">
            Please attach a copy of the patient&apos;s clinical records.
          </p>
          <FieldBlock label="Specialty Site Name (if different from above)">
            <FormInput
              value={formData.specialtySiteName}
              onChange={(v) => set("specialtySiteName", v)}
              className="w-full max-w-xs"
              disabled={!canEdit}
            />
          </FieldBlock>
        </div>

        {/* ── 8b. VERIFICATION — chronic only ──
            Tracks who verified benefits, when, and the insurance-call
            reference. Not on the post-surgical physician template. */}
        {!isPostSurgical && (
          <>
            <SectionHeader title="Verification" />
            <div className="px-2 pt-2 pb-1 border-b border-[#e5e5e5] space-y-2">
              <TwoCol className="px-0">
                <FieldBlock label="Verified By">
                  <FormInput
                    value={formData.verifiedBy}
                    onChange={(v) => set("verifiedBy", v)}
                    className="w-full"
                    placeholder="Name of person who called"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Verified Date">
                  <FormInput
                    value={formData.verifiedDate}
                    onChange={(v) => set("verifiedDate", v)}
                    className="w-full"
                    placeholder="MM/DD/YYYY"
                    disabled={!canEdit}
                  />
                </FieldBlock>
                <FieldBlock label="Reference Number">
                  <FormInput
                    value={formData.verificationReference}
                    onChange={(v) => set("verificationReference", v)}
                    className="w-full"
                    placeholder="Call reference #"
                    disabled={!canEdit}
                  />
                </FieldBlock>
              </TwoCol>
              <FieldBlock label="Notes">
                <textarea
                  value={formData.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  placeholder="Additional notes..."
                  disabled={!canEdit}
                  className="w-full border-b border-[#888] bg-transparent text-[12px] leading-tight text-[#333] px-0.5 resize-none outline-none disabled:text-[#888]"
                />
              </FieldBlock>
            </div>
          </>
        )}

        {/* ── 9. IMPORTANT NOTES ── */}
        <div className="mt-3 px-3 py-2.5 bg-[#f5f5f5] border border-[#ddd] text-[11px] text-[#444] space-y-1">
          <p>
            • Please include the front &amp; back copy of the patient insurance
            card.
          </p>
          <p>
            • This verification of benefits is not a guarantee of payment by the
            payor.
          </p>
        </div>

        {/* ── 10. PHYSICIAN AGREEMENT ──
            Layout matches the generated PDF: value sits on the line,
            caption label below. Fixed cell height keeps the underlines
            aligned whether signed or not. */}
        <div ref={signatureSectionRef} className="mt-4 pt-3 border-t border-[#e5e5e5]">
          <p className="text-[11px] text-[#444] leading-relaxed mb-4">
            By signing below, I certify that I have received the necessary
            patient authorization to release the medical and/or other patient
            information referenced on the form relating to the above-referenced
            patient. This information is for verifying insurance coverage,
            seeking reimbursement, and the sole purpose of claim support.
          </p>

          <div className="grid grid-cols-[1fr_220px] gap-8">
            {/* SIGNATURE CELL */}
            <div>
              <div className="h-12 flex items-end border-b border-[#333] pb-1">
                {formData.physicianSignedAt ? (
                  specimenSignatureUrl ? (
                    <img
                      src={specimenSignatureUrl}
                      alt="Provider signature"
                      className="h-10 object-contain object-left"
                    />
                  ) : (
                    <span className="text-[15px] text-[#111] italic">
                      {formData.physicianSignature || "Signed"}
                    </span>
                  )
                ) : canSign ? (
                  <button
                    type="button"
                    onClick={() => setSignModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#0f2d4a] text-[#0f2d4a] text-[11px] font-semibold hover:bg-[#0f2d4a] hover:text-white transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5 shrink-0" />
                    Sign
                  </button>
                ) : (
                  <span className="text-[11px] text-[#999] italic">
                    Awaiting provider signature
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#777]">
                  Physician or Authorized Signature
                </span>
                {formData.physicianSignedAt && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-200">
                      <Check className="w-3 h-3 text-green-600 shrink-0" />
                      <span className="text-[10px] font-semibold text-green-700">Signed</span>
                    </div>
                    {canSign && (
                      <button
                        type="button"
                        onClick={() => {
                          setSpecimenSignatureUrl(null);
                          setPendingPin(null);
                          setFormData((prev) => ({
                            ...prev,
                            physicianSignedAt: null,
                            physicianSignedBy: null,
                          }));
                        }}
                        className="text-[10px] text-[#999] hover:text-red-500 underline underline-offset-2 transition-colors"
                      >
                        Unsign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* DATE CELL */}
            <div>
              <div className="h-12 flex items-end border-b border-[#333] pb-1">
                {formData.physicianSignedAt ? (
                  <span className="text-[13px] font-semibold text-[#111]">
                    {new Date(formData.physicianSignedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={formData.physicianSignatureDate}
                    onChange={(e) => set("physicianSignatureDate", e.target.value)}
                    placeholder="—"
                    disabled={!canEdit}
                    className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#bbb]"
                  />
                )}
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#777]">
                Date
              </div>
            </div>
          </div>
        </div>

        {/* ── 11. FOOTER ── */}
        <div className="mt-6 pt-2 border-t border-[#e5e5e5] flex justify-between text-[10px] text-[#888]">
          <span>
            235 Singleton Ridge Road Suite 105, Conway SC 29526 |
            MeridianSurgicalsupplies.com
          </span>
          <span>REV2.1</span>
        </div>
      </div>

      <SignOrderModal
        open={signModalOpen}
        onOpenChange={setSignModalOpen}
        order={order}
        providerName={currentUserName ?? "Provider"}
        title="Sign IVR Form"
        successMessage="Signature captured. Click Save to commit."
        // PIN-verify only — commit happens at Save time via
        // signIVRWithSpecimen. See OrderFormDocument for matching pattern.
        onSign={(pin) => verifyProviderPin(pin)}
        onSuccess={(signatureImage, pin) => {
          const now = new Date().toISOString();
          setSpecimenSignatureUrl(signatureImage);
          setPendingPin(pin);
          setFormData((prev) => ({
            ...prev,
            physicianSignedAt: now,
            physicianSignature: currentUserName ?? "",
          }));
        }}
      />
    </div>
  );
}
