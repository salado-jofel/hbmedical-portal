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
  CheckCircle2,
  Lock,
  MapPin,
  Mail,
  Globe,
  Phone,
  Check,
  PenLine,
} from "lucide-react";
import { HBLogo } from "@/app/(components)/HBLogo";
import { saveOrderForm } from "../(services)/order-write-actions";
import { verifyProviderPin } from "../(services)/order-workflow-actions";
import type { IOrderForm, DashboardOrder } from "@/utils/interfaces/orders";
import type { AiStatus } from "./OrderFormTab";
import { FormDeficiencyBanner } from "./FormDeficiencyBanner";
import { FormActionBar } from "./FormActionBar";
import { SignOrderModal } from "./SignOrderModal";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

/* ── Design tokens ── */
const NAVY = "#0f2d4a";
const TEAL = "#0d7a6b";

/* ── Form state ── */

type FormState = {
  woundVisitNumber: string;
  chiefComplaint: string;
  hasVasculitisOrBurns: boolean;
  isReceivingHomeHealth: boolean;
  isPatientAtSnf: boolean;
  icd10Code: string;
  followupDays: number | null;
  woundSite: string;
  woundStage: string;
  woundLengthCm: string;
  woundWidthCm: string;
  woundDepthCm: string;
  subjectiveSymptoms: string[];
  clinicalNotes: string;
  conditionDecreasedMobility: boolean;
  conditionDiabetes: boolean;
  conditionInfection: boolean;
  conditionCvd: boolean;
  conditionCopd: boolean;
  conditionChf: boolean;
  conditionAnemia: boolean;
  useBloodThinners: boolean;
  bloodThinnerDetails: string;
  surgicalDressingType: string | null;
  woundType: string;
  anticipatedLengthDays: number | null;
  followupWeeks: number | null;
  woundLocationSide: "RT" | "LT" | "bilateral" | null;
  granulationTissuePct: string;
  exudateAmount: "none" | "minimal" | "moderate" | "heavy" | null;
  thirdDegreeBurns: boolean | null;
  activeVasculitis: boolean | null;
  activeCharcot: boolean | null;
  skinCondition: "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null;
  wound2LengthCm: string;
  wound2WidthCm: string;
  wound2DepthCm: string;
  drainageDescription: string;
  treatmentPlan: string;
  patientName: string;
  patientDate: string;
  physicianSignature: string;
  physicianSignatureDate: string;
  physicianSignedAt: string | null;
  physicianSignedBy: string | null;
};

function buildFormState(
  form: IOrderForm | null,
  opts?: {
    patientName?: string | null;
    patientDate?: string | null;
    physicianSignature?: string | null;
    physicianSignatureDate?: string | null;
    woundType?: string | null;
  },
): FormState {
  return {
    woundVisitNumber: form?.woundVisitNumber?.toString() ?? "",
    chiefComplaint: form?.chiefComplaint ?? "",
    hasVasculitisOrBurns: form?.hasVasculitisOrBurns ?? false,
    isReceivingHomeHealth: form?.isReceivingHomeHealth ?? false,
    isPatientAtSnf: form?.isPatientAtSnf ?? false,
    icd10Code: form?.icd10Code ?? "",
    followupDays: form?.followupDays ?? null,
    surgicalDressingType: form?.surgicalDressingType ?? null,
    woundType: opts?.woundType ?? "",
    anticipatedLengthDays: form?.anticipatedLengthDays ?? null,
    followupWeeks: form?.followupWeeks ?? null,
    woundSite: form?.woundSite ?? "",
    woundStage: form?.woundStage ?? "",
    woundLengthCm: form?.woundLengthCm?.toString() ?? "",
    woundWidthCm: form?.woundWidthCm?.toString() ?? "",
    woundDepthCm: form?.woundDepthCm?.toString() ?? "",
    subjectiveSymptoms: form?.subjectiveSymptoms ?? [],
    clinicalNotes: form?.clinicalNotes ?? "",
    conditionDecreasedMobility: form?.conditionDecreasedMobility ?? false,
    conditionDiabetes: form?.conditionDiabetes ?? false,
    conditionInfection: form?.conditionInfection ?? false,
    conditionCvd: form?.conditionCvd ?? false,
    conditionCopd: form?.conditionCopd ?? false,
    conditionChf: form?.conditionChf ?? false,
    conditionAnemia: form?.conditionAnemia ?? false,
    useBloodThinners: form?.useBloodThinners ?? false,
    bloodThinnerDetails: form?.bloodThinnerDetails ?? "",
    woundLocationSide: form?.woundLocationSide ?? null,
    granulationTissuePct: form?.granulationTissuePct?.toString() ?? "",
    exudateAmount: form?.exudateAmount ?? null,
    thirdDegreeBurns: form?.thirdDegreeBurns ?? null,
    activeVasculitis: form?.activeVasculitis ?? null,
    activeCharcot: form?.activeCharcot ?? null,
    skinCondition: form?.skinCondition ?? null,
    wound2LengthCm: form?.wound2LengthCm?.toString() ?? "",
    wound2WidthCm: form?.wound2WidthCm?.toString() ?? "",
    wound2DepthCm: form?.wound2DepthCm?.toString() ?? "",
    drainageDescription: form?.drainageDescription ?? "",
    treatmentPlan: form?.treatmentPlan ?? "",
    patientName: form?.patientName ?? opts?.patientName ?? "",
    patientDate: form?.patientDate ?? opts?.patientDate ?? "",
    physicianSignature:
      form?.physicianSignature ?? opts?.physicianSignature ?? "",
    physicianSignatureDate:
      form?.physicianSignatureDate ?? opts?.physicianSignatureDate ?? "",
    physicianSignedAt:  form?.physicianSignedAt  ?? null,
    physicianSignedBy:  form?.physicianSignedBy  ?? null,
  };
}

