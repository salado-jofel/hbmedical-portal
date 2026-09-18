"use client";

/**
 * StandaloneIvrForm
 *
 * Rich IVR form for standalone_ivrs, visually matching the order-side
 * IVRFormDocument (Meridian header, dark section headers, TwoCol grid,
 * FormCheckbox / TriRadio primitives). This is a controlled component:
 * parent owns `value` + `onChange`, and calls `onSave` when ready. No
 * network, no auto-save, no signature/lock ceremony — the order-side
 * IVR form has those but the standalone stage doesn't need them (save
 * IS the approval for fax-originated IVRs).
 *
 * Kept slim vs. the 2000-line order-side form by not rendering
 * chronic-only insurance verification blocks (deductible / OOP /
 * detailed prior auth) unless the caller opts into `showVerification`.
 * The columns exist in the DB so the same component can be extended
 * without another migration when the client asks for them.
 */

import { useMemo, type InputHTMLAttributes } from "react";
import { MapPin, Mail, Globe, Phone } from "lucide-react";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { cn } from "@/utils/utils";
// Value shape + fold/merge helpers now live in a server-safe file so
// server routes (PDF gen, etc.) can import them without pulling in
// this "use client" module. Re-exported below for browser callers
// that still expect them from this path.
import {
  emptyStandaloneIvrForm,
  foldIvrToFormValue,
  mergeAiExtract,
  type StandaloneIvrFormValue,
} from "./standalone-ivr-form-value";
export {
  emptyStandaloneIvrForm,
  foldIvrToFormValue,
  mergeAiExtract,
  type StandaloneIvrFormValue,
};

/* ── Design tokens (mirror IVRFormDocument) ── */
const NAVY = "#0f2d4a";
const TEAL = "#0d7a6b";

/** Utility — turn an incoming value (any of null/undefined/number/etc) into
 *  the string the underlying <input> expects. Empty string when null. */
const s = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

interface StandaloneIvrFormProps {
  value: StandaloneIvrFormValue;
  onChange: (patch: Partial<StandaloneIvrFormValue>) => void;
  disabled?: boolean;
  /** Highlight empty required-ish fields in red. Turn on after the AI
   *  extract runs — user sees at a glance which fields didn't get
   *  filled and need manual attention. */
  highlightEmpty?: boolean;
}

/* ── Layout primitives (visually identical to IVRFormDocument's) ── */

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

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-2 pt-2 pb-1">
      {children}
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <FL>{label}</FL>
      {children}
    </div>
  );
}

function FormInput({
  value,
  onChange,
  highlight,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "required"> & {
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  const isEmptyHighlight = highlight && !value;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "border-b outline-none bg-transparent text-[12px] px-1 py-[3px] min-w-0",
        isEmptyHighlight
          ? "border-red-400 bg-red-50/40"
          : "border-[#bbb] focus:border-[#666]",
        className,
      )}
      {...props}
    />
  );
}

function FormCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 accent-[var(--navy)]"
      />
      <span>{label}</span>
    </label>
  );
}

