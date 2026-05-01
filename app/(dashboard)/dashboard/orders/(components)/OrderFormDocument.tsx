"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type InputHTMLAttributes,
} from "react";
import {
  Loader2,
  CheckCircle2,
  MapPin,
  Mail,
  Globe,
  Phone,
  Check,
  PenLine,
  Plus,
  Minus,
  X,
  Search,
} from "lucide-react";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { saveOrderForm } from "../(services)/order-write-actions";
import {
  verifyProviderPin,
  signOrderFormWithSpecimen,
  unsignOrderForm,
} from "../(services)/order-workflow-actions";
import {
  addOrderItems,
  updateOrderItemQuantity,
  deleteOrderItem,
  getProducts,
} from "../(services)/order-misc-actions";
import { getOrderForm } from "../(services)/order-ivr-actions";
import type { IOrderForm, DashboardOrder, ProductRecord } from "@/utils/interfaces/orders";
import { isItemsEditable } from "@/utils/constants/orders";
import { ADVANCEMENT_REASONS } from "@/utils/constants/advancement-reasons";
import { PriorTreatmentField } from "./PriorTreatmentField";
import type { AiStatus } from "./OrderFormTab";
import { FormDeficiencyBanner } from "./FormDeficiencyBanner";
import { FormActionBar } from "./FormActionBar";
import { SignOrderModal } from "./SignOrderModal";
import { useFormCollaboration } from "./useFormCollaboration";
import { FormCollaborationStatus } from "./FormCollaborationStatus";
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
  treatmentPlan: string;
  patientName: string;
  patientDate: string;
  physicianSignature: string;
  physicianSignatureDate: string;
  physicianSignedAt: string | null;
  physicianSignedBy: string | null;

  /* ── Fortify expansion (added 2026-04-30) ── */
  // Patient + order metadata (Section 2)
  patientMrn: string;
  patientMbi: string;
  insuranceTypeLabel: string;
  anticipatedDosStart: string;
  anticipatedDosEnd: string;
  // Comorbidities + labs (Section 7)
  a1cValue: string;
  a1cDate: string;
  conditionPad: boolean;
  padDetails: string;
  conditionVenousInsufficiency: boolean;
  conditionNeuropathy: boolean;
  conditionImmunosuppression: boolean;
  immunosuppressionDetails: string;
  conditionMalnutrition: boolean;
  albuminValue: string;
  conditionSmoking: boolean;
  conditionRenalDisease: boolean;
  egfrValue: string;
  conditionOther: string;
  // Etiology + onset (Section 8)
  etiologyDfu: boolean;
  etiologyVenousStasis: boolean;
  etiologyPressureUlcer: boolean;
  pressureUlcerStage: string;
  etiologyArterial: boolean;
  etiologySurgical: boolean;
  etiologyTraumatic: boolean;
  etiologyOther: string;
  woundOnsetDate: string;
  woundDurationText: string;
  // Wound bed + pain + photo (Section 10-11)
  woundBedSloughPct: string;
  woundBedEscharPct: string;
  painLevel: string;
  infectionSignsDescribe: string;
  woundPhotoTaken: boolean;
  // Prior treatments + advancement (Section 15)
  priorTreatments: Array<{ treatment: string; datesUsed: string; outcome: string }>;
  advancementReason: string;
  // Treatment plan structure (Section 15)
  goalOfTherapy: string;
  goalOfTherapyOther: string;
  adjunctOffloading: boolean;
  adjunctCompression: boolean;
  adjunctDebridement: boolean;
  adjunctOther: string;
  specialtyConsults: string;
  // Product (Section 17)
  applicationFrequency: string;
  specialModifiers: string;
  priorAuthObtained: boolean;
  // Coverage self-check (between 18 and 19)
  lcdReference: string;
  woundMeetsLcd: boolean | null;
  conservativeTxPeriodMet: boolean | null;
  qtyWithinLcdLimits: boolean | null;
  kxCriteriaMet: "yes" | "no" | "na" | null;
  posEligible: boolean | null;
  coverageConcerns: string;
  // Signature additions (Section 19)
  physicianNpi: string;
  attestExaminedPatient: boolean;
  attestMedicallyNecessary: boolean;
  attestConservativeTxInadequate: boolean;
  attestFreqQtyClinicalJudgment: boolean;
  attestLcdSupported: boolean;
  // Office tracking (admin-only, below Section 19)
  officeMethodOfReceipt: string;
  officeBaaInPlace: boolean | null;
  officeReviewedBy: string;
  officeDocumentationComplete: boolean | null;
  officeGapsIdentified: string;
  officeGapsCommunicatedAt: string;
  officeGapsResolvedAt: string;
  officeReleasedToFulfillment: boolean | null;
  officeReleasedToFulfillmentAt: string;
  officeFiledInRepository: boolean | null;
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
    treatmentPlan: form?.treatmentPlan ?? "",
    patientName: form?.patientName ?? opts?.patientName ?? "",
    patientDate: form?.patientDate ?? opts?.patientDate ?? "",
    physicianSignature:
      form?.physicianSignature ?? opts?.physicianSignature ?? "",
    physicianSignatureDate:
      form?.physicianSignatureDate ?? opts?.physicianSignatureDate ?? "",
    physicianSignedAt:  form?.physicianSignedAt  ?? null,
    physicianSignedBy:  form?.physicianSignedBy  ?? null,

    /* ── Fortify expansion ── */
    patientMrn: form?.patientMrn ?? "",
    patientMbi: form?.patientMbi ?? "",
    insuranceTypeLabel: form?.insuranceTypeLabel ?? "",
    anticipatedDosStart: form?.anticipatedDosStart ?? "",
    anticipatedDosEnd: form?.anticipatedDosEnd ?? "",
    a1cValue: form?.a1cValue?.toString() ?? "",
    a1cDate: form?.a1cDate ?? "",
    conditionPad: form?.conditionPad ?? false,
    padDetails: form?.padDetails ?? "",
    conditionVenousInsufficiency: form?.conditionVenousInsufficiency ?? false,
    conditionNeuropathy: form?.conditionNeuropathy ?? false,
    conditionImmunosuppression: form?.conditionImmunosuppression ?? false,
    immunosuppressionDetails: form?.immunosuppressionDetails ?? "",
    conditionMalnutrition: form?.conditionMalnutrition ?? false,
    albuminValue: form?.albuminValue?.toString() ?? "",
    conditionSmoking: form?.conditionSmoking ?? false,
    conditionRenalDisease: form?.conditionRenalDisease ?? false,
    egfrValue: form?.egfrValue?.toString() ?? "",
    conditionOther: form?.conditionOther ?? "",
    etiologyDfu: form?.etiologyDfu ?? false,
    etiologyVenousStasis: form?.etiologyVenousStasis ?? false,
    etiologyPressureUlcer: form?.etiologyPressureUlcer ?? false,
    pressureUlcerStage: form?.pressureUlcerStage ?? "",
    etiologyArterial: form?.etiologyArterial ?? false,
    etiologySurgical: form?.etiologySurgical ?? false,
    etiologyTraumatic: form?.etiologyTraumatic ?? false,
    etiologyOther: form?.etiologyOther ?? "",
    woundOnsetDate: form?.woundOnsetDate ?? "",
    woundDurationText: form?.woundDurationText ?? "",
    woundBedSloughPct: form?.woundBedSloughPct?.toString() ?? "",
    woundBedEscharPct: form?.woundBedEscharPct?.toString() ?? "",
    painLevel: form?.painLevel?.toString() ?? "",
    infectionSignsDescribe: form?.infectionSignsDescribe ?? "",
    woundPhotoTaken: form?.woundPhotoTaken ?? false,
    priorTreatments: form?.priorTreatments ?? [],
    advancementReason: form?.advancementReason ?? "",
    goalOfTherapy: form?.goalOfTherapy ?? "",
    goalOfTherapyOther: form?.goalOfTherapyOther ?? "",
    adjunctOffloading: form?.adjunctOffloading ?? false,
    adjunctCompression: form?.adjunctCompression ?? false,
    adjunctDebridement: form?.adjunctDebridement ?? false,
    adjunctOther: form?.adjunctOther ?? "",
    specialtyConsults: form?.specialtyConsults ?? "",
    applicationFrequency: form?.applicationFrequency ?? "",
    specialModifiers: form?.specialModifiers ?? "",
    priorAuthObtained: form?.priorAuthObtained ?? false,
    lcdReference: form?.lcdReference ?? "",
    woundMeetsLcd: form?.woundMeetsLcd ?? null,
    conservativeTxPeriodMet: form?.conservativeTxPeriodMet ?? null,
    qtyWithinLcdLimits: form?.qtyWithinLcdLimits ?? null,
    kxCriteriaMet: form?.kxCriteriaMet ?? null,
    posEligible: form?.posEligible ?? null,
    coverageConcerns: form?.coverageConcerns ?? "",
    physicianNpi: form?.physicianNpi ?? "",
    attestExaminedPatient: form?.attestExaminedPatient ?? false,
    attestMedicallyNecessary: form?.attestMedicallyNecessary ?? false,
    attestConservativeTxInadequate: form?.attestConservativeTxInadequate ?? false,
    attestFreqQtyClinicalJudgment: form?.attestFreqQtyClinicalJudgment ?? false,
    attestLcdSupported: form?.attestLcdSupported ?? false,
    officeMethodOfReceipt: form?.officeTracking?.methodOfReceipt ?? "",
    officeBaaInPlace: form?.officeTracking?.baaInPlace ?? null,
    officeReviewedBy: form?.officeTracking?.reviewedBy ?? "",
    officeDocumentationComplete: form?.officeTracking?.documentationComplete ?? null,
    officeGapsIdentified: form?.officeTracking?.gapsIdentified ?? "",
    officeGapsCommunicatedAt: form?.officeTracking?.gapsCommunicatedAt ?? "",
    officeGapsResolvedAt: form?.officeTracking?.gapsResolvedAt ?? "",
    officeReleasedToFulfillment: form?.officeTracking?.releasedToFulfillment ?? null,
    officeReleasedToFulfillmentAt: form?.officeTracking?.releasedToFulfillmentAt ?? "",
    officeFiledInRepository: form?.officeTracking?.filedInRepository ?? null,
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