/* ── Paper-form primitives ── */

function FormCheckbox({
  checked,
  onChange,
  label,
  aiHighlight = false,
  className = "",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  aiHighlight?: boolean;
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
          checked
            ? "border-[#0d7a6b] bg-[#0d7a6b]"
            : aiHighlight
              ? "border-[#0d7a6b] bg-white"
              : "border-[#666] bg-white",
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
  aiHighlight = false,
  deficient = false,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "required"> & {
  value: string;
  onChange: (v: string) => void;
  aiHighlight?: boolean;
  deficient?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "border-0 border-b text-[13px] outline-none",
        "focus:border-[#0d7a6b] transition-colors px-1 py-0.5 leading-tight",
        aiHighlight && value
          ? "border-[#0d7a6b]/40 bg-transparent text-[#222] placeholder:text-[#bbb]"
          : deficient
            ? "border-[#dc2626] bg-red-50/50 text-[#222] placeholder:text-red-300"
            : "border-[#333] bg-transparent text-[#222] placeholder:text-[#bbb]",
        className,
      )}
      {...props}
    />
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  minRows = 3,
  aiHighlight = false,
  deficient = false,
  className,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  aiHighlight?: boolean;
  deficient?: boolean;
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
        "w-full border text-[13px] text-[#222] outline-none resize-none overflow-hidden",
        "focus:border-[#0d7a6b] transition-colors px-2 py-1.5 leading-relaxed",
        aiHighlight && value
          ? "border-[#0d7a6b]/40 bg-white placeholder:text-[#bbb]"
          : deficient
            ? "border-[#dc2626] bg-red-50/30 placeholder:text-red-300"
            : "border-[#ccc] bg-white placeholder:text-[#bbb]",
        className,
      )}
      style={{ minHeight: `${minRows * 20}px` }}
      {...props}
    />
  );
}

/* Thin horizontal rule between sections */
function HR() {
  return <div className="border-b border-[#e5e5e5]" />;
}

/* Row wrapper: padding + bottom border */
function DocRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 border-b border-[#e5e5e5]",
        className,
      )}
    >
      {children}
    </div>
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

/* YES / NO checkbox pair */
function YesNo({
  label,
  value,
  onChange,
  aiHighlight = false,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  aiHighlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <FL>{label}</FL>
      <FormCheckbox
        checked={value === true}
        onChange={() => onChange(true)}
        label="YES"
        aiHighlight={aiHighlight && value === true}
      />
      <FormCheckbox
        checked={value === false}
        onChange={() => onChange(false)}
        label="NO"
        aiHighlight={aiHighlight && value === false}
      />
    </div>
  );
}