function TriRadio({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {["Yes", "No", "Not Sure"].map((opt) => (
        <FormCheckbox
          key={opt}
          checked={value === opt}
          onChange={() => onChange(value === opt ? "" : opt)}
          label={opt}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/* ── Enum data (mirrors IVR form) ── */
const PLACES_OF_SERVICE = [
  "Office (11)",
  "Patient home (12)",
  "Assisted Living Facility (13)",
  "Off Campus Outpatient Hospital (19)",
  "Hospital outpatient (22)",
  "Ambulatory Surgical Center (24)",
  "Independent Clinic (49)",
] as const;

const IVR_WOUND_TYPES = [
  "Diabetic Foot Ulcer",
  "Venous Leg Ulcer",
  "Pressure Ulcer",
  "Traumatic Burns",
  "Radiation Burns",
  "Necrotizing Fasciitis",
  "Dehisced Surgical Wound",
  "Post-Surgical Incision",
] as const;

/* ── Component ── */

export function StandaloneIvrForm({
  value,
  onChange,
  disabled,
  highlightEmpty,
}: StandaloneIvrFormProps) {
  // Local getter so downstream JSX stays terse. `String(...)` because
  // numeric columns come off the row as `number` but the underlying
  // input needs a string.
  const set = <K extends keyof StandaloneIvrFormValue>(
    key: K,
    val: StandaloneIvrFormValue[K],
  ) => onChange({ [key]: val } as Partial<StandaloneIvrFormValue>);

  // Numeric inputs — controlled via string, parsed to number|null on
  // change so DB writes get a proper NUMERIC value.
  const setNumeric = (
    key: keyof StandaloneIvrFormValue,
    raw: string,
  ) => {
    const trimmed = raw.trim();
    const parsed =
      trimmed === "" ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
    onChange({ [key]: parsed } as Partial<StandaloneIvrFormValue>);
  };

  return (
    <fieldset
      disabled={disabled}
      className={cn(
        "m-0 p-0 border-0 bg-white",
        disabled && "opacity-90",
      )}
    >
      <div
        className="mx-auto bg-white"
        style={{
          padding: "20px 24px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
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
          <div className="text-right space-y-0.5">
            {[
              { Icon: MapPin, text: "235 Singleton Ridge Road Suite 105, Conway SC 29526" },
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
        </div>

        {/* ── Place of Service ── */}
        <SectionHeader title="Place of Service" />
        <div className="px-2 pt-2 pb-2 border-b border-[#e5e5e5]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {PLACES_OF_SERVICE.map((pos) => (
              <FormCheckbox
                key={pos}
                checked={value.placeOfService === pos}
                onChange={(c) => set("placeOfService", c ? pos : null)}
                label={pos}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* ── Sales Rep ── */}
        <div className="flex items-end gap-2 py-2 border-b border-[#e5e5e5]">
          <FL>Sales Rep</FL>
          <FormInput
            value={s(value.salesRepName)}
            onChange={(v) => set("salesRepName", v || null)}
            className="flex-1 max-w-xs"
            placeholder="Sales representative name"
            highlight={highlightEmpty}
          />
        </div>

        {/* ── Facility Information ── */}
        <SectionHeader title="Facility Information" />
        <TwoCol>
          <FieldBlock label="Facility Name">
            <FormInput
              value={s(value.facilityName)}
              onChange={(v) => set("facilityName", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="Medicare Admin Contractor">
            <FormInput
              value={s(value.medicareAdminContractor)}
              onChange={(v) => set("medicareAdminContractor", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Address">
            <FormInput
              value={s(value.facilityAddress)}
              onChange={(v) => set("facilityAddress", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="NPI">
            <FormInput
              value={s(value.facilityNpi)}
              onChange={(v) => set("facilityNpi", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Contact Name">
            <FormInput
              value={s(value.facilityContact)}
              onChange={(v) => set("facilityContact", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="TIN">
            <FormInput
              value={s(value.facilityTin)}
              onChange={(v) => set("facilityTin", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Phone">
            <FormInput
              value={s(value.facilityPhone)}
              onChange={(v) => set("facilityPhone", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="PTAN">
            <FormInput
              value={s(value.facilityPtan)}
              onChange={(v) => set("facilityPtan", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Fax">
            <FormInput
              value={s(value.facilityFax)}
              onChange={(v) => set("facilityFax", v || null)}
              className="w-full"
            />
          </FieldBlock>
        </TwoCol>

        {/* ── Physician ── */}
        <SectionHeader title="Physician / Requesting Provider" />
        <TwoCol>
          <FieldBlock label="Physician Name">
            <FormInput
              value={s(value.physicianName)}
              onChange={(v) => set("physicianName", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="NPI">
            <FormInput
              value={s(value.physicianNpi)}
              onChange={(v) => set("physicianNpi", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="Address">
            <FormInput
              value={s(value.physicianAddress)}
              onChange={(v) => set("physicianAddress", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="TIN">
            <FormInput
              value={s(value.physicianTin)}
              onChange={(v) => set("physicianTin", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Phone">
            <FormInput
              value={s(value.physicianPhone)}
              onChange={(v) => set("physicianPhone", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Fax">
            <FormInput
              value={s(value.physicianFax)}
              onChange={(v) => set("physicianFax", v || null)}
              className="w-full"
            />
          </FieldBlock>
        </TwoCol>

        {/* ── Patient ── */}
        <SectionHeader title="Patient Information" />
        <TwoCol>
          <FieldBlock label="Patient Name">
            <FormInput
              value={s(value.patientName)}
              onChange={(v) => set("patientName", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="DOB">
            <FormInput
              type="date"
              value={s(value.patientDob)}
              onChange={(v) => set("patientDob", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="Phone">
            <FormInput
              value={s(value.patientPhone)}
              onChange={(v) => set("patientPhone", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Address">
            <FormInput
              value={s(value.patientAddress)}
              onChange={(v) => set("patientAddress", v || null)}
              className="w-full"
            />
          </FieldBlock>
        </TwoCol>
        <div className="px-2 pb-2 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3 mt-1">
            <FL>OK to contact patient?</FL>
            <FormCheckbox
              checked={value.okToContactPatient === true}
              onChange={(c) => set("okToContactPatient", c ? true : c === false ? false : null)}
              label="Yes"
              disabled={disabled}
            />
            <FormCheckbox
              checked={value.okToContactPatient === false}
              onChange={(c) => set("okToContactPatient", c ? false : null)}
              label="No"
              disabled={disabled}
            />
            <FL>SNF Patient?</FL>
            <FormCheckbox
              checked={value.isPatientAtSnf === true}
              onChange={(c) => set("isPatientAtSnf", c ? true : c === false ? false : null)}
              label="Yes"
              disabled={disabled}
            />
            <FormCheckbox
              checked={value.isPatientAtSnf === false}
              onChange={(c) => set("isPatientAtSnf", c ? false : null)}
              label="No"
              disabled={disabled}
            />
          </div>
        </div>

        {/* ── Primary Insurance ── */}
        <SectionHeader title="Primary Insurance" />
        <TwoCol>
          <FieldBlock label="Insurance Provider">
            <FormInput
              value={s(value.insuranceProvider)}
              onChange={(v) => set("insuranceProvider", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="Insurance Phone">
            <FormInput
              value={s(value.insurancePhone)}
              onChange={(v) => set("insurancePhone", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Member ID">
            <FormInput
              value={s(value.memberId)}
              onChange={(v) => set("memberId", v || null)}
              className="w-full"
              highlight={highlightEmpty}
            />
          </FieldBlock>
          <FieldBlock label="Group Number">
            <FormInput
              value={s(value.groupNumber)}
              onChange={(v) => set("groupNumber", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Plan Name">
            <FormInput
              value={s(value.planName)}
              onChange={(v) => set("planName", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Plan Type">
            <FormInput
              value={s(value.planType)}
              onChange={(v) => set("planType", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Patient / Subscriber Name">
            <FormInput
              value={s(value.subscriberName)}
              onChange={(v) => set("subscriberName", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Subscriber DOB">
            <FormInput
              type="date"
              value={s(value.subscriberDob)}
              onChange={(v) => set("subscriberDob", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Relationship to Patient">
            <FormInput
              value={s(value.subscriberRelationship)}
              onChange={(v) => set("subscriberRelationship", v || null)}
              className="w-full"
              placeholder="Self / Spouse / Child / Other"
            />
          </FieldBlock>
          <FieldBlock label="Provider Participates?">
            <TriRadio
              value={s(value.providerParticipatesPrimary)}
              onChange={(v) => set("providerParticipatesPrimary", v || null)}
              disabled={disabled}
            />
          </FieldBlock>
        </TwoCol>

        {/* ── Secondary Insurance ── */}
        <SectionHeader title="Secondary Insurance (if any)" />
        <TwoCol>
          <FieldBlock label="Insurance Provider">
            <FormInput
              value={s(value.secondaryInsuranceProvider)}
              onChange={(v) => set("secondaryInsuranceProvider", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Insurance Phone">
            <FormInput
              value={s(value.secondaryInsurancePhone)}
              onChange={(v) => set("secondaryInsurancePhone", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Patient / Subscriber Name">
            <FormInput
              value={s(value.secondarySubscriberName)}
              onChange={(v) => set("secondarySubscriberName", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Policy Number">
            <FormInput
              value={s(value.secondaryPolicyNumber)}
              onChange={(v) => set("secondaryPolicyNumber", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Subscriber DOB">
            <FormInput
              type="date"
              value={s(value.secondarySubscriberDob)}
              onChange={(v) => set("secondarySubscriberDob", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Plan Type">
            <FormInput
              value={s(value.secondaryPlanType)}
              onChange={(v) => set("secondaryPlanType", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Group Number">
            <FormInput
              value={s(value.secondaryGroupNumber)}
              onChange={(v) => set("secondaryGroupNumber", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Relationship to Patient">
            <FormInput
              value={s(value.secondarySubscriberRelationship)}
              onChange={(v) =>
                set("secondarySubscriberRelationship", v || null)
              }
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Provider Participates?">
            <TriRadio
              value={s(value.providerParticipatesSecondary)}
              onChange={(v) => set("providerParticipatesSecondary", v || null)}
              disabled={disabled}
            />
          </FieldBlock>
        </TwoCol>

        {/* ── Wound & Procedure ── */}
        <SectionHeader title="Wound & Procedure" />
        <TwoCol>
          <FieldBlock label="Wound Type">
            <select
              value={s(value.woundType)}
              onChange={(e) => set("woundType", e.target.value || null)}
              className="w-full border-b border-[#bbb] bg-transparent text-[12px] px-1 py-[3px] focus:outline-none focus:border-[#666]"
              disabled={disabled}
            >
              <option value="">—</option>
              {IVR_WOUND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FieldBlock>
          <FieldBlock label="Wound Sizes">
            <FormInput
              value={s(value.woundSizes)}
              onChange={(v) => set("woundSizes", v || null)}
              className="w-full"
              placeholder="e.g. 2.5cm × 3cm × 0.4cm"
            />
          </FieldBlock>
          <FieldBlock label="Application CPT(s)">
            <FormInput
              value={s(value.applicationCpts)}
              onChange={(v) => set("applicationCpts", v || null)}
              className="w-full"
              placeholder="e.g. 15275, 15276"
            />
          </FieldBlock>
          <FieldBlock label="Date of Procedure">
            <FormInput
              type="date"
              value={s(value.dateOfProcedure)}
              onChange={(v) => set("dateOfProcedure", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="ICD-10 Codes">
            <FormInput
              value={s(value.icd10Codes)}
              onChange={(v) => set("icd10Codes", v || null)}
              className="w-full"
              placeholder="e.g. E11.621, L97.529"
            />
          </FieldBlock>
          <FieldBlock label="Product / Service Information">
            <FormInput
              value={s(value.productInformation)}
              onChange={(v) => set("productInformation", v || null)}
              className="w-full"
              placeholder="Product name(s) + quantity"
            />
          </FieldBlock>
          <FieldBlock label="Global Period?">
            <TriRadio
              value={
                value.surgicalGlobalPeriod === true
                  ? "Yes"
                  : value.surgicalGlobalPeriod === false
                    ? "No"
                    : ""
              }
              onChange={(v) =>
                set(
                  "surgicalGlobalPeriod",
                  v === "Yes" ? true : v === "No" ? false : null,
                )
              }
              disabled={disabled}
            />
          </FieldBlock>
          <FieldBlock label="Global Period CPT">
            <FormInput
              value={s(value.globalPeriodCpt)}
              onChange={(v) => set("globalPeriodCpt", v || null)}
              className="w-full"
            />
          </FieldBlock>
          <FieldBlock label="Prior Auth Permission?">
            <TriRadio
              value={
                value.priorAuthPermission === true
                  ? "Yes"
                  : value.priorAuthPermission === false
                    ? "No"
                    : ""
              }
              onChange={(v) =>
                set(
                  "priorAuthPermission",
                  v === "Yes" ? true : v === "No" ? false : null,
                )
              }
              disabled={disabled}
            />
          </FieldBlock>
          <FieldBlock label="Prior Auth Number">
            <FormInput
              value={s(value.priorAuthNumber)}
              onChange={(v) => set("priorAuthNumber", v || null)}
              className="w-full"
            />
          </FieldBlock>
        </TwoCol>

        {/* ── Back-office notes ── */}
        <SectionHeader title="Notes" />
        <div className="px-2 pt-2 pb-3">
          <textarea
            value={s(value.formNotes)}
            onChange={(e) => set("formNotes", e.target.value || null)}
            rows={3}
            placeholder="Internal notes (not shown to physician)"
            className="w-full border border-[#d1d5db] rounded-md p-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
            disabled={disabled}
          />
        </div>
      </div>
    </fieldset>
  );
}

/* Empty-fields hook — used by the modal to gate the auto-fill CTA
   copy ("Auto-fill with AI" vs "Re-extract with AI"). */
export function useIsEmpty(value: StandaloneIvrFormValue): boolean {
  return useMemo(() => {
    return Object.values(value).every(
      (v) =>
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === ""),
    );
  }, [value]);
}