/**
 * Three-state Yes / No / unset toggle used by the LCD Coverage Self-Check
 * block. Returns `null` when neither button is on (the unset state) so the
 * underlying DB column can stay NULL until someone explicitly answers.
 */
function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[6.5px] text-[#666] font-bold uppercase tracking-[0.4px]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-semibold border transition-colors",
          value === true
            ? "bg-[#0d7a6b] text-white border-[#0d7a6b]"
            : "bg-white text-[#444] border-[#bbb]",
        )}
      >
        Y
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-semibold border transition-colors",
          value === false
            ? "bg-[#7a3030] text-white border-[#7a3030]"
            : "bg-white text-[#444] border-[#bbb]",
        )}
      >
        N
      </button>
    </span>
  );
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
  /** Admin bypasses status-based item-edit locks. */
  isAdmin: boolean;
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
  isAdmin,
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
  const [reloading, setReloading] = useState(false);
  // Tracks the row's `updated_at` we last synced with — used as the conflict
  // cursor on save and the equality target for realtime change detection.
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(
    orderForm?.updatedAt ?? null,
  );

  // Signing does NOT lock the form. Provider can edit + save freely at any
  // time. The signed state is purely informational (and drives whether the
  // PDF gets a signature stamped on the next regen). Save gating is all on
  // Submit Order, not here.
  const isReadOnly = !canEdit;

  const [signModalOpen, setSignModalOpen] = useState(false);
  // Anchor for the "please sign before saving" auto-scroll behavior.
  const signatureSectionRef = useRef<HTMLDivElement | null>(null);
  // Session-only specimen signature — set when SignOrderModal.onSuccess
  // fires. Renders on-screen at the signature slot so the provider sees
  // their actual signature, not just a "Signed" badge. Not persisted
  // anywhere; cleared on page reload (the PDF is the permanent record).
  const [specimenSignatureUrl, setSpecimenSignatureUrl] = useState<string | null>(
    orderForm?.physicianSignatureImage ?? null,
  );
  // Resync when the server copy changes (AI extraction / parent refresh
  // after save). Treat the stored column as the source of truth on load.
  useEffect(() => {
    setSpecimenSignatureUrl(orderForm?.physicianSignatureImage ?? null);
  }, [orderForm?.physicianSignatureImage]);
  // PIN buffered from the sign modal. Save-time commit re-verifies it on
  // the server as the actual write. Sign is only UI-committed until save.
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  // Dropdown selection for "Reason for Advancing". Decoupled from the
  // persisted free-text value so "Other (specify)" stays selected even when
  // the textarea is briefly empty (otherwise the dropdown would snap back to
  // "— Select a reason —" the moment the user picks Other and the value is
  // cleared, hiding the textarea before they can type).
  const [advancementChoice, setAdvancementChoice] = useState<string>(() => {
    const v = orderForm?.advancementReason ?? "";
    const matched = ADVANCEMENT_REASONS.find((r) => r.label === v);
    if (matched) return matched.id;
    if (v) return "other";
    return "";
  });

  // Re-sync when AI extraction completes OR the parent's `patientName` prop
  // resolves (it lands later than the initial render because OrderDetailModal
  // refreshes it once polling sees AI complete + the patient row gets linked).
  useEffect(() => {
    const snap = buildFormState(orderForm, formFallbacks);
    setFormData(snap);
    setBaseline(snap);
    setLocalUpdatedAt(orderForm?.updatedAt ?? null);
    // Re-derive advancement-reason dropdown choice from the freshly loaded value.
    const v = orderForm?.advancementReason ?? "";
    const matched = ADVANCEMENT_REASONS.find((r) => r.label === v);
    setAdvancementChoice(matched ? matched.id : v ? "other" : "");
  }, [orderForm?.id, orderForm?.aiExtractedAt, patientName]); // eslint-disable-line react-hooks/exhaustive-deps

  const ai = orderForm?.aiExtracted ?? false;
  const aiExtracted = orderForm?.aiExtracted ?? false;
  // Bind to order.wound_type (stable — set at order creation) rather than
  // formData.woundType (mutable — provider can change the wound subtype
  // to DFU/PU/VLU/Other inside the form). Otherwise the whole form variant
  // morphs when a post-surgical order's provider picks a granular subtype.
  const isPostSurgical = order.wound_type === "post_surgical";

  /* ── Items editing (moved from Overview) ───────────────────────────────
     Provider manages the product list in the Order Form now. Local draft
     state survives until the Order Form save, which diffs against the
     baseline and calls addOrderItems/updateOrderItemQuantity/deleteOrderItem.
  */
  type DraftItem = {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    hcpcsCode: string | null;
    unitPrice: number;
    quantity: number;
    isNew?: boolean;
  };
  const initialItems: DraftItem[] = (order.all_items ?? []).map((it) => ({
    id: it.id,
    productId: it.productId ?? "",
    productName: it.productName,
    productSku: it.productSku,
    hcpcsCode: it.hcpcsCode ?? null,
    unitPrice: Number(it.unitPrice),
    quantity: Number(it.quantity),
  }));
  const [draftItems, setDraftItems] = useState<DraftItem[]>(initialItems);
  const [itemsBaseline, setItemsBaseline] = useState<DraftItem[]>(initialItems);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productSearch, setProductSearch] = useState<string>("");
  // Admin can edit items at any status (e.g., correcting an order after
  // it's been delivered). Non-admins follow the standard status lock.
  const itemsEditable = (isAdmin || isItemsEditable(order.order_status)) && !isReadOnly;

  /* ── Fortify expansion derived flags ──
     `allAttestationsChecked`: all five physician certifications must be
     checked before Sign is enabled. The Coverage Self-Check block is gated
     by the same `isReadOnly` rule as the rest of the form (clinic + admin +
     support can edit; reps are locked out at the parent fieldset level). */
  const allAttestationsChecked =
    formData.attestExaminedPatient &&
    formData.attestMedicallyNecessary &&
    formData.attestConservativeTxInadequate &&
    formData.attestFreqQtyClinicalJudgment &&
    formData.attestLcdSupported;
  const canSignWithAttestations = canSign && allAttestationsChecked;

  // Load products catalog once.
  useEffect(() => {
    getProducts()
      .then((p) => setProducts(p))
      .finally(() => setProductsLoading(false));
  }, []);

  // Re-sync items when the parent order row changes (e.g. after save ->
  // refresh, or realtime update bringing fresh server IDs for new items).
  useEffect(() => {
    const next: DraftItem[] = (order.all_items ?? []).map((it) => ({
      id: it.id,
      productId: it.productId ?? "",
      productName: it.productName,
      productSku: it.productSku,
      hcpcsCode: it.hcpcsCode ?? null,
      unitPrice: Number(it.unitPrice),
      quantity: Number(it.quantity),
    }));
    setDraftItems(next);
    setItemsBaseline(next);
  }, [order.id, order.all_items?.length, JSON.stringify(order.all_items?.map((i) => `${i.id}:${i.quantity}`))]);

  const isItemsDirty = useMemo(
    () => JSON.stringify(draftItems) !== JSON.stringify(itemsBaseline),
    [draftItems, itemsBaseline],
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.hcpcs_code ?? "").toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  function handleAddProductToDraft(prod: ProductRecord) {
    setDraftItems((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id: `draft-${prod.id}-${Date.now()}`,
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          hcpcsCode: prod.hcpcs_code ?? null,
          unitPrice: Number(prod.unit_price),
          quantity: 1,
          isNew: true,
        },
      ];
    });
  }

  function handleItemQtyChange(itemId: string, nextQty: number) {
    if (nextQty < 1) return;
    setDraftItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i)),
    );
  }

  function handleItemRemove(itemId: string) {
    setDraftItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  const isDirty = useMemo(
    () =>
      JSON.stringify(formData) !== JSON.stringify(baseline) || isItemsDirty,
    [formData, baseline, isItemsDirty],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty && !isReadOnly);
  }, [isDirty, isReadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime collaboration ── subscribes to UPDATEs on order_form for
     this order and tracks who else is viewing. The conflict cursor
     `localUpdatedAt` flips on each successful save / silent reload. */
  const collab = useFormCollaboration({
    table: "order_form",
    channelKey: "order_form",
    orderId,
    userName: currentUserName,
    localUpdatedAt,
  });

  /* ── Order Form PDF regen helper. Same `pdf-regenerating` events the
     OrderDetailModal listens for so the right-side document card flips to
     its blue "Generating…" state. */
  const regenerateOrderFormPdf = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    window.dispatchEvent(
      new CustomEvent("pdf-regenerating", {
        detail: { type: "order_form", status: "start" },
      }),
    );
    try {
      const pdfRes = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formType: "order_form" }),
      });
      if (!pdfRes.ok) {
        return { ok: false, error: `PDF generation failed (${pdfRes.status})` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
    } finally {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "order_form", status: "done" },
        }),
      );
    }
  }, [orderId]);

  /* ── Reload from server ── used by the conflict banner and the silent
     auto-refresh when no local edits are in flight. Refetches the form row,
     rebuilds local form state via buildFormState, refreshes the conflict
     cursor, and kicks a fresh PDF render. */
  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const fresh = await getOrderForm(orderId);
      const next = buildFormState(fresh, formFallbacks);
      setFormData(next);
      setBaseline(next);
      setLocalUpdatedAt(fresh?.updatedAt ?? null);
      collab.acknowledgeRemoteChange();
      // Fire and forget — the document card listens for regen events
      // independently. Don't block the form on the PDF round-trip.
      void regenerateOrderFormPdf();
    } finally {
      setReloading(false);
    }
    // formFallbacks is rebuilt every render from order props, so omit it
    // from deps to avoid restarting reloads as the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, collab, regenerateOrderFormPdf]);

  // Silent auto-refresh: when someone else saves and we have nothing
  // unsaved, just pull the latest. Banner is reserved for the dirty case
  // where blowing away local edits needs explicit confirmation.
  useEffect(() => {
    if (collab.remoteChangedSinceLoad && !isDirty) {
      void handleReload();
    }
  }, [collab.remoteChangedSinceLoad, isDirty, handleReload]);

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
    setDraftItems(itemsBaseline);
    setPendingPin(null);
    // Restore specimen visibility to match whatever baseline had. If the
    // baseline was unsigned, nothing should show; if it was signed,
    // we no longer have the original image (it was session-only) so just
    // clear and fall back to the signed-badge UI.
    if (!baseline.physicianSignedAt) {
      setSpecimenSignatureUrl(null);
    }
  }

  async function saveItemsDiff(): Promise<{ success: boolean; error: string | null }> {
    // Diff draftItems vs itemsBaseline and commit changes via the same
    // server actions Overview used. Returns first error if any leg fails.
    const newItems = draftItems.filter((i) => i.isNew);
    const qtyChanges = draftItems.filter((draft) => {
      if (draft.isNew) return false;
      const saved = itemsBaseline.find((s) => s.id === draft.id);
      return saved && saved.quantity !== draft.quantity;
    });
    const deletedIds = itemsBaseline
      .filter((s) => !draftItems.find((d) => d.id === s.id))
      .map((s) => s.id);

    if (newItems.length === 0 && qtyChanges.length === 0 && deletedIds.length === 0) {
      return { success: true, error: null };
    }

    if (newItems.length > 0) {
      const res = await addOrderItems(
        order.id,
        newItems.map((i) => ({
          product_id: i.productId,
          product_name: i.productName,
          product_sku: i.productSku,
          hcpcs_code: i.hcpcsCode,
          unit_price: i.unitPrice,
          quantity: i.quantity,
        })),
      );
      if (!res.success) return { success: false, error: res.error ?? "Failed to add products." };
    }
    for (const item of qtyChanges) {
      const res = await updateOrderItemQuantity(item.id, item.quantity);
      if (!res.success) return { success: false, error: `Failed to update qty: ${item.productName}` };
    }
    for (const id of deletedIds) {
      const res = await deleteOrderItem(id);
      if (!res.success) return { success: false, error: "Failed to remove item." };
    }
    return { success: true, error: null };
  }

  async function handleSave() {
    setIsSaving(true);

    // Detect sign-state change relative to the last saved baseline.
    // Signing + unsigning both flip local formData.physicianSignedAt; the
    // diff against baseline tells us which commit to run after fields save.
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

    if (isItemsDirty) {
      const itemsResult = await saveItemsDiff();
      if (!itemsResult.success) {
        setIsSaving(false);
        toast.error(itemsResult.error ?? "Failed to save products.");
        return;
      }
    }
    const numOrNull = (v: string) => (v.trim() ? Number(v) : null);
    const strOrNull = (v: string) => v.trim() || null;

    // Save form fields. physician_signed_at / physician_signed_by are
    // intentionally NOT in this payload — signed state is committed via
    // signOrderFormWithSpecimen (on sign) or unsignOrderForm (on unsign)
    // below so it never lands in the DB without a PIN check.
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
      treatment_plan: strOrNull(formData.treatmentPlan),
      patient_name: strOrNull(formData.patientName),
      patient_date: strOrNull(formData.patientDate),
      physician_signature: strOrNull(formData.physicianSignature),
      physician_signature_date: strOrNull(formData.physicianSignatureDate),
      /* ── Fortify expansion ── */
      patient_mrn: strOrNull(formData.patientMrn),
      patient_mbi: strOrNull(formData.patientMbi),
      insurance_type_label: strOrNull(formData.insuranceTypeLabel),
      anticipated_dos_start: strOrNull(formData.anticipatedDosStart),
      anticipated_dos_end: strOrNull(formData.anticipatedDosEnd),
      a1c_value: numOrNull(formData.a1cValue),
      a1c_date: strOrNull(formData.a1cDate),
      condition_pad: formData.conditionPad,
      pad_details: strOrNull(formData.padDetails),
      condition_venous_insufficiency: formData.conditionVenousInsufficiency,
      condition_neuropathy: formData.conditionNeuropathy,
      condition_immunosuppression: formData.conditionImmunosuppression,
      immunosuppression_details: strOrNull(formData.immunosuppressionDetails),
      condition_malnutrition: formData.conditionMalnutrition,
      albumin_value: numOrNull(formData.albuminValue),
      condition_smoking: formData.conditionSmoking,
      condition_renal_disease: formData.conditionRenalDisease,
      egfr_value: numOrNull(formData.egfrValue),
      condition_other: strOrNull(formData.conditionOther),
      etiology_dfu: formData.etiologyDfu,
      etiology_venous_stasis: formData.etiologyVenousStasis,
      etiology_pressure_ulcer: formData.etiologyPressureUlcer,
      pressure_ulcer_stage: strOrNull(formData.pressureUlcerStage),
      etiology_arterial: formData.etiologyArterial,
      etiology_surgical: formData.etiologySurgical,
      etiology_traumatic: formData.etiologyTraumatic,
      etiology_other: strOrNull(formData.etiologyOther),
      wound_onset_date: strOrNull(formData.woundOnsetDate),
      wound_duration_text: strOrNull(formData.woundDurationText),
      wound_bed_slough_pct: numOrNull(formData.woundBedSloughPct),
      wound_bed_eschar_pct: numOrNull(formData.woundBedEscharPct),
      pain_level: numOrNull(formData.painLevel),
      infection_signs_describe: strOrNull(formData.infectionSignsDescribe),
      wound_photo_taken: formData.woundPhotoTaken,
      prior_treatments: formData.priorTreatments.map((row) => ({
        treatment: row.treatment,
        dates_used: row.datesUsed,
        outcome: row.outcome,
      })),
      advancement_reason: strOrNull(formData.advancementReason),
      goal_of_therapy: strOrNull(formData.goalOfTherapy),
      goal_of_therapy_other: strOrNull(formData.goalOfTherapyOther),
      adjunct_offloading: formData.adjunctOffloading,
      adjunct_compression: formData.adjunctCompression,
      adjunct_debridement: formData.adjunctDebridement,
      adjunct_other: strOrNull(formData.adjunctOther),
      specialty_consults: strOrNull(formData.specialtyConsults),
      application_frequency: strOrNull(formData.applicationFrequency),
      special_modifiers: strOrNull(formData.specialModifiers),
      prior_auth_obtained: formData.priorAuthObtained,
      lcd_reference: strOrNull(formData.lcdReference),
      wound_meets_lcd: formData.woundMeetsLcd,
      conservative_tx_period_met: formData.conservativeTxPeriodMet,
      qty_within_lcd_limits: formData.qtyWithinLcdLimits,
      kx_criteria_met: formData.kxCriteriaMet,
      pos_eligible: formData.posEligible,
      coverage_concerns: strOrNull(formData.coverageConcerns),
      physician_npi: strOrNull(formData.physicianNpi),
      attest_examined_patient: formData.attestExaminedPatient,
      attest_medically_necessary: formData.attestMedicallyNecessary,
      attest_conservative_tx_inadequate: formData.attestConservativeTxInadequate,
      attest_freq_qty_clinical_judgment: formData.attestFreqQtyClinicalJudgment,
      attest_lcd_supported: formData.attestLcdSupported,
      office_tracking: {
        method_of_receipt: strOrNull(formData.officeMethodOfReceipt),
        baa_in_place: formData.officeBaaInPlace,
        reviewed_by: strOrNull(formData.officeReviewedBy),
        documentation_complete: formData.officeDocumentationComplete,
        gaps_identified: strOrNull(formData.officeGapsIdentified),
        gaps_communicated_at: strOrNull(formData.officeGapsCommunicatedAt),
        gaps_resolved_at: strOrNull(formData.officeGapsResolvedAt),
        released_to_fulfillment: formData.officeReleasedToFulfillment,
        released_to_fulfillment_at: strOrNull(formData.officeReleasedToFulfillmentAt),
        filed_in_repository: formData.officeFiledInRepository,
      },
    }, localUpdatedAt);

    if (!result.success) {
      setIsSaving(false);
      // Conflict means another user saved while we were editing. Keep local
      // edits intact and let the user decide whether to reload via the
      // FormCollaborationStatus banner.
      if (result.conflict) {
        toast.error(
          result.error ?? "Someone else just saved this form. Reload to see their changes.",
        );
      } else {
        toast.error(result.error ?? "Failed to save order form.");
      }
      return;
    }

    if (result.updatedAt) setLocalUpdatedAt(result.updatedAt);

    // Commit sign-state change (if any) — each action also regenerates
    // the Order Form PDF with the correct signed/unsigned rendering.
    if (signIntent === "sign") {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "order_form", status: "start" },
        }),
      );
      const signRes = await signOrderFormWithSpecimen(
        orderId,
        pendingPin as string,
        specimenSignatureUrl as string,
      );
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "order_form", status: "done" },
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
          detail: { type: "order_form", status: "start" },
        }),
      );
      const unsignRes = await unsignOrderForm(orderId);
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "order_form", status: "done" },
        }),
      );
      if (!unsignRes.success) {
        setIsSaving(false);
        toast.error(unsignRes.error ?? "Failed to unsign.");
        return;
      }
    } else {
      // Fields-only save — regenerate the PDF via the standard endpoint.
      // Delivery Invoice also regens when item lines changed (its line
      // items draw from order_items).
      const pdfTargets: Array<{ type: string; formType: string }> = [
        { type: "order_form", formType: "order_form" },
      ];
      if (isItemsDirty) {
        pdfTargets.push({
          type: "delivery_invoice",
          formType: "delivery_invoice",
        });
      }
      for (const { type, formType } of pdfTargets) {
        window.dispatchEvent(
          new CustomEvent("pdf-regenerating", { detail: { type, status: "start" } }),
        );
        fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, formType }),
        })
          .catch((err) =>
            console.error(`[OrderForm] ${formType} PDF gen failed:`, err),
          )
          .finally(() => {
            window.dispatchEvent(
              new CustomEvent("pdf-regenerating", { detail: { type, status: "done" } }),
            );
          });
      }
    }

    setIsSaving(false);
    toast.success(
      signIntent === "sign"
        ? "Order form signed + saved."
        : signIntent === "unsign"
          ? "Unsigned + saved."
          : "Order form saved.",
    );
    setBaseline({ ...formData });
    setItemsBaseline(draftItems);
    // Clear the buffered PIN once committed; keep specimenSignatureUrl so
    // the signature stays visible on-screen for the current session. On
    // unsign save, clear the specimen too so the UI is consistent.
    setPendingPin(null);
    if (signIntent === "unsign") {
      setSpecimenSignatureUrl(null);
    }

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
        treatmentPlan: strOrNull2(formData.treatmentPlan),
        patientName: strOrNull2(formData.patientName),
        patientDate: strOrNull2(formData.patientDate),
        physicianSignature: strOrNull2(formData.physicianSignature),
        physicianSignatureDate: strOrNull2(formData.physicianSignatureDate),
        physicianSignedAt: formData.physicianSignedAt ?? null,
        physicianSignedBy: formData.physicianSignedBy ?? null,
        /* ── Fortify expansion ── */
        patientMrn: strOrNull2(formData.patientMrn),
        patientMbi: strOrNull2(formData.patientMbi),
        insuranceTypeLabel: (strOrNull2(formData.insuranceTypeLabel) as IOrderForm["insuranceTypeLabel"]),
        anticipatedDosStart: strOrNull2(formData.anticipatedDosStart),
        anticipatedDosEnd: strOrNull2(formData.anticipatedDosEnd),
        a1cValue: numOrNull2(formData.a1cValue),
        a1cDate: strOrNull2(formData.a1cDate),
        conditionPad: formData.conditionPad,
        padDetails: strOrNull2(formData.padDetails),
        conditionVenousInsufficiency: formData.conditionVenousInsufficiency,
        conditionNeuropathy: formData.conditionNeuropathy,
        conditionImmunosuppression: formData.conditionImmunosuppression,
        immunosuppressionDetails: strOrNull2(formData.immunosuppressionDetails),
        conditionMalnutrition: formData.conditionMalnutrition,
        albuminValue: numOrNull2(formData.albuminValue),
        conditionSmoking: formData.conditionSmoking,
        conditionRenalDisease: formData.conditionRenalDisease,
        egfrValue: numOrNull2(formData.egfrValue),
        conditionOther: strOrNull2(formData.conditionOther),
        etiologyDfu: formData.etiologyDfu,
        etiologyVenousStasis: formData.etiologyVenousStasis,
        etiologyPressureUlcer: formData.etiologyPressureUlcer,
        pressureUlcerStage: strOrNull2(formData.pressureUlcerStage),
        etiologyArterial: formData.etiologyArterial,
        etiologySurgical: formData.etiologySurgical,
        etiologyTraumatic: formData.etiologyTraumatic,
        etiologyOther: strOrNull2(formData.etiologyOther),
        woundOnsetDate: strOrNull2(formData.woundOnsetDate),
        woundDurationText: strOrNull2(formData.woundDurationText),
        woundBedSloughPct: numOrNull2(formData.woundBedSloughPct),
        woundBedEscharPct: numOrNull2(formData.woundBedEscharPct),
        painLevel: numOrNull2(formData.painLevel),
        infectionSignsDescribe: strOrNull2(formData.infectionSignsDescribe),
        woundPhotoTaken: formData.woundPhotoTaken,
        priorTreatments: formData.priorTreatments,
        advancementReason: strOrNull2(formData.advancementReason),
        goalOfTherapy: (strOrNull2(formData.goalOfTherapy) as IOrderForm["goalOfTherapy"]),
        goalOfTherapyOther: strOrNull2(formData.goalOfTherapyOther),
        adjunctOffloading: formData.adjunctOffloading,
        adjunctCompression: formData.adjunctCompression,
        adjunctDebridement: formData.adjunctDebridement,
        adjunctOther: strOrNull2(formData.adjunctOther),
        specialtyConsults: strOrNull2(formData.specialtyConsults),
        applicationFrequency: strOrNull2(formData.applicationFrequency),
        specialModifiers: strOrNull2(formData.specialModifiers),
        priorAuthObtained: formData.priorAuthObtained,
        lcdReference: strOrNull2(formData.lcdReference),
        woundMeetsLcd: formData.woundMeetsLcd,
        conservativeTxPeriodMet: formData.conservativeTxPeriodMet,
        qtyWithinLcdLimits: formData.qtyWithinLcdLimits,
        kxCriteriaMet: formData.kxCriteriaMet,
        posEligible: formData.posEligible,
        coverageConcerns: strOrNull2(formData.coverageConcerns),
        physicianNpi: strOrNull2(formData.physicianNpi),
        attestExaminedPatient: formData.attestExaminedPatient,
        attestMedicallyNecessary: formData.attestMedicallyNecessary,
        attestConservativeTxInadequate: formData.attestConservativeTxInadequate,
        attestFreqQtyClinicalJudgment: formData.attestFreqQtyClinicalJudgment,
        attestLcdSupported: formData.attestLcdSupported,
        officeTracking: {
          methodOfReceipt: strOrNull2(formData.officeMethodOfReceipt),
          baaInPlace: formData.officeBaaInPlace,
          reviewedBy: strOrNull2(formData.officeReviewedBy),
          documentationComplete: formData.officeDocumentationComplete,
          gapsIdentified: strOrNull2(formData.officeGapsIdentified),
          gapsCommunicatedAt: strOrNull2(formData.officeGapsCommunicatedAt),
          gapsResolvedAt: strOrNull2(formData.officeGapsResolvedAt),
          releasedToFulfillment: formData.officeReleasedToFulfillment,
          releasedToFulfillmentAt: strOrNull2(formData.officeReleasedToFulfillmentAt),
          filedInRepository: formData.officeFiledInRepository,
        },
      });
    }
  }

  // orderItems replaced by editable draftItems state above.

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

      <FormCollaborationStatus
        viewers={collab.viewers}
        conflict={collab.remoteChangedSinceLoad && isDirty}
        reloading={reloading}
        onReload={handleReload}
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
        {/* Single fieldset gates every form control + button below. When
            the order is locked (non-admin + status >= manufacturer_review)
            this disables the Sign button, product picker, and every input
            in one shot without having to thread a prop through each
            primitive. */}
        <fieldset
          disabled={isReadOnly}
          className={`m-0 p-0 border-0 ${isReadOnly ? "opacity-90" : ""}`}
        >
        {/* ── 1. HEADER ── */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="[&>span>span:last-child]:hidden shrink-0">
              <MeridianLogo variant="light" size="lg" asLink={false} />
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
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Wound Visit #</FL>
          <AiWrap active={ai && !!formData.woundVisitNumber}>
            <FormInput
              value={formData.woundVisitNumber}
              onChange={(v) => set("woundVisitNumber", v.replace(/-/g, ""))}
              deficient={visitDeficient}
              type="number"
              min={0}
              step={1}
              className="w-12 text-center"
              placeholder="—"
            />
          </AiWrap>
        </DocRow>

        {/* ── 2b. PATIENT IDENTIFIERS + DOS (Fortify expansion) ── */}
        <DocRow>
          <FL>MRN</FL>
          <AiWrap active={ai && !!formData.patientMrn}>
            <FormInput
              value={formData.patientMrn}
              onChange={(v) => set("patientMrn", v)}
              className="w-28"
              placeholder="Medical record #"
            />
          </AiWrap>
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Medicare ID (MBI)</FL>
          <AiWrap active={ai && !!formData.patientMbi}>
            <FormInput
              value={formData.patientMbi}
              onChange={(v) => set("patientMbi", v)}
              className="w-32"
              placeholder="MBI"
            />
          </AiWrap>
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Insurance</FL>
          <AiWrap active={ai && !!formData.insuranceTypeLabel}>
            <select
              value={formData.insuranceTypeLabel}
              onChange={(e) => set("insuranceTypeLabel", e.target.value)}
              className="border-0 border-b border-[#333] text-[13px] bg-transparent outline-none px-1 py-0.5"
            >
              <option value="">—</option>
              <option value="medicare_part_b">Medicare Part B</option>
              <option value="medicare_dme">Medicare DME</option>
              <option value="medicare_advantage">Medicare Advantage</option>
              <option value="commercial">Commercial</option>
              <option value="medicaid">Medicaid</option>
              <option value="other">Other</option>
            </select>
          </AiWrap>
        </DocRow>

        <DocRow>
          <FL>Anticipated DOS — Start</FL>
          <FormInput
            type="date"
            value={formData.anticipatedDosStart}
            onChange={(v) => set("anticipatedDosStart", v)}
            className="w-36"
          />
          <span className="text-[#ccc] mx-1">|</span>
          <FL>End</FL>
          <FormInput
            type="date"
            value={formData.anticipatedDosEnd}
            onChange={(v) => set("anticipatedDosEnd", v)}
            className="w-36"
          />
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
          {!isPostSurgical && (
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
          )}
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
              /* ── Fortify expansion ── */
              { key: "conditionPad" as const, label: "PAD / Vascular Insuff." },
              { key: "conditionVenousInsufficiency" as const, label: "Venous Insufficiency" },
              { key: "conditionNeuropathy" as const, label: "Neuropathy" },
              { key: "conditionImmunosuppression" as const, label: "Immunosuppression" },
              { key: "conditionMalnutrition" as const, label: "Malnutrition" },
              { key: "conditionSmoking" as const, label: "Active Smoker" },
              { key: "conditionRenalDisease" as const, label: "Renal Disease" },
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

        {/* ── 7b. CONDITIONAL LAB VALUES + DETAILS (Fortify expansion) ── */}
        {(formData.conditionDiabetes ||
          formData.conditionPad ||
          formData.conditionImmunosuppression ||
          formData.conditionMalnutrition ||
          formData.conditionRenalDisease) && (
          <DocRow className="bg-[#fafafa]">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 w-full">
              {formData.conditionDiabetes && (
                <div className="flex items-center gap-1">
                  <FL>A1C</FL>
                  <FormInput
                    value={formData.a1cValue}
                    onChange={(v) => set("a1cValue", v)}
                    type="number"
                    className="w-14"
                    placeholder="6.5"
                  />
                  <FL>Date</FL>
                  <FormInput
                    type="date"
                    value={formData.a1cDate}
                    onChange={(v) => set("a1cDate", v)}
                    className="w-32"
                  />
                </div>
              )}
              {formData.conditionPad && (
                <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                  <FL>PAD details</FL>
                  <FormInput
                    value={formData.padDetails}
                    onChange={(v) => set("padDetails", v)}
                    className="flex-1"
                    placeholder="e.g. ABI 0.7"
                  />
                </div>
              )}
              {formData.conditionImmunosuppression && (
                <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                  <FL>Immunosuppression</FL>
                  <FormInput
                    value={formData.immunosuppressionDetails}
                    onChange={(v) => set("immunosuppressionDetails", v)}
                    className="flex-1"
                    placeholder="Medication / condition"
                  />
                </div>
              )}
              {formData.conditionMalnutrition && (
                <div className="flex items-center gap-1">
                  <FL>Albumin</FL>
                  <FormInput
                    value={formData.albuminValue}
                    onChange={(v) => set("albuminValue", v)}
                    type="number"
                    className="w-14"
                    placeholder="3.5"
                  />
                </div>
              )}
              {formData.conditionRenalDisease && (
                <div className="flex items-center gap-1">
                  <FL>eGFR</FL>
                  <FormInput
                    value={formData.egfrValue}
                    onChange={(v) => set("egfrValue", v)}
                    type="number"
                    className="w-14"
                    placeholder="60"
                  />
                </div>
              )}
            </div>
          </DocRow>
        )}

        {/* ── 7c. OTHER RELEVANT CONDITIONS (Fortify expansion) ── */}
        <DocRow>
          <FL>Other Conditions</FL>
          <FormInput
            value={formData.conditionOther}
            onChange={(v) => set("conditionOther", v)}
            className="flex-1"
            placeholder="Other relevant conditions"
          />
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

        {/* ── 8b. WOUND ETIOLOGY (Fortify expansion) ──
            Multi-select etiology breakdown. Co-existence is allowed (e.g. a
            DFU that is also venous). The parent `wound_type` from Section 8
            still drives the chronic / post-surgical form variant. */}
        <DocRow>
          <FL className="w-full mb-0.5">Wound Etiology (check all that apply)</FL>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <FormCheckbox checked={formData.etiologyDfu} onChange={(v) => set("etiologyDfu", v)} label="Diabetic foot ulcer" />
            <FormCheckbox checked={formData.etiologyVenousStasis} onChange={(v) => set("etiologyVenousStasis", v)} label="Venous insufficiency / stasis" />
            <FormCheckbox checked={formData.etiologyPressureUlcer} onChange={(v) => set("etiologyPressureUlcer", v)} label="Pressure ulcer" />
            {formData.etiologyPressureUlcer && (
              <span className="inline-flex items-center gap-1">
                <FL>Stage</FL>
                <FormInput
                  value={formData.pressureUlcerStage}
                  onChange={(v) => set("pressureUlcerStage", v)}
                  className="w-24"
                  placeholder="I, II, III, IV, Unstageable"
                />
              </span>
            )}
            <FormCheckbox checked={formData.etiologyArterial} onChange={(v) => set("etiologyArterial", v)} label="Arterial" />
            <FormCheckbox checked={formData.etiologySurgical} onChange={(v) => set("etiologySurgical", v)} label="Surgical" />
            <FormCheckbox checked={formData.etiologyTraumatic} onChange={(v) => set("etiologyTraumatic", v)} label="Traumatic" />
            <span className="inline-flex items-center gap-1 flex-1 min-w-[160px]">
              <FL>Other</FL>
              <FormInput
                value={formData.etiologyOther}
                onChange={(v) => set("etiologyOther", v)}
                className="flex-1"
                placeholder="—"
              />
            </span>
          </div>
        </DocRow>

        {/* ── 8c. WOUND ONSET / DURATION (Fortify expansion) ── */}
        <DocRow>
          <FL>Wound Onset Date</FL>
          <FormInput
            type="date"
            value={formData.woundOnsetDate}
            onChange={(v) => set("woundOnsetDate", v)}
            className="w-36"
          />
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Duration</FL>
          <FormInput
            value={formData.woundDurationText}
            onChange={(v) => set("woundDurationText", v)}
            className="w-32"
            placeholder="e.g. 6 weeks"
          />
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
              onChange={(v) => set("granulationTissuePct", v.replace(/-/g, ""))}
              deficient={granulationDeficient}
              type="number"
              min={0}
              max={100}
              step={10}
              className="w-14 text-center"
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
                  onChange={(v) => set("woundLengthCm", v.replace(/-/g, ""))}
                  deficient={aiExtracted && !formData.woundLengthCm}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (length) ×</span>
              <AiWrap active={ai && !!formData.woundWidthCm}>
                <FormInput
                  value={formData.woundWidthCm}
                  onChange={(v) => set("woundWidthCm", v.replace(/-/g, ""))}
                  deficient={aiExtracted && !formData.woundWidthCm}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (width) ×</span>
              <AiWrap active={ai && !!formData.woundDepthCm}>
                <FormInput
                  value={formData.woundDepthCm}
                  onChange={(v) => set("woundDepthCm", v.replace(/-/g, ""))}
                  deficient={aiExtracted && !formData.woundDepthCm}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
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
                  onChange={(v) => set("wound2LengthCm", v.replace(/-/g, ""))}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (length) ×</span>
              <AiWrap active={ai && !!formData.wound2WidthCm}>
                <FormInput
                  value={formData.wound2WidthCm}
                  onChange={(v) => set("wound2WidthCm", v.replace(/-/g, ""))}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
                  placeholder="—"
                />
              </AiWrap>
              <span className="text-[11px] text-[#555]">cm (width) ×</span>
              <AiWrap active={ai && !!formData.wound2DepthCm}>
                <FormInput
                  value={formData.wound2DepthCm}
                  onChange={(v) => set("wound2DepthCm", v.replace(/-/g, ""))}
                  type="number"
                  min={0}
                  step={1}
                  className="w-14 text-center"
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
              {!isPostSurgical && (
                <YesNo
                  label="Active Charcot Arthropathy?"
                  value={formData.activeCharcot}
                  onChange={(v) => set("activeCharcot", v)}
                  aiHighlight={ai}
                />
              )}
            </div>
          </div>

          {/* Right: Exudate column */}
          <div className="w-[140px] shrink-0 border-l border-[#e5e5e5] pl-4">
            <FL
              className={cn("block mb-2", exudateDeficient && "text-[#dc2626]")}
            >
              {isPostSurgical ? "Surgical Site Exudate Amount" : "Wound Exudate Amount"}
            </FL>
            <div
              className={cn(
                "space-y-2",
                exudateDeficient &&
                  "ring-1 ring-red-300 rounded bg-red-50/50 p-1.5",
              )}
            >
              {(
                isPostSurgical
                  ? ([
                      { value: "none", label: "None / Scant" },
                      { value: "minimal", label: "Minimal / Light" },
                    ] as const)
                  : ([
                      { value: "none", label: "None / Scant" },
                      { value: "minimal", label: "Minimal / Light" },
                      { value: "moderate", label: "Moderate" },
                      { value: "heavy", label: "Heavy" },
                    ] as const)
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

        {/* ── 11b. WOUND BED COMPOSITION + PAIN + PHOTO (Fortify expansion) ── */}
        <DocRow>
          <FL>Wound Bed</FL>
          <span className="text-[11px] text-[#666] mr-1">Slough %</span>
          <FormInput
            value={formData.woundBedSloughPct}
            onChange={(v) => set("woundBedSloughPct", v.replace(/-/g, ""))}
            type="number"
            min={0}
            max={100}
            step={10}
            className="w-14 text-center"
            placeholder="—"
          />
          <span className="text-[11px] text-[#666] mx-1">Eschar %</span>
          <FormInput
            value={formData.woundBedEscharPct}
            onChange={(v) => set("woundBedEscharPct", v.replace(/-/g, ""))}
            type="number"
            min={0}
            max={100}
            step={10}
            className="w-14 text-center"
            placeholder="—"
          />
          <span className="text-[#ccc] mx-2">|</span>
          <FL>Pain (0-10)</FL>
          <FormInput
            value={formData.painLevel}
            onChange={(v) => set("painLevel", v.replace(/-/g, ""))}
            type="number"
            min={0}
            max={10}
            step={1}
            className="w-12 text-center"
            placeholder="—"
          />
          <span className="text-[#ccc] mx-2">|</span>
          <FormCheckbox
            checked={formData.woundPhotoTaken}
            onChange={(v) => set("woundPhotoTaken", v)}
            label="Wound photo taken"
          />
        </DocRow>

        {/* ── 11c. SIGNS OF INFECTION DETAIL (Fortify expansion) ── */}
        {formData.conditionInfection && (
          <DocRow>
            <FL>Infection signs</FL>
            <FormInput
              value={formData.infectionSignsDescribe}
              onChange={(v) => set("infectionSignsDescribe", v)}
              className="flex-1"
              placeholder="Describe signs of infection"
            />
          </DocRow>
        )}

        {/* ── 12. SKIN CONDITION ── */}
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

        {/* ── 13. WOUND STAGE / CLASSIFICATION ──
            Chronic: full section (heading + hint + description).
            Post-surgical: just a standalone "Description" field (matches
            the provided post-surgical template which omits the chronic-
            specific staging heading). Same underlying woundStage column. */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-1.5">
          {!isPostSurgical && (
            <>
              <FL>Wound Stage / Grade / Classification</FL>
              <p className="text-[10px] text-[#777] leading-tight">
                (stage for PUs, Wagner grade for DFUs, CEAP Classification for VLUs)
              </p>
            </>
          )}
          <div className="flex space-y-1 flex-col">
            <FL>Description</FL>
            <AiWrap active={ai && !!formData.woundStage}>
              <AutoResizeTextarea
                value={formData.woundStage}
                onChange={(v) => set("woundStage", v)}
                deficient={!isPostSurgical && aiExtracted && !formData.woundStage}
                minRows={2}
                placeholder={
                  !isPostSurgical && aiExtracted && !formData.woundStage
                    ? "Required — AI missed this field"
                    : "Enter wound stage, grade, or classification"
                }
                aiHighlight={ai && !!formData.woundStage}
              />
            </AiWrap>
          </div>
        </div>

        {/* ── 15. TREATMENT PLAN ── */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-2 flex flex-col">

          {/* ── 15a (NESTED). PRIOR TREATMENTS TRIED (Fortify expansion) ──
              Multi-row table required by virtually every surgical-dressing
              LCD. Captures conservative-treatment history before the order. */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <FL>Prior Treatments Tried</FL>
              <button
                type="button"
                onClick={() =>
                  set("priorTreatments", [
                    ...formData.priorTreatments,
                    { treatment: "", datesUsed: "", outcome: "" },
                  ])
                }
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0d7a6b] hover:text-[#0a5d52] disabled:opacity-40"
                disabled={isReadOnly}
              >
                <Plus className="w-3 h-3" /> Add row
              </button>
            </div>
            {formData.priorTreatments.length === 0 ? (
              <p className="text-[11px] text-[#888] italic">
                None recorded. Click <em>Add row</em> to log prior treatments tried for this wound.
              </p>
            ) : (
              <div className="border border-[#e5e5e5] rounded">
                <div className="grid grid-cols-[1fr_1fr_1.5fr_24px] gap-2 px-2 py-1 bg-[#f5f5f5] text-[10px] font-bold uppercase tracking-wide text-[#555]">
                  <span>Treatment / Product</span>
                  <span>Dates Used</span>
                  <span>Outcome</span>
                  <span />
                </div>
                {formData.priorTreatments.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1.2fr_1fr_1.5fr_24px] gap-2 px-2 py-1 border-t border-[#eee] items-start"
                  >
                    <PriorTreatmentField
                      value={row.treatment}
                      onChange={(v) => {
                        const next = [...formData.priorTreatments];
                        next[idx] = { ...next[idx], treatment: v };
                        set("priorTreatments", next);
                      }}
                      disabled={isReadOnly}
                    />
                    <FormInput
                      value={row.datesUsed}
                      onChange={(v) => {
                        const next = [...formData.priorTreatments];
                        next[idx] = { ...next[idx], datesUsed: v };
                        set("priorTreatments", next);
                      }}
                      className="w-full mt-0.5"
                      placeholder="e.g. 2 weeks Mar"
                    />
                    <FormInput
                      value={row.outcome}
                      onChange={(v) => {
                        const next = [...formData.priorTreatments];
                        next[idx] = { ...next[idx], outcome: v };
                        set("priorTreatments", next);
                      }}
                      className="w-full mt-0.5"
                      placeholder="e.g. No improvement"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = formData.priorTreatments.filter((_, i) => i !== idx);
                        set("priorTreatments", next);
                      }}
                      className="text-[#aaa] hover:text-[#dc2626] disabled:opacity-40 mt-1"
                      disabled={isReadOnly}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1 pt-1">
              <FL>Reason for Advancing to Ordered Product</FL>
              <select
                value={advancementChoice}
                onChange={(e) => {
                  const val = e.target.value;
                  setAdvancementChoice(val);
                  if (val === "") {
                    set("advancementReason", "");
                  } else if (val === "other") {
                    // Clear the persisted value when switching INTO Other from
                    // a canonical reason so the textarea starts empty. If
                    // already on Other (e.g., loaded with legacy free text),
                    // preserve so the user doesn't lose their typing.
                    const wasCanonical = ADVANCEMENT_REASONS.some(
                      (r) => r.label === formData.advancementReason,
                    );
                    if (wasCanonical) set("advancementReason", "");
                  } else {
                    const reason = ADVANCEMENT_REASONS.find(
                      (r) => r.id === val,
                    );
                    if (reason) set("advancementReason", reason.label);
                  }
                }}
                className="border-0 border-b border-[#333] text-[13px] bg-transparent outline-none px-1 py-0.5 w-full"
              >
                <option value="">— Select a reason —</option>
                {ADVANCEMENT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
                <option value="other">Other (specify)</option>
              </select>
              {advancementChoice === "other" && (
                <AutoResizeTextarea
                  value={formData.advancementReason}
                  onChange={(v) => set("advancementReason", v)}
                  minRows={2}
                  placeholder="Specify reason for advancing"
                  className="w-full"
                />
              )}
            </div>
          </div>

          {/* ── 15b (NESTED). GOAL OF THERAPY + ADJUNCTS (Fortify expansion) ── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-[#eee]">
            <FL>Goal</FL>
            <select
              value={formData.goalOfTherapy}
              onChange={(e) => set("goalOfTherapy", e.target.value)}
              className="border-0 border-b border-[#333] text-[13px] bg-transparent outline-none px-1 py-0.5"
            >
              <option value="">—</option>
              <option value="complete_healing">Complete healing</option>
              <option value="wound_bed_prep">Wound bed prep</option>
              <option value="palliative">Palliative</option>
              <option value="infection_control">Infection control</option>
              <option value="other">Other</option>
            </select>
            {formData.goalOfTherapy === "other" && (
              <FormInput
                value={formData.goalOfTherapyOther}
                onChange={(v) => set("goalOfTherapyOther", v)}
                className="w-40"
                placeholder="Specify"
              />
            )}
            <span className="text-[#ccc] mx-1">|</span>
            <FL>Adjuncts</FL>
            <FormCheckbox checked={formData.adjunctOffloading} onChange={(v) => set("adjunctOffloading", v)} label="Offloading" />
            <FormCheckbox checked={formData.adjunctCompression} onChange={(v) => set("adjunctCompression", v)} label="Compression" />
            <FormCheckbox checked={formData.adjunctDebridement} onChange={(v) => set("adjunctDebridement", v)} label="Debridement" />
            <span className="inline-flex items-center gap-1 flex-1 min-w-[140px]">
              <FL>Other</FL>
              <FormInput
                value={formData.adjunctOther}
                onChange={(v) => set("adjunctOther", v)}
                className="flex-1"
                placeholder="—"
              />
            </span>
          </div>

          {/* ── 15c (NESTED). SPECIALTY CONSULTS (Fortify expansion) ── */}
          <div className="flex items-center gap-1">
            <FL>Specialty Consults</FL>
            <FormInput
              value={formData.specialtyConsults}
              onChange={(v) => set("specialtyConsults", v)}
              className="flex-1"
              placeholder="e.g. Vascular, Endo, Pod"
            />
          </div>

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

        {/* ── 15b. POST-SURGICAL: disposition questions ──
            Only on the post-surgical variant per the template. Chronic
            doesn't render these. */}
        {isPostSurgical && (
          <>
            <DocRow>
              <FL className="flex-1">
                Is the patient going to home health after surgery?
              </FL>
              <FormCheckbox
                checked={formData.isReceivingHomeHealth}
                onChange={(v) => set("isReceivingHomeHealth", v)}
                label="Yes"
              />
              <FormCheckbox
                checked={!formData.isReceivingHomeHealth}
                onChange={(v) => set("isReceivingHomeHealth", !v)}
                label="No"
              />
            </DocRow>
            <DocRow>
              <FL className="flex-1">Is patient at a SNF?</FL>
              <FormCheckbox
                checked={formData.isPatientAtSnf}
                onChange={(v) => set("isPatientAtSnf", v)}
                label="Yes"
              />
              <FormCheckbox
                checked={!formData.isPatientAtSnf}
                onChange={(v) => set("isPatientAtSnf", !v)}
                label="No"
              />
            </DocRow>
          </>
        )}

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

        {/* ── 17. PRODUCT DISPENSED (editable) ── */}
        <div className="py-2 border-b border-[#e5e5e5]">
          <FL className="block mb-0.5">Product Dispensed</FL>
          <p className="text-[10px] text-[#777] italic mb-2 leading-tight">
            (Please see attached prescription and patient acknowledgement of
            receipt)
          </p>

          {draftItems.length > 0 ? (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-[#999]">
                  <th className="text-left py-1.5 font-semibold text-[#333] w-[90px]">
                    SKU
                  </th>
                  <th className="text-left py-1.5 font-semibold text-[#333]">
                    Product
                  </th>
                  <th className="text-center py-1.5 font-semibold text-[#333] w-28">
                    Qty
                  </th>
                  {itemsEditable && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {draftItems.map((item) => {
                  const baseline = itemsBaseline.find((b) => b.id === item.id);
                  const qtyChanged = !item.isNew && baseline && baseline.quantity !== item.quantity;
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-[#e5e5e5]",
                        item.isNew && "bg-emerald-50",
                        qtyChanged && "bg-amber-50",
                      )}
                    >
                      <td className="py-1.5 font-mono text-[11px] text-[#666]">
                        {item.productSku}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <span>{item.productName}</span>
                          {item.hcpcsCode && (
                            <span className="text-[10px] font-mono font-medium text-[var(--blue)] bg-[var(--blue-lt)] rounded px-1.5 py-0.5">
                              {item.hcpcsCode}
                            </span>
                          )}
                          {item.isNew && (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">
                              New
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 text-center">
                        {itemsEditable ? (
                          <div className="inline-flex items-center gap-1 border border-[#ccc] rounded overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleItemQtyChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1 || isSaving}
                              className="h-6 w-6 flex items-center justify-center hover:bg-[#eee] disabled:opacity-40"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-[13px] font-medium min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleItemQtyChange(item.id, item.quantity + 1)}
                              disabled={isSaving}
                              className="h-6 w-6 flex items-center justify-center hover:bg-[#eee] disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span>{item.quantity}</span>
                        )}
                      </td>
                      {itemsEditable && (
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleItemRemove(item.id)}
                            disabled={isSaving}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#999] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#333]">
                  <td colSpan={itemsEditable ? 4 : 3} className="py-1 text-[10px] text-[#999]">
                    {draftItems.length} item(s) ·{" "}
                    {draftItems.reduce((sum, i) => sum + i.quantity, 0)} unit(s)
                    {isItemsDirty && (
                      <span className="ml-2 text-amber-600 font-medium">
                        · Unsaved changes — save the Order Form to commit
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="py-3 text-center text-xs text-[#999] border border-dashed border-[#ccc] rounded mt-2">
              {itemsEditable
                ? "No products added — use the catalog below to add products."
                : "No products on this order."}
            </div>
          )}

          {/* Catalog picker — only shown while the status allows editing.
              Search matches name/SKU/category/HCPCS. Adding stays as draft
              until the Order Form is saved. */}
          {itemsEditable && (
            <div className="mt-4 pt-3 border-t border-[#e5e5e5]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <FL className="block">Browse catalog</FL>
                  <p className="text-[10px] text-[#777] italic leading-tight">
                    Click <Plus className="inline w-3 h-3 -mt-0.5" /> to add. Changes save when you click Save.
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search SKU, name, HCPCS…"
                    className="h-7 w-56 pl-7 pr-2 text-[12px] border border-[#ccc] rounded focus:border-[var(--navy)] focus:outline-none"
                  />
                </div>
              </div>
              {productsLoading ? (
                <div className="py-4 text-center text-xs text-[#999]">
                  <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
                  Loading catalog…
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-3 text-center text-xs text-[#999]">
                  No products match your search.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-[#e5e5e5] rounded divide-y divide-[#f0f0f0]">
                  {filteredProducts.map((p) => {
                    const inDraft = draftItems.find((d) => d.productId === p.id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 py-1.5 px-2 text-[12px]",
                          inDraft ? "bg-[#f0fdf4]" : "hover:bg-[#f8fafc]",
                        )}
                      >
                        <span className="font-mono text-[11px] text-[#666] w-20 shrink-0">
                          {p.sku}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--navy)] truncate">
                            {p.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.category && (
                              <span className="text-[10px] text-[#94a3b8] bg-[#f1f5f9] rounded px-1.5 py-0.5">
                                {p.category}
                              </span>
                            )}
                            {p.hcpcs_code && (
                              <span className="text-[10px] font-mono font-medium text-[var(--blue)] bg-[var(--blue-lt)] rounded px-1.5 py-0.5">
                                {p.hcpcs_code}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddProductToDraft(p)}
                          disabled={isSaving}
                          className={cn(
                            "w-7 h-7 rounded flex items-center justify-center shrink-0 text-white transition-colors",
                            inDraft
                              ? "bg-[var(--teal)] hover:bg-[var(--teal)]/80"
                              : "bg-[var(--navy)] hover:bg-[var(--navy)]/80",
                            "disabled:opacity-40",
                          )}
                          title={inDraft ? `In order (qty ${inDraft.quantity})` : "Add to order"}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 17b. PRODUCT METADATA (Fortify expansion) ──
            Application frequency, special HCPCS modifiers, prior-auth flag.
            Lives at the order-form level (not per item) since it describes
            how the product set is dispensed/billed as a whole. */}
        <DocRow>
          <FL>Frequency</FL>
          <FormInput
            value={formData.applicationFrequency}
            onChange={(v) => set("applicationFrequency", v)}
            className="w-32"
            placeholder="e.g. weekly, every 3 days"
          />
          <span className="text-[#ccc] mx-1">|</span>
          <FL>Modifiers (KX/GA)</FL>
          <FormInput
            value={formData.specialModifiers}
            onChange={(v) => set("specialModifiers", v)}
            className="w-28"
            placeholder="KX, GA"
          />
          <span className="text-[#ccc] mx-1">|</span>
          <FormCheckbox
            checked={formData.priorAuthObtained}
            onChange={(v) => set("priorAuthObtained", v)}
            label="Prior auth obtained"
          />
        </DocRow>

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

        {/* ── 18b. COVERAGE SELF-CHECK (Fortify expansion) ──
            Lives between Follow Up (18) and Signature (19). Clinic billing
            staff fills it per Fortify spec page 9; admins/support can also
            edit. Reps are locked out via the form's outer `isReadOnly`
            fieldset (no extra gate needed here). */}
        <div className="py-2 border-b border-[#e5e5e5] space-y-1.5">
          <FL>Coverage Self-Check (LCD/NCD)</FL>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <FL>LCD/NCD ref</FL>
            <FormInput
              value={formData.lcdReference}
              onChange={(v) => set("lcdReference", v)}
              className="flex-1 min-w-[200px]"
              placeholder="e.g. L33831 — Surgical Dressings"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <YesNoToggle label="Wound meets LCD?" value={formData.woundMeetsLcd} onChange={(v) => set("woundMeetsLcd", v)} />
            <YesNoToggle label="Conservative tx period met?" value={formData.conservativeTxPeriodMet} onChange={(v) => set("conservativeTxPeriodMet", v)} />
            <YesNoToggle label="Qty within LCD?" value={formData.qtyWithinLcdLimits} onChange={(v) => set("qtyWithinLcdLimits", v)} />
            <span className="inline-flex items-center gap-1">
              <FL>KX criteria</FL>
              <select
                value={formData.kxCriteriaMet ?? ""}
                onChange={(e) =>
                  set(
                    "kxCriteriaMet",
                    (e.target.value || null) as "yes" | "no" | "na" | null,
                  )
                }
                className="border-0 border-b border-[#333] text-[12px] bg-transparent outline-none px-1 py-0.5"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">N/A</option>
              </select>
            </span>
            <YesNoToggle label="POS eligible?" value={formData.posEligible} onChange={(v) => set("posEligible", v)} />
          </div>
          <div className="flex items-center gap-1">
            <FL>Concerns</FL>
            <FormInput
              value={formData.coverageConcerns}
              onChange={(v) => set("coverageConcerns", v)}
              className="flex-1"
              placeholder="Any concerns about coverage?"
            />
          </div>
        </div>

        {/* ── 18c. PHYSICIAN ATTESTATION (Fortify expansion) ──
            Five-point certification mandated by ADR documentation. ALL FIVE
            must be checked before the Sign button is enabled. Per spec
            decision (#4) these are required to sign — must be physician-
            affirmed and never AI-prefilled. */}
        <div className="py-2 border-b border-[#e5e5e5]">
          <p className="text-[11px] text-[#222] leading-snug mb-1.5">
            <strong>I, the undersigned physician, certify that:</strong>
          </p>
          <div className="space-y-1 pl-2 text-[11px] text-[#333] leading-snug">
            <FormCheckbox
              checked={formData.attestExaminedPatient}
              onChange={(v) => set("attestExaminedPatient", v)}
              label="1. I have personally examined the patient and assessed the wound described above."
            />
            <FormCheckbox
              checked={formData.attestMedicallyNecessary}
              onChange={(v) => set("attestMedicallyNecessary", v)}
              label="2. The product(s) ordered above are medically necessary for the treatment of this wound."
            />
            <FormCheckbox
              checked={formData.attestConservativeTxInadequate}
              onChange={(v) => set("attestConservativeTxInadequate", v)}
              label="3. Conservative treatments have been tried and are inadequate for this wound."
            />
            <FormCheckbox
              checked={formData.attestFreqQtyClinicalJudgment}
              onChange={(v) => set("attestFreqQtyClinicalJudgment", v)}
              label="4. The frequency and quantity ordered reflect my clinical judgment of what is needed for this patient."
            />
            <FormCheckbox
              checked={formData.attestLcdSupported}
              onChange={(v) => set("attestLcdSupported", v)}
              label="5. To my knowledge, the documentation in this form and the patient's medical record supports the criteria of the applicable LCD or NCD."
            />
          </div>
          {!allAttestationsChecked && canSign && !formData.physicianSignedAt && (
            <p className="text-[10px] text-[#dc2626] mt-1.5 italic">
              All five certifications must be checked before signing.
            </p>
          )}
        </div>

        {/* ── 18d. PHYSICIAN NPI (Fortify expansion) ── */}
        <DocRow>
          <FL>Physician NPI</FL>
          <FormInput
            value={formData.physicianNpi}
            onChange={(v) => set("physicianNpi", v)}
            className="w-32"
            placeholder="10-digit NPI"
          />
        </DocRow>

        {/* ── 19. SIGNATURE ──
            Layout mirrors the generated PDF: value sits on the line,
            tiny caption label below. Fixed cell height keeps underlines
            aligned across signed / unsigned states. */}
        <div ref={signatureSectionRef} className="pt-4 mt-2 grid grid-cols-[1fr_220px] gap-8">
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
              ) : canSignWithAttestations ? (
                <button
                  type="button"
                  onClick={() => setSignModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#0f2d4a] text-[#0f2d4a] text-[11px] font-semibold hover:bg-[#0f2d4a] hover:text-white transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5 shrink-0" />
                  Sign
                </button>
              ) : canSign && !allAttestationsChecked ? (
                <span className="text-[11px] text-[#dc2626] italic">
                  Check all 5 attestations to enable Sign
                </span>
              ) : (
                <span className="text-[11px] text-[#999] italic">
                  Awaiting provider signature
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#777]">
                Physicians Signature
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

          {/* DATE SIGNED CELL */}
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
                  className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#bbb]"
                />
              )}
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#777]">
              Date Signed
            </div>
          </div>

          {/* PATIENT NAME CELL */}
          <div>
            <div className="h-12 flex items-end border-b border-[#333] pb-1">
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => set("patientName", e.target.value)}
                placeholder="—"
                className="w-full text-[13px] font-semibold text-[#111] bg-transparent outline-none placeholder:text-[#bbb]"
              />
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#777]">
              Patient Name
            </div>
          </div>

          {/* DATE OF SERVICE CELL */}
          <div>
            <div className="h-12 flex items-end border-b border-[#333] pb-1">
              <input
                type="text"
                value={formData.patientDate}
                onChange={(e) => set("patientDate", e.target.value)}
                placeholder="—"
                className="w-full text-[13px] font-semibold text-[#111] bg-transparent outline-none placeholder:text-[#bbb]"
              />
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#777]">
              Date of Service
            </div>
          </div>
        </div>

        {/* ── 19b. INTERNAL TRACKING (Fortify expansion — admin-only) ──
            Office-use tracking block. Never rendered on the patient-facing
            PDF; lives inside the on-screen form for admin/support to log
            receipt method, BAA flag, doc-completion review, and gap notes.
            Collapsible to keep the form short for non-admin viewers. */}
        {isAdmin && (
          <details className="mt-3 border-t-2 border-dashed border-[#888] pt-3 text-[12px]">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-[#666] select-none">
              Internal Tracking (admin only)
            </summary>
            <div className="mt-2 space-y-1.5 bg-[#fafafa] border border-[#e5e5e5] p-2 rounded">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <FL>Method of Receipt</FL>
                <FormInput
                  value={formData.officeMethodOfReceipt}
                  onChange={(v) => set("officeMethodOfReceipt", v)}
                  className="w-44"
                  placeholder="Encrypted email / portal / other"
                />
                <span className="text-[#ccc] mx-1">|</span>
                <YesNoToggle
                  label="BAA in place?"
                  value={formData.officeBaaInPlace}
                  onChange={(v) => set("officeBaaInPlace", v)}
                />
                <span className="text-[#ccc] mx-1">|</span>
                <FL>Reviewed by</FL>
                <FormInput
                  value={formData.officeReviewedBy}
                  onChange={(v) => set("officeReviewedBy", v)}
                  className="w-32"
                  placeholder="Name"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <YesNoToggle
                  label="Doc complete?"
                  value={formData.officeDocumentationComplete}
                  onChange={(v) => set("officeDocumentationComplete", v)}
                />
                <span className="text-[#ccc] mx-1">|</span>
                <YesNoToggle
                  label="Released to fulfillment?"
                  value={formData.officeReleasedToFulfillment}
                  onChange={(v) => set("officeReleasedToFulfillment", v)}
                />
                {formData.officeReleasedToFulfillment === true && (
                  <FormInput
                    type="date"
                    value={formData.officeReleasedToFulfillmentAt}
                    onChange={(v) => set("officeReleasedToFulfillmentAt", v)}
                    className="w-36"
                  />
                )}
                <span className="text-[#ccc] mx-1">|</span>
                <YesNoToggle
                  label="Filed in repository?"
                  value={formData.officeFiledInRepository}
                  onChange={(v) => set("officeFiledInRepository", v)}
                />
              </div>
              <div className="flex items-center gap-1">
                <FL>Gaps Identified</FL>
                <FormInput
                  value={formData.officeGapsIdentified}
                  onChange={(v) => set("officeGapsIdentified", v)}
                  className="flex-1"
                  placeholder="Documentation gaps to follow up on"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <FL>Gaps communicated</FL>
                <FormInput
                  type="date"
                  value={formData.officeGapsCommunicatedAt}
                  onChange={(v) => set("officeGapsCommunicatedAt", v)}
                  className="w-36"
                />
                <span className="text-[#ccc] mx-1">|</span>
                <FL>Gaps resolved</FL>
                <FormInput
                  type="date"
                  value={formData.officeGapsResolvedAt}
                  onChange={(v) => set("officeGapsResolvedAt", v)}
                  className="w-36"
                />
              </div>
            </div>
          </details>
        )}
        </fieldset>
      </div>

      <SignOrderModal
        open={signModalOpen}
        onOpenChange={setSignModalOpen}
        order={order}
        providerName={currentUserName ?? "Provider"}
        title="Sign Order Form"
        successMessage="Signature captured. Click Save to commit."
        // Modal only verifies the PIN — no DB write here. The actual
        // sign is committed when the provider clicks Save on the form,
        // which runs the form-fields save + signOrderFormWithSpecimen.
        onSign={(pin) => verifyProviderPin(pin)}
        onSuccess={(signatureImage, pin) => {
          const now = new Date().toISOString();
          setSpecimenSignatureUrl(signatureImage);
          setPendingPin(pin);
          // Flip local signed state but leave baseline untouched so the
          // Save bar appears until the user commits.
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