/* Thin ai-highlight left bar wrapper */
function AiWrap({
  active,
  children,
  className = "",
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center",
        active && "border-l-2 border-[#bbf7d0] pl-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Component ── */

interface OrderFormDocumentProps {
  orderId: string;
  orderForm: IOrderForm | null;
  order: DashboardOrder;
  canEdit: boolean;
  canSign: boolean;
  currentUserName: string | null;
  aiStatus: AiStatus;
  patientName: string | null;
  onSaved?: (updated: IOrderForm) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function OrderFormDocument({
  orderId,
  orderForm,
  order,
  canEdit,
  canSign,
  currentUserName,
  aiStatus,
  patientName,
  onSaved,
  onDirtyChange,
}: OrderFormDocumentProps) {
  // Stable fallbacks derived from order props (never change during component lifetime)
  const formFallbacks = {
    patientName: patientName,
    patientDate: order.date_of_service,
    physicianSignature: order.signed_by_name,
    physicianSignatureDate: order.signed_at
      ? new Date(order.signed_at).toLocaleDateString()
      : null,
    woundType: order.wound_type ?? "",
  };

  const [formData, setFormData] = useState<FormState>(() =>
    buildFormState(orderForm, formFallbacks),
  );
  const [baseline, setBaseline] = useState<FormState>(() =>
    buildFormState(orderForm, formFallbacks),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);

  // Re-sync when AI extraction completes
  useEffect(() => {
    const snap = buildFormState(orderForm, formFallbacks);
    setFormData(snap);
    setBaseline(snap);
  }, [orderForm?.id, orderForm?.aiExtractedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLocked = orderForm?.isLocked ?? false;
  const isReadOnly = !canEdit || isLocked;
  const ai = orderForm?.aiExtracted ?? false;
  const aiExtracted = orderForm?.aiExtracted ?? false;
  const isPostSurgical = formData.woundType === "post_surgical";

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty && !isReadOnly);
  }, [isDirty, isReadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deficiency count: every empty field after AI extraction
  const deficiencyCount = useMemo(() => {
    if (!aiExtracted) return 0;
    let count = 0;
    // Text / number inputs
    if (!formData.patientName) count++;
    if (!formData.patientDate) count++;
    if (!formData.chiefComplaint) count++;
    if (!formData.icd10Code) count++;
    if (!formData.woundSite) count++;
    if (!isPostSurgical && !formData.woundStage) count++;
    if (!formData.clinicalNotes) count++;
    if (!formData.woundLengthCm) count++;
    if (!formData.woundWidthCm) count++;
    if (!formData.woundDepthCm) count++;
    if (!isPostSurgical && !formData.drainageDescription) count++;
    if (!formData.treatmentPlan) count++;
    if (!isPostSurgical && !formData.woundVisitNumber) count++;
    if (!formData.granulationTissuePct) count++;
    // Follow up — days OR weeks counts as filled
    if (!formData.followupDays && !formData.followupWeeks) count++;
    // Anticipated length of need
    if (!formData.anticipatedLengthDays) count++;
    // Checkbox groups — at least one must be selected
    if (!formData.woundType) count++;
    if (!formData.woundLocationSide) count++;
    if (!formData.exudateAmount) count++;
    if (!isPostSurgical && !formData.skinCondition) count++;
    if (!formData.surgicalDressingType) count++;
    if (formData.subjectiveSymptoms.length === 0) count++;
    // Medical conditions — at least one must be checked
    const hasAnyCondition =
      formData.conditionDecreasedMobility ||
      formData.conditionDiabetes ||
      formData.conditionInfection ||
      formData.conditionCvd ||
      formData.conditionCopd ||
      formData.conditionChf ||
      formData.conditionAnemia;
    if (!hasAnyCondition) count++;
    return count;
  }, [
    aiExtracted,
    isPostSurgical,
    formData.patientName,
    formData.patientDate,
    formData.chiefComplaint,
    formData.icd10Code,
    formData.woundSite,
    formData.woundStage,
    formData.clinicalNotes,
    formData.woundLengthCm,
    formData.woundWidthCm,
    formData.woundDepthCm,
    formData.drainageDescription,
    formData.treatmentPlan,
    formData.woundVisitNumber,
    formData.granulationTissuePct,
    formData.followupDays,
    formData.followupWeeks,
    formData.anticipatedLengthDays,
    formData.woundType,
    formData.woundLocationSide,
    formData.exudateAmount,
    formData.skinCondition,
    formData.surgicalDressingType,
    formData.subjectiveSymptoms,
    formData.conditionDecreasedMobility,
    formData.conditionDiabetes,
    formData.conditionInfection,
    formData.conditionCvd,
    formData.conditionCopd,
    formData.conditionChf,
    formData.conditionAnemia,
  ]);

  // Per-field / per-group deficiency flags
  const woundTypeDeficient = aiExtracted && !formData.woundType;
  const locationSideDeficient = aiExtracted && !formData.woundLocationSide;
  const exudateDeficient = aiExtracted && !formData.exudateAmount;
  const skinDeficient = aiExtracted && !isPostSurgical && !formData.skinCondition;
  const dressingDeficient = aiExtracted && !formData.surgicalDressingType;
  const symptomsDeficient =
    aiExtracted && formData.subjectiveSymptoms.length === 0;
  const conditionsDeficient =
    aiExtracted &&
    !(
      formData.conditionDecreasedMobility ||
      formData.conditionDiabetes ||
      formData.conditionInfection ||
      formData.conditionCvd ||
      formData.conditionCopd ||
      formData.conditionChf ||
      formData.conditionAnemia
    );
  const visitDeficient = aiExtracted && !isPostSurgical && !formData.woundVisitNumber;
  const granulationDeficient = aiExtracted && !formData.granulationTissuePct;
  const lengthDeficient = aiExtracted && !formData.anticipatedLengthDays;
  const followupDeficient =
    aiExtracted && !formData.followupDays && !formData.followupWeeks;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(symptom: string) {
    setFormData((prev) => ({
      ...prev,
      subjectiveSymptoms: prev.subjectiveSymptoms.includes(symptom)
        ? prev.subjectiveSymptoms.filter((s) => s !== symptom)
        : [...prev.subjectiveSymptoms, symptom],
    }));
  }

  function handleDiscard() {
    setFormData(baseline);
  }

  async function handleSave() {
    setIsSaving(true);
    const numOrNull = (v: string) => (v.trim() ? Number(v) : null);
    const strOrNull = (v: string) => v.trim() || null;

    const result = await saveOrderForm(orderId, {
      wound_type: formData.woundType || null,
      surgical_dressing_type: formData.surgicalDressingType,
      anticipated_length_days: formData.anticipatedLengthDays,
      followup_weeks: formData.followupWeeks,
      wound_visit_number: numOrNull(formData.woundVisitNumber),
      chief_complaint: strOrNull(formData.chiefComplaint),
      has_vasculitis_or_burns: formData.hasVasculitisOrBurns,
      is_receiving_home_health: formData.isReceivingHomeHealth,
      is_patient_at_snf: formData.isPatientAtSnf,
      icd10_code: strOrNull(formData.icd10Code),
      followup_days: formData.followupDays,
      wound_site: strOrNull(formData.woundSite),
      wound_stage: strOrNull(formData.woundStage),
      wound_length_cm: numOrNull(formData.woundLengthCm),
      wound_width_cm: numOrNull(formData.woundWidthCm),
      wound_depth_cm: numOrNull(formData.woundDepthCm),
      subjective_symptoms: formData.subjectiveSymptoms,
      clinical_notes: strOrNull(formData.clinicalNotes),
      condition_decreased_mobility: formData.conditionDecreasedMobility,
      condition_diabetes: formData.conditionDiabetes,
      condition_infection: formData.conditionInfection,
      condition_cvd: formData.conditionCvd,
      condition_copd: formData.conditionCopd,
      condition_chf: formData.conditionChf,
      condition_anemia: formData.conditionAnemia,
      use_blood_thinners: formData.useBloodThinners,
      blood_thinner_details: strOrNull(formData.bloodThinnerDetails),
      wound_location_side: formData.woundLocationSide,
      granulation_tissue_pct: numOrNull(formData.granulationTissuePct),
      exudate_amount: formData.exudateAmount,
      third_degree_burns: formData.thirdDegreeBurns ?? false,
      active_vasculitis: formData.activeVasculitis ?? false,
      active_charcot: formData.activeCharcot ?? false,
      skin_condition: formData.skinCondition,
      wound2_length_cm: numOrNull(formData.wound2LengthCm),
      wound2_width_cm: numOrNull(formData.wound2WidthCm),
      wound2_depth_cm: numOrNull(formData.wound2DepthCm),
      drainage_description: strOrNull(formData.drainageDescription),
      treatment_plan: strOrNull(formData.treatmentPlan),
      patient_name: strOrNull(formData.patientName),
      patient_date: strOrNull(formData.patientDate),
      physician_signature: strOrNull(formData.physicianSignature),
      physician_signature_date: strOrNull(formData.physicianSignatureDate),
      physician_signed_at: formData.physicianSignedAt ?? null,
      physician_signed_by: formData.physicianSignedBy ?? null,
    });

    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to save order form.");
      return;
    }

    toast.success("Order form saved.");
    setBaseline({ ...formData });

    // Generate PDF — badge shows "Generating..." until complete
    window.dispatchEvent(
      new CustomEvent("pdf-regenerating", {
        detail: { type: "order_form", status: "start" },
      }),
    );
    fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, formType: "order_form" }),
    })
      .catch((err) => console.error("[OrderForm] PDF generation failed:", err))
      .finally(() => {
        window.dispatchEvent(
          new CustomEvent("pdf-regenerating", {
            detail: { type: "order_form", status: "done" },
          }),
        );
      });

    if (onSaved && orderForm) {
      const numOrNull2 = (v: string) => (v.trim() ? Number(v) : null);
      const strOrNull2 = (v: string) => v.trim() || null;
      onSaved({
        ...orderForm,
        surgicalDressingType: formData.surgicalDressingType,
        anticipatedLengthDays: formData.anticipatedLengthDays,
        followupWeeks: formData.followupWeeks,
        woundVisitNumber: numOrNull2(formData.woundVisitNumber),
        chiefComplaint: strOrNull2(formData.chiefComplaint),
        hasVasculitisOrBurns: formData.hasVasculitisOrBurns,
        isReceivingHomeHealth: formData.isReceivingHomeHealth,
        isPatientAtSnf: formData.isPatientAtSnf,
        icd10Code: strOrNull2(formData.icd10Code),
        followupDays: formData.followupDays,
        woundSite: strOrNull2(formData.woundSite),
        woundStage: strOrNull2(formData.woundStage),
        woundLengthCm: numOrNull2(formData.woundLengthCm),
        woundWidthCm: numOrNull2(formData.woundWidthCm),
        woundDepthCm: numOrNull2(formData.woundDepthCm),
        subjectiveSymptoms: formData.subjectiveSymptoms,
        clinicalNotes: strOrNull2(formData.clinicalNotes),
        conditionDecreasedMobility: formData.conditionDecreasedMobility,
        conditionDiabetes: formData.conditionDiabetes,
        conditionInfection: formData.conditionInfection,
        conditionCvd: formData.conditionCvd,
        conditionCopd: formData.conditionCopd,
        conditionChf: formData.conditionChf,
        conditionAnemia: formData.conditionAnemia,
        useBloodThinners: formData.useBloodThinners,
        bloodThinnerDetails: strOrNull2(formData.bloodThinnerDetails),
        woundLocationSide: formData.woundLocationSide,
        granulationTissuePct: numOrNull2(formData.granulationTissuePct),
        exudateAmount: formData.exudateAmount,
        thirdDegreeBurns: formData.thirdDegreeBurns ?? false,
        activeVasculitis: formData.activeVasculitis ?? false,
        activeCharcot: formData.activeCharcot ?? false,
        skinCondition: formData.skinCondition,
        wound2LengthCm: numOrNull2(formData.wound2LengthCm),
        wound2WidthCm: numOrNull2(formData.wound2WidthCm),
        wound2DepthCm: numOrNull2(formData.wound2DepthCm),
        drainageDescription: strOrNull2(formData.drainageDescription),
        treatmentPlan: strOrNull2(formData.treatmentPlan),
        patientName: strOrNull2(formData.patientName),
        patientDate: strOrNull2(formData.patientDate),
        physicianSignature: strOrNull2(formData.physicianSignature),
        physicianSignatureDate: strOrNull2(formData.physicianSignatureDate),
        physicianSignedAt: formData.physicianSignedAt ?? null,
        physicianSignedBy: formData.physicianSignedBy ?? null,
      });
    }
  }

  const orderItems = order.all_items ?? [];

  /* ── Render ── */
  return (
    <div className="relative">
      <FormActionBar
        label="Order Form"
        isDirty={isDirty && !isReadOnly}
        isPending={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* ── AI extraction banners ── */}
      <FormDeficiencyBanner
        aiExtracted={aiExtracted}
        deficiencyCount={deficiencyCount}
      />
      {!aiExtracted && aiStatus === "complete" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          AI extraction complete — highlighted fields were auto-filled. Review
          before signing.
        </div>
      )}

      {/* ── Locked notice ── */}
      {isLocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
          <Lock className="w-4 h-4 shrink-0" />
          This form is locked after signing and cannot be edited.
        </div>
      )}

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
          {/* Left: Brand */}
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
          {/* Right: Contact block */}
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
            Physicians Order Recommendation
          </h1>
          <div
            className="mx-auto mt-1.5 w-28 border-b-2"
            style={{ borderColor: TEAL }}
          />
        </div>

        <HR />

        {/* ── 2. PATIENT ROW ── */}
        <DocRow>
          <FL>Patient Name</FL>
          <AiWrap active={ai && !!formData.patientName}>
            <FormInput
              value={formData.patientName}
              onChange={(v) => set("patientName", v)}
              deficient={aiExtracted && !formData.patientName}
              className="w-44"
              placeholder={
                aiExtracted && !formData.patientName
                  ? "Required — AI missed this"
                  : "Patient name"
              }
            />
          </AiWrap>
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Date</FL>
          <FormInput
            value={formData.patientDate}
            onChange={(v) => set("patientDate", v)}
            deficient={aiExtracted && !formData.patientDate}
            className="w-28"
            placeholder={
              aiExtracted && !formData.patientDate ? "Required" : "MM/DD/YYYY"
            }
          />
          {!isPostSurgical && (
            <>
              <span className="text-[#ccc] mx-1">|</span>
              <FL>Wound Visit #</FL>
              <AiWrap active={ai && !!formData.woundVisitNumber}>
                <FormInput
                  value={formData.woundVisitNumber}
                  onChange={(v) => set("woundVisitNumber", v)}
                  deficient={visitDeficient}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
            </>
          )}
        </DocRow>

        {/* ── 3. MEDICARE NOTICE ── */}
        <div className="py-2 px-3 bg-[#f8f8f8] border-b border-[#e5e5e5]">
          <p className="text-[11px] font-bold text-[#111] uppercase tracking-wide leading-snug">
            Medicare Pt Cannot Be Currently Receiving Homecare (PT, OT, HHA,
            Nursing)
          </p>
        </div>

        {/* ── 4. CHIEF COMPLAINT ── */}
        <DocRow>
          <FL>Chief Complaint</FL>
          <AiWrap active={ai && !!formData.chiefComplaint} className="flex-1">
            <FormInput
              value={formData.chiefComplaint}
              onChange={(v) => set("chiefComplaint", v)}
              deficient={aiExtracted && !formData.chiefComplaint}
              className="w-full"
              placeholder={
                aiExtracted && !formData.chiefComplaint
                  ? "Required — AI missed this field"
                  : "Describe chief complaint"
              }
            />
          </AiWrap>
          <FL>ICD-10</FL>
          <AiWrap active={ai && !!formData.icd10Code}>
            <FormInput
              value={formData.icd10Code}
              onChange={(v) => set("icd10Code", v)}
              deficient={aiExtracted && !formData.icd10Code}
              className="w-20"
              placeholder={
                aiExtracted && !formData.icd10Code ? "Required" : "—"
              }
            />
          </AiWrap>
        </DocRow>

        {/* ── 5. SURGICAL DRESSING + SYMPTOMS ── */}
        <DocRow>
          <FL className={cn(dressingDeficient && "text-[#dc2626]")}>
            Surgical Dressing
          </FL>
          <div
            className={cn(
              "flex gap-2",
              dressingDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-0.5",
            )}
          >
            <FormCheckbox
              checked={formData.surgicalDressingType === "primary"}
              onChange={(checked) =>
                set("surgicalDressingType", checked ? "primary" : null)
              }
              label="Primary"
            />
            <FormCheckbox
              checked={formData.surgicalDressingType === "secondary"}
              onChange={(checked) =>
                set("surgicalDressingType", checked ? "secondary" : null)
              }
              label="Secondary"
            />
          </div>
          <span className="text-[#ccc] mx-2 self-center">|</span>
          <FL className={cn(symptomsDeficient && "text-[#dc2626]")}>
            Other Subjective Symptoms
          </FL>
          <div
            className={cn(
              "flex flex-wrap gap-x-3 gap-y-1",
              symptomsDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-0.5",
            )}
          >
            {["Pain", "Numbness", "Fever", "Chills", "Nausea"].map((s) => (
              <AiWrap
                key={s}
                active={ai && formData.subjectiveSymptoms.includes(s)}
              >
                <FormCheckbox
                  checked={formData.subjectiveSymptoms.includes(s)}
                  onChange={() => toggleSymptom(s)}
                  label={s}
                />
              </AiWrap>
            ))}
          </div>
        </DocRow>

        {/* ── 6. BLOOD THINNERS ── */}
        <DocRow>
          <FL className="text-[10px]">
            Use Of Blood Thinners: IE ASA, Plavix, Coumadin, Eliquis, Xarelto,
            Pradaxa etc.
          </FL>
          <AiWrap active={ai && formData.useBloodThinners}>
            <FormCheckbox
              checked={formData.useBloodThinners}
              onChange={(v) => set("useBloodThinners", v)}
              label="Yes"
            />
          </AiWrap>
          <AiWrap
            active={ai && !!formData.bloodThinnerDetails}
            className="flex-1"
          >
            <FormInput
              value={formData.bloodThinnerDetails}
              onChange={(v) => set("bloodThinnerDetails", v)}
              className="w-full"
              placeholder="Specify medications (if yes)"
            />
          </AiWrap>
        </DocRow>

        {/* ── 7. MEDICAL CONDITIONS ── */}
        <DocRow>
          <FL
            className={cn(
              "w-full mb-0.5",
              conditionsDeficient && "text-[#dc2626]",
            )}
          >
            Combined Medical and Mental Health Conditions
          </FL>
          <div
            className={cn(
              "flex flex-wrap gap-x-3 gap-y-1",
              conditionsDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-1",
            )}
          >
            {[
              {
                key: "conditionDecreasedMobility" as const,
                label: "Decreased Mobility",
              },
              { key: "conditionDiabetes" as const, label: "Diabetes" },
              { key: "conditionInfection" as const, label: "Infection" },
              { key: "conditionCvd" as const, label: "CVD" },
              { key: "conditionCopd" as const, label: "COPD" },
              { key: "conditionChf" as const, label: "CHF" },
              { key: "conditionAnemia" as const, label: "Anemia" },
            ].map(({ key, label }) => (
              <AiWrap key={key} active={ai && (formData[key] as boolean)}>
                <FormCheckbox
                  checked={formData[key] as boolean}
                  onChange={(v) => set(key, v)}
                  label={label}
                />
              </AiWrap>
            ))}
          </div>
        </DocRow>

        {/* ── 8. WOUND TYPE ── */}
        <DocRow>
          <FL className={cn(woundTypeDeficient && "text-[#dc2626]")}>
            Type of Wound:
          </FL>
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1",
              woundTypeDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-1",
            )}
          >
            {(
              [
                "diabetic_foot_ulcer",
                "pressure_ulcer",
                "venous_leg_ulcer",
              ] as const
            ).map((wv) => (
              <FormCheckbox
                key={wv}
                checked={formData.woundType === wv}
                onChange={(checked) => set("woundType", checked ? wv : "")}
                label={
                  wv === "diabetic_foot_ulcer"
                    ? "Diabetic Foot Ulcers"
                    : wv === "pressure_ulcer"
                      ? "Pressure Ulcers"
                      : "Venous Leg Ulcer"
                }
              />
            ))}
            {(() => {
              const knownTypes = [
                "diabetic_foot_ulcer",
                "pressure_ulcer",
                "venous_leg_ulcer",
              ];
              const isOther =
                !!formData.woundType &&
                !knownTypes.includes(formData.woundType);
              return (
                <>
                  <FormCheckbox
                    checked={isOther}
                    onChange={(checked) => {
                      if (!checked) set("woundType", "");
                    }}
                    label="Other"
                  />
                  <FormInput
                    value={isOther ? formData.woundType : ""}
                    onChange={(v) => set("woundType", v)}
                    className="w-28"
                    placeholder="Specify"
                  />
                </>
              );
            })()}
          </div>
        </DocRow>

        {/* ── 9. LOCATION ROW ── */}
        <DocRow>
          <FL>Location</FL>
          <AiWrap
            active={ai && !!formData.woundSite}
            className="flex-1 min-w-[100px]"
          >
            <FormInput
              value={formData.woundSite}
              onChange={(v) => set("woundSite", v)}
              deficient={aiExtracted && !formData.woundSite}
              className="w-full"
              placeholder={
                aiExtracted && !formData.woundSite
                  ? "Required — AI missed this field"
                  : "Anatomical location"
              }
            />
          </AiWrap>
          <div
            className={cn(
              "flex gap-2",
              locationSideDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-0.5",
            )}
          >
            {(["RT", "LT"] as const).map((side) => (
              <AiWrap
                key={side}
                active={ai && formData.woundLocationSide === side}
              >
                <FormCheckbox
                  checked={formData.woundLocationSide === side}
                  onChange={(checked) =>
                    set("woundLocationSide", checked ? side : null)
                  }
                  label={side}
                />
              </AiWrap>
            ))}
          </div>
          <span className="text-[#ccc] mx-2 self-center">|</span>
          <FL>Percentage Granulation Tissue:</FL>
          <AiWrap active={ai && !!formData.granulationTissuePct}>
            <FormInput
              value={formData.granulationTissuePct}
              onChange={(v) => set("granulationTissuePct", v)}
              deficient={granulationDeficient}
              type="number"
              className="w-12 text-center"
              placeholder="—"
            />
          </AiWrap>
          <span className="text-[13px] text-[#444]">%</span>
        </DocRow>

        {/* ── 10 + 11. WOUND MEASUREMENTS + EXUDATE + BURNS/VASCULITIS/CHARCOT ── */}
        <div className="flex gap-4 py-2 border-b border-[#e5e5e5]">
          {/* Left: measurements + yes/no questions */}
          <div className="flex-1 space-y-1.5">
            {/* Wound 1 */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <FL>Wound 1:</FL>
              <AiWrap active={ai && !!formData.woundLengthCm}>
                <FormInput
                  value={formData.woundLengthCm}
                  onChange={(v) => set("woundLengthCm", v)}
                  deficient={aiExtracted && !formData.woundLengthCm}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cc (length) ×</span>
              <AiWrap active={ai && !!formData.woundWidthCm}>
                <FormInput
                  value={formData.woundWidthCm}
                  onChange={(v) => set("woundWidthCm", v)}
                  deficient={aiExtracted && !formData.woundWidthCm}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (width) ×</span>
              <AiWrap active={ai && !!formData.woundDepthCm}>
                <FormInput
                  value={formData.woundDepthCm}
                  onChange={(v) => set("woundDepthCm", v)}
                  deficient={aiExtracted && !formData.woundDepthCm}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (depth)</span>
            </div>
            {/* Wound 2 */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <FL>Wound 2:</FL>
              <AiWrap active={ai && !!formData.wound2LengthCm}>
                <FormInput
                  value={formData.wound2LengthCm}
                  onChange={(v) => set("wound2LengthCm", v)}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cc (length) ×</span>
              <AiWrap active={ai && !!formData.wound2WidthCm}>
                <FormInput
                  value={formData.wound2WidthCm}
                  onChange={(v) => set("wound2WidthCm", v)}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (width) ×</span>
              <AiWrap active={ai && !!formData.wound2DepthCm}>
                <FormInput
                  value={formData.wound2DepthCm}
                  onChange={(v) => set("wound2DepthCm", v)}
                  type="number"
                  className="w-12 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (depth)</span>
            </div>
            <p className="text-[10px] text-[#888] italic leading-tight">
              More wounds? Write in below and remember to take measurement
              pictures.
            </p>

            {/* Burns / Vasculitis / Charcot — stacked, right side of left column */}
            <div className="pt-1 space-y-1 border-t border-[#e5e5e5] mt-1">
              <YesNo
                label="Third degree burns?"
                value={formData.thirdDegreeBurns}
                onChange={(v) => set("thirdDegreeBurns", v)}
                aiHighlight={ai}
              />
              <YesNo
                label="Active Vasculitis?"
                value={formData.activeVasculitis}
                onChange={(v) => set("activeVasculitis", v)}
                aiHighlight={ai}
              />
              <YesNo
                label="Active Charcot Arthropathy?"
                value={formData.activeCharcot}
                onChange={(v) => set("activeCharcot", v)}
                aiHighlight={ai}
              />
            </div>
          </div>

          {/* Right: Exudate column */}
          <div className="w-[140px] shrink-0 border-l border-[#e5e5e5] pl-4">
            <FL
              className={cn("block mb-2", exudateDeficient && "text-[#dc2626]")}
            >
              Wound Exudate Amount
            </FL>
            <div
              className={cn(
                "space-y-2",
                exudateDeficient &&
                  "ring-1 ring-red-300 rounded bg-red-50/50 p-1.5",
              )}
            >
              {(
                [
                  { value: "none", label: "None / Scant" },
                  { value: "minimal", label: "Minimal / Light" },
                  { value: "moderate", label: "Moderate" },
                  { value: "heavy", label: "Heavy" },
                ] as const
              ).map(({ value, label }) => (
                <AiWrap
                  key={value}
                  active={ai && formData.exudateAmount === value}
                >
                  <FormCheckbox
                    checked={formData.exudateAmount === value}
                    onChange={(checked) =>
                      set("exudateAmount", checked ? value : null)
                    }
                    label={label}
                  />
                </AiWrap>
              ))}
            </div>
          </div>
        </div>

        {/* ── 12. SKIN CONDITION ── */}
        {!isPostSurgical && (
          <DocRow>
            <FL className={cn(skinDeficient && "text-[#dc2626]")}>
              Skin Condition
            </FL>
            <div
              className={cn(
                "flex flex-wrap gap-x-3 gap-y-1",
                skinDeficient &&
                  "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-1",
              )}
            >
              {(
                [
                  { v: "normal", label: "Normal" },
                  { v: "thin", label: "Thin" },
                  { v: "atrophic", label: "Atrophic" },
                  { v: "stasis", label: "Stasis Wound / Venous" },
                  { v: "ischemic", label: "Ischemic" },
                ] as const
              ).map(({ v: sc, label }) => (
                <AiWrap key={sc} active={ai && formData.skinCondition === sc}>
                  <FormCheckbox
                    checked={formData.skinCondition === sc}
                    onChange={(checked) =>
                      set("skinCondition", checked ? sc : null)
                    }
                    label={label}
                  />
                </AiWrap>
              ))}
            </div>
          </DocRow>
        )}

        {/* ── 13. WOUND STAGE / CLASSIFICATION ── */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-1.5">
          <FL>Wound Stage / Grade / Classification</FL>
          <p className="text-[10px] text-[#777] leading-tight">
            (stage for PUs, Wagner grade for DFUs, CEAP Classification for VLUs)
          </p>
          {!isPostSurgical && (
            <div className="flex space-y-1 flex-col">
              <FL>Description</FL>
              <AiWrap active={ai && !!formData.woundStage}>
                <AutoResizeTextarea
                  value={formData.woundStage}
                  onChange={(v) => set("woundStage", v)}
                  deficient={aiExtracted && !formData.woundStage}
                  minRows={2}
                  placeholder={
                    aiExtracted && !formData.woundStage
                      ? "Required — AI missed this field"
                      : "Enter wound stage, grade, or classification"
                  }
                  aiHighlight={ai && !!formData.woundStage}
                />
              </AiWrap>
            </div>
          )}
        </div>

        {/* ── 14. DRAINAGE ── */}
        {!isPostSurgical && (
          <div className="py-2 border-b border-[#e5e5e5] flex flex-col">
            <FL>Drainage</FL>
            <AiWrap active={ai && !!formData.drainageDescription}>
              <AutoResizeTextarea
                value={formData.drainageDescription}
                onChange={(v) => set("drainageDescription", v)}
                deficient={aiExtracted && !formData.drainageDescription}
                minRows={2}
                placeholder={
                  aiExtracted && !formData.drainageDescription
                    ? "Required — AI missed this field"
                    : "Describe drainage character, color, odor"
                }
                aiHighlight={ai && !!formData.drainageDescription}
              />
            </AiWrap>
          </div>
        )}

        {/* ── 15. TREATMENT PLAN ── */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-1 flex flex-col">
          <FL>Treatment Plan to Include Frequency of Dressing Changes</FL>
          <p className="text-[10px] text-[#777] italic leading-tight">
            All materials and supplies were dispensed per the patient&apos;s
            needs. Home instructions were reviewed and all questions were
            answered in detail.
          </p>
          <AiWrap active={ai && !!formData.treatmentPlan}>
            <AutoResizeTextarea
              value={formData.treatmentPlan}
              onChange={(v) => set("treatmentPlan", v)}
              deficient={aiExtracted && !formData.treatmentPlan}
              minRows={3}
              placeholder={
                aiExtracted && !formData.treatmentPlan
                  ? "Required — AI missed this field"
                  : "Dressing type, frequency, wound care orders..."
              }
              aiHighlight={ai && !!formData.treatmentPlan}
            />
          </AiWrap>
        </div>

        {/* Clinical notes — always visible */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-1 flex flex-col">
          <FL>Clinical Notes</FL>
          <AiWrap active={ai && !!formData.clinicalNotes}>
            <AutoResizeTextarea
              value={formData.clinicalNotes}
              onChange={(v) => set("clinicalNotes", v)}
              deficient={aiExtracted && !formData.clinicalNotes}
              minRows={4}
              placeholder={
                aiExtracted && !formData.clinicalNotes
                  ? "Required — AI missed this field"
                  : "Additional clinical observations..."
              }
              aiHighlight={ai && !!formData.clinicalNotes}
            />
          </AiWrap>
        </div>

        {/* ── 16. ANTICIPATED LENGTH OF NEED ── */}
        <DocRow>
          <FL className={cn(lengthDeficient && "text-[#dc2626]")}>
            Anticipated Length of Need:
          </FL>
          <AiWrap active={ai && !!formData.anticipatedLengthDays}>
            <FormInput
              value={formData.anticipatedLengthDays?.toString() ?? ""}
              onChange={(v) =>
                set("anticipatedLengthDays", v ? Number(v) : null)
              }
              deficient={lengthDeficient}
              type="number"
              className="w-12 text-center"
              placeholder="—"
            />
          </AiWrap>
          <span className="text-[13px] text-[#444]">Days</span>
          <div
            className={cn(
              "flex gap-2",
              lengthDeficient &&
                "ring-1 ring-red-300 rounded bg-red-50/50 px-2 py-0.5",
            )}
          >
            {([15, 21, 30] as const).map((d) => (
              <AiWrap
                key={d}
                active={ai && formData.anticipatedLengthDays === d}
              >
                <FormCheckbox
                  checked={formData.anticipatedLengthDays === d}
                  onChange={(checked) =>
                    set("anticipatedLengthDays", checked ? d : null)
                  }
                  label={`${d} days`}
                />
              </AiWrap>
            ))}
          </div>
        </DocRow>

        {/* ── 17. PRODUCT DISPENSED ── */}
        <div className="py-2 border-b border-[#e5e5e5]">
          <FL className="block mb-0.5">Product Dispensed</FL>
          <p className="text-[10px] text-[#777] italic mb-2 leading-tight">
            (Please see attached prescription and patient acknowledgement of
            receipt)
          </p>

          {orderItems.length > 0 ? (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-[#999]">
                  <th className="text-left py-1.5 font-semibold text-[#333] w-[90px]">
                    SKU
                  </th>
                  <th className="text-left py-1.5 font-semibold text-[#333]">
                    Product
                  </th>
                  <th className="text-center py-1.5 font-semibold text-[#333] w-12">
                    Qty
                  </th>
                  <th className="text-right py-1.5 font-semibold text-[#333] w-24">
                    Unit Price
                  </th>
                  <th className="text-right py-1.5 font-semibold text-[#333] w-24">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item) => (
                  <tr key={item.id} className="border-b border-[#e5e5e5]">
                    <td className="py-1.5 font-mono text-[11px] text-[#666]">
                      {item.productSku}
                    </td>
                    <td className="py-1.5">{item.productName}</td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right font-mono">
                      ${item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#333]">
                  <td
                    colSpan={4}
                    className="py-2 text-right font-semibold text-[13px] text-[#333] uppercase pr-2"
                  >
                    Grand Total:
                  </td>
                  <td className="py-2 text-right font-semibold text-[14px] text-[#0d7a6b] font-mono">
                    $
                    {orderItems
                      .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
                      .toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="py-1 text-[10px] text-[#999]">
                    {orderItems.length} item(s) ·{" "}
                    {orderItems.reduce((sum, i) => sum + i.quantity, 0)} unit(s)
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="py-3 text-center text-xs text-[#999] border border-dashed border-[#ccc] rounded mt-2">
              No products added — add products from the Overview tab
            </div>
          )}
        </div>

        {/* ── 18. FOLLOW UP ── */}
        <DocRow>
          <FL className={cn(followupDeficient && "text-[#dc2626]")}>
            Follow Up
          </FL>
          <AiWrap active={ai && !!formData.followupDays}>
            <FormInput
              value={formData.followupDays?.toString() ?? ""}
              onChange={(v) => set("followupDays", v ? Number(v) : null)}
              deficient={followupDeficient}
              type="number"
              className="w-12 text-center"
              placeholder="—"
            />
          </AiWrap>
          <span className="text-[13px] text-[#444]">days</span>
          <span className="text-[#ccc] mx-2">|</span>
          <FormInput
            value={formData.followupWeeks?.toString() ?? ""}
            onChange={(v) => set("followupWeeks", v ? Number(v) : null)}
            deficient={followupDeficient}
            type="number"
            className="w-12 text-center"
            placeholder="—"
          />
          <span className="text-[13px] text-[#444]">weeks</span>
        </DocRow>

        {/* ── 19. SIGNATURE ── */}
        <div className="pt-4 mt-2 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#555] mb-1">
              Physicians Signature
            </p>
            {formData.physicianSignedAt ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 border border-green-200">
                  <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="text-[11px] font-semibold text-green-700">
                    Signed
                  </span>
                </div>
                <div className="text-[11px] text-[#444]">
                  <span className="font-medium">{formData.physicianSignature}</span>
                  <span className="text-[#999] ml-1">
                    {new Date(formData.physicianSignedAt!).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {canSign && (
                  <button
                    type="button"
                    onClick={() => set("physicianSignedAt", null)}
                    className="text-[11px] text-[#999] hover:text-red-500 underline underline-offset-2 transition-colors ml-1"
                  >
                    Unsign
                  </button>
                )}
              </div>
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
              <p className="text-[11px] text-[#999] italic py-1">
                Awaiting provider signature
              </p>
            )}
            <p className="text-[10px] text-[#777] mt-0.5">
              Authorized Provider Signature
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#555] mb-1">
              Date
            </p>
            <FormInput
              value={formData.physicianSignatureDate}
              onChange={(v) => set("physicianSignatureDate", v)}
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#555] mb-1">
              Patient Name
            </p>
            <FormInput
              value={formData.patientName}
              onChange={(v) => set("patientName", v)}
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#555] mb-1">
              Date
            </p>
            <FormInput
              value={formData.patientDate}
              onChange={(v) => set("patientDate", v)}
              placeholder="—"
            />
          </div>
        </div>
      </div>

      <SignOrderModal
        open={signModalOpen}
        onOpenChange={setSignModalOpen}
        order={order}
        providerName={currentUserName ?? "Provider"}
        title="Sign Order Form"
        successMessage="Order form signed. Save the form to persist your signature."
        onSign={(pin) => verifyProviderPin(pin)}
        onSuccess={() => {
          const now = new Date().toISOString();
          setFormData((prev) => ({ ...prev, physicianSignedAt: now, physicianSignature: currentUserName ?? "" }));
        }}
      />
    </div>
  );
}
