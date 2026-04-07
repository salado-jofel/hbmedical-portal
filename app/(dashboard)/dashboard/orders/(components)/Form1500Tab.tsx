"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { upsertForm1500 } from "../(services)/actions";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import type { IServiceLine } from "@/utils/interfaces/orders";

type Form1500Data = Record<string, string | boolean | number | null | IServiceLine[]>;

interface Form1500TabProps {
  orderId: string;
  canEdit: boolean;
  initialData: Record<string, unknown> | null;
  isReady: boolean;
  onSave?: (data: Record<string, unknown>) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const REQUIRED_FIELDS: { field: string; label: string; box: string }[] = [
  { field: "insurance_type",        label: "Insurance Type",        box: "1"   },
  { field: "insured_id_number",     label: "Insured ID Number",     box: "1a"  },
  { field: "patient_last_name",     label: "Patient Last Name",     box: "2"   },
  { field: "patient_first_name",    label: "Patient First Name",    box: "2"   },
  { field: "patient_dob",           label: "Patient Date of Birth", box: "3"   },
  { field: "patient_sex",           label: "Patient Sex",           box: "3"   },
  { field: "insured_last_name",     label: "Insured Last Name",     box: "4"   },
  { field: "insured_first_name",    label: "Insured First Name",    box: "4"   },
  { field: "patient_address",       label: "Patient Address",       box: "5"   },
  { field: "patient_city",          label: "Patient City",          box: "5"   },
  { field: "patient_state",         label: "Patient State",         box: "5"   },
  { field: "patient_zip",           label: "Patient Zip",           box: "5"   },
  { field: "diagnosis_a",           label: "Diagnosis Code A",      box: "21"  },
  { field: "federal_tax_id",        label: "Federal Tax ID",        box: "25"  },
  { field: "physician_signature",   label: "Physician Signature",   box: "31"  },
  { field: "billing_provider_name", label: "Billing Provider Name", box: "33"  },
  { field: "billing_provider_npi",  label: "Billing Provider NPI",  box: "33a" },
];

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  disabled,
  required,
  hasError,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (name: string, value: string) => void;
  disabled: boolean;
  required?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <Input
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, e.target.value)}
        className={cn(
          "h-8 text-sm",
          hasError && "border-red-400 bg-red-50 focus-visible:ring-red-200",
        )}
      />
    </div>
  );
}

function CheckField({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: boolean;
  onChange: (name: string, value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(name, e.target.checked)}
        className="rounded border-slate-300"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export function Form1500Tab({
  orderId,
  canEdit,
  initialData,
  isReady,
  onSave,
  onDirtyChange,
}: Form1500TabProps) {
  const [savedData, setSavedData] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [draftData, setDraftData] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [validationTouched, setValidationTouched] = useState(false);

  const isDirty = JSON.stringify(draftData) !== JSON.stringify(savedData);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when initialData changes (modal reopened for different order)
  useEffect(() => {
    setSavedData((initialData as Form1500Data) ?? {});
    setDraftData((initialData as Form1500Data) ?? {});
    setValidationTouched(false);
  }, [initialData]);

  function handleChange(name: string, value: string | boolean) {
    setDraftData((prev) => ({ ...prev, [name]: value }));
  }

  function handleDiscard() {
    setDraftData(savedData);
    setValidationTouched(false);
  }

  function getServiceLines(): IServiceLine[] {
    return (draftData.service_lines as IServiceLine[] | null) ?? [];
  }

  function updateServiceLine(
    id: string,
    field: keyof IServiceLine,
    value: string | boolean,
  ) {
    setDraftData((prev) => ({
      ...prev,
      service_lines: getServiceLines().map((l) =>
        l.id === id ? { ...l, [field]: value } : l,
      ),
    }));
  }

  function addServiceLine() {
    const newLine: IServiceLine = {
      id:                crypto.randomUUID(),
      dos_from:          "",
      dos_to:            "",
      place_of_service:  "",
      emg:               false,
      cpt_code:          "",
      modifier_1:        "",
      modifier_2:        "",
      modifier_3:        "",
      modifier_4:        "",
      diagnosis_pointer: "",
      charges:           "",
      days_units:        "1",
      epsdt:             "",
      id_qualifier:      "",
      rendering_npi:     "",
    };
    setDraftData((prev) => ({
      ...prev,
      service_lines: [...getServiceLines(), newLine],
    }));
  }

  function removeServiceLine(id: string) {
    setDraftData((prev) => ({
      ...prev,
      service_lines: getServiceLines().filter((l) => l.id !== id),
    }));
  }

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(({ field, label, box }) => {
      const value = draftData[field];
      if (!value || (typeof value === "string" && !value.trim())) {
        errors[field] = `Box ${box}: ${label} is required`;
      }
    });
    const sl = (draftData.service_lines as IServiceLine[] | null) ?? [];
    if (!sl.length) {
      errors["service_lines"] = "Box 24: At least one service line is required";
    }
    return errors;
  }, [draftData]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  function isReqField(name: string): boolean {
    return REQUIRED_FIELDS.some((f) => f.field === name);
  }

  function fieldError(name: string): boolean {
    return validationTouched && !!validationErrors[name];
  }

  async function handleSave() {
    setValidationTouched(true);
    if (hasErrors) {
      toast.error("Please fill in all required fields before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const result = await upsertForm1500(
        orderId,
        draftData as Record<string, unknown>,
      );
      if (result.success) {
        setSavedData(draftData);
        onSave?.(draftData as Record<string, unknown>);
        toast.success("1500 form saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function str(key: string): string {
    return (draftData[key] as string) ?? "";
  }

  function bool(key: string): boolean {
    return !!(draftData[key] as boolean);
  }

  if (!isReady) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const lines = getServiceLines();

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-300 py-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          HCFA / 1500 Form
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
      <div className="space-y-4 pb-4">
        {!canEdit && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            You have read-only access to this form.
          </p>
        )}

        {/* ── Validation banner ── */}
        {hasErrors && validationTouched && (
          <div className="mx-4 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs font-bold text-red-700 mb-1">
              Required fields missing:
            </p>
            <ul className="space-y-0.5">
              {Object.values(validationErrors).map((err, i) => (
                <li key={i} className="text-xs text-red-600">
                  • {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Accordion
          type="multiple"
          defaultValue={["insurance", "patient"]}
          className="space-y-2"
        >
          {/* ── 1. Insurance ── */}
          <AccordionItem
            value="insurance"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              1. Insurance Information
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">
                  Insurance Type
                  {isReqField("insurance_type") && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>
                <select
                  value={str("insurance_type")}
                  disabled={!canEdit}
                  onChange={(e) =>
                    handleChange("insurance_type", e.target.value)
                  }
                  className={cn(
                    "w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#15689E] disabled:opacity-60",
                    fieldError("insurance_type")
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200",
                  )}
                >
                  <option value="">Select...</option>
                  <option value="medicare">Medicare</option>
                  <option value="medicaid">Medicaid</option>
                  <option value="tricare">Tricare</option>
                  <option value="champva">CHAMPVA</option>
                  <option value="group_health_plan">Group Health Plan</option>
                  <option value="feca_blk_lung">FECA / Blk Lung</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <FormField
                label="Insured ID Number"
                name="insured_id_number"
                value={str("insured_id_number")}
                onChange={handleChange}
                disabled={!canEdit}
                required={isReqField("insured_id_number")}
                hasError={fieldError("insured_id_number")}
              />
              <FormField
                label="Prior Authorization Number"
                name="prior_auth_number"
                value={str("prior_auth_number")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 2. Patient Info ── */}
          <AccordionItem
            value="patient"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              2. Patient Information
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="Last Name"
                  name="patient_last_name"
                  value={str("patient_last_name")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_last_name")}
                  hasError={fieldError("patient_last_name")}
                />
                <FormField
                  label="First Name"
                  name="patient_first_name"
                  value={str("patient_first_name")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_first_name")}
                  hasError={fieldError("patient_first_name")}
                />
                <FormField
                  label="Middle Initial"
                  name="patient_middle_initial"
                  value={str("patient_middle_initial")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Date of Birth"
                  name="patient_dob"
                  type="date"
                  value={str("patient_dob")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_dob")}
                  hasError={fieldError("patient_dob")}
                />
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">
                    Sex
                    {isReqField("patient_sex") && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>
                  <select
                    value={str("patient_sex")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleChange("patient_sex", e.target.value)
                    }
                    className={cn(
                      "w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-60",
                      fieldError("patient_sex")
                        ? "border-red-400 bg-red-50"
                        : "border-slate-200",
                    )}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <FormField
                label="Address"
                name="patient_address"
                value={str("patient_address")}
                onChange={handleChange}
                disabled={!canEdit}
                required={isReqField("patient_address")}
                hasError={fieldError("patient_address")}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="City"
                  name="patient_city"
                  value={str("patient_city")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_city")}
                  hasError={fieldError("patient_city")}
                />
                <FormField
                  label="State"
                  name="patient_state"
                  value={str("patient_state")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_state")}
                  hasError={fieldError("patient_state")}
                />
                <FormField
                  label="ZIP"
                  name="patient_zip"
                  value={str("patient_zip")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("patient_zip")}
                  hasError={fieldError("patient_zip")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Phone"
                  name="patient_phone"
                  type="tel"
                  value={str("patient_phone")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">
                    Relationship to Insured
                  </label>
                  <select
                    value={str("patient_relationship")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleChange("patient_relationship", e.target.value)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select...</option>
                    <option value="self">Self</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <FormField
                label="Patient Account Number"
                name="patient_account_number"
                value={str("patient_account_number")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              {/* Box 12 / 13 — signatures */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Patient Signature (Box 12)"
                  name="patient_signature"
                  value={str("patient_signature")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Patient Signature Date"
                  name="patient_signature_date"
                  type="date"
                  value={str("patient_signature_date")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <FormField
                label="Insured Signature (Box 13)"
                name="insured_signature"
                value={str("insured_signature")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 3. Insured Info ── */}
          <AccordionItem
            value="insured"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              3. Insured Information
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="Last Name"
                  name="insured_last_name"
                  value={str("insured_last_name")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("insured_last_name")}
                  hasError={fieldError("insured_last_name")}
                />
                <FormField
                  label="First Name"
                  name="insured_first_name"
                  value={str("insured_first_name")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("insured_first_name")}
                  hasError={fieldError("insured_first_name")}
                />
                <FormField
                  label="Middle Initial"
                  name="insured_middle_initial"
                  value={str("insured_middle_initial")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <FormField
                label="Address"
                name="insured_address"
                value={str("insured_address")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  label="City"
                  name="insured_city"
                  value={str("insured_city")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="State"
                  name="insured_state"
                  value={str("insured_state")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="ZIP"
                  name="insured_zip"
                  value={str("insured_zip")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Phone"
                  name="insured_phone"
                  type="tel"
                  value={str("insured_phone")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Policy / Group Number"
                  name="insured_policy_group"
                  value={str("insured_policy_group")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Date of Birth"
                  name="insured_dob"
                  type="date"
                  value={str("insured_dob")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Sex</label>
                  <select
                    value={str("insured_sex")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleChange("insured_sex", e.target.value)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <FormField
                label="Employer / School Name"
                name="insured_employer"
                value={str("insured_employer")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Insurance Plan / Program Name"
                name="insured_plan_name"
                value={str("insured_plan_name")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 4. Other Insured ── */}
          <AccordionItem
            value="other_insured"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              4. Other Insured Information
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <FormField
                label="Other Insured Full Name"
                name="other_insured_name"
                value={str("other_insured_name")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Policy / Group Number"
                name="other_insured_policy"
                value={str("other_insured_policy")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Date of Birth"
                  name="other_insured_dob"
                  type="date"
                  value={str("other_insured_dob")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Sex</label>
                  <select
                    value={str("other_insured_sex")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleChange("other_insured_sex", e.target.value)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <FormField
                label="Employer / School Name"
                name="other_insured_employer"
                value={str("other_insured_employer")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Insurance Plan Name"
                name="other_insured_plan"
                value={str("other_insured_plan")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <CheckField
                label="Another Health Benefit Plan?"
                name="another_health_benefit"
                value={bool("another_health_benefit")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 5. Condition ── */}
          <AccordionItem
            value="condition"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              5. Condition / Accident Information
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <CheckField
                label="Employment-related?"
                name="condition_employment"
                value={bool("condition_employment")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <CheckField
                label="Auto accident?"
                name="condition_auto_accident"
                value={bool("condition_auto_accident")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              {bool("condition_auto_accident") && (
                <FormField
                  label="Auto Accident State"
                  name="condition_auto_state"
                  value={str("condition_auto_state")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              )}
              <CheckField
                label="Other accident?"
                name="condition_other_accident"
                value={bool("condition_other_accident")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 6. Dates & Referring Provider ── */}
          <AccordionItem
            value="dates"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              6. Dates & Referring Provider
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Illness / Injury Date"
                  name="illness_date"
                  type="date"
                  value={str("illness_date")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Illness Qualifier"
                  name="illness_qualifier"
                  value={str("illness_qualifier")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Other Date"
                  name="other_date"
                  type="date"
                  value={str("other_date")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Other Date Qualifier"
                  name="other_date_qualifier"
                  value={str("other_date_qualifier")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Unable to Work From"
                  name="unable_work_from"
                  type="date"
                  value={str("unable_work_from")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Unable to Work To"
                  name="unable_work_to"
                  type="date"
                  value={str("unable_work_to")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <FormField
                label="Referring Provider Name"
                name="referring_provider_name"
                value={str("referring_provider_name")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="NPI"
                  name="referring_provider_npi"
                  value={str("referring_provider_npi")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Qualifier"
                  name="referring_provider_qual"
                  value={str("referring_provider_qual")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Hospitalization From"
                  name="hospitalization_from"
                  type="date"
                  value={str("hospitalization_from")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Hospitalization To"
                  name="hospitalization_to"
                  type="date"
                  value={str("hospitalization_to")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <FormField
                label="Additional Claim Info"
                name="additional_claim_info"
                value={str("additional_claim_info")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── 7. Diagnoses ── */}
          <AccordionItem
            value="diagnoses"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              7. Diagnosis Codes (ICD-10)
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <div className="grid grid-cols-3 gap-3">
                {["a","b","c","d","e","f","g","h","i","j","k","l"].map(
                  (letter) => (
                    <FormField
                      key={letter}
                      label={`Diagnosis ${letter.toUpperCase()}`}
                      name={`diagnosis_${letter}`}
                      value={str(`diagnosis_${letter}`)}
                      onChange={handleChange}
                      disabled={!canEdit}
                      required={
                        letter === "a"
                          ? isReqField("diagnosis_a")
                          : undefined
                      }
                      hasError={
                        letter === "a"
                          ? fieldError("diagnosis_a")
                          : undefined
                      }
                    />
                  ),
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Resubmission Code"
                  name="resubmission_code"
                  value={str("resubmission_code")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Original Ref Number"
                  name="original_ref_number"
                  value={str("original_ref_number")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 8. Box 24 — Service Lines ── */}
          <AccordionItem
            value="service_lines"
            className={cn(
              "border rounded-xl px-4",
              fieldError("service_lines")
                ? "border-red-300"
                : "border-slate-200",
            )}
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              8. Box 24 — Service Lines{" "}
              <span className="text-red-500 ml-0.5">*</span>
              {fieldError("service_lines") && (
                <span className="ml-2 text-xs font-normal text-red-500 normal-case tracking-normal">
                  (at least one required)
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              {canEdit && (
                <button
                  type="button"
                  onClick={addServiceLine}
                  className="mb-3 px-4 py-2 text-xs font-semibold rounded-xl border border-[#15689E] text-[#15689E] hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Service Line
                </button>
              )}

              {lines.length === 0 && (
                <p
                  className={cn(
                    "text-xs italic py-2",
                    validationTouched ? "text-red-400" : "text-gray-400",
                  )}
                >
                  No service lines added. At least one is required.
                </p>
              )}

              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className="border border-gray-200 rounded-xl p-3 mb-2 space-y-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-600">
                      Line {idx + 1}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeServiceLine(line.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Row 1: Dates + Place of Service + EMG */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24A From
                      </label>
                      <input
                        type="date"
                        value={line.dos_from}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(line.id, "dos_from", e.target.value)
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24A To
                      </label>
                      <input
                        type="date"
                        value={line.dos_to}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(line.id, "dos_to", e.target.value)
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24B Place
                      </label>
                      <input
                        type="text"
                        value={line.place_of_service}
                        placeholder="11"
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "place_of_service",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24C EMG
                      </label>
                      <input
                        type="checkbox"
                        checked={line.emg}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(line.id, "emg", e.target.checked)
                        }
                        className="mt-1 w-4 h-4"
                      />
                    </div>
                  </div>

                  {/* Row 2: CPT + Modifiers */}
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24D CPT/HCPCS
                      </label>
                      <input
                        type="text"
                        value={line.cpt_code}
                        placeholder="e.g. Q4149"
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "cpt_code",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    {(
                      [
                        "modifier_1",
                        "modifier_2",
                        "modifier_3",
                        "modifier_4",
                      ] as const
                    ).map((mod, mi) => (
                      <div key={mod}>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                          Mod {mi + 1}
                        </label>
                        <input
                          type="text"
                          value={line[mod]}
                          maxLength={2}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateServiceLine(line.id, mod, e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Row 3: Diag Ptr + Charges + Units + NPI */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24E Diag Ptr
                      </label>
                      <input
                        type="text"
                        value={line.diagnosis_pointer}
                        placeholder="A"
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "diagnosis_pointer",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24F Charges
                      </label>
                      <input
                        type="text"
                        value={line.charges}
                        placeholder="0.00"
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "charges",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24G Units
                      </label>
                      <input
                        type="text"
                        value={line.days_units}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "days_units",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                        24J NPI
                      </label>
                      <input
                        type="text"
                        value={line.rendering_npi}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateServiceLine(
                            line.id,
                            "rendering_npi",
                            e.target.value,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#15689E] disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* ── 9. Outside Lab ── */}
          <AccordionItem
            value="lab"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              9. Outside Lab
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <CheckField
                label="Outside lab?"
                name="outside_lab"
                value={bool("outside_lab")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              {bool("outside_lab") && (
                <FormField
                  label="Outside Lab Charges ($)"
                  name="outside_lab_charges"
                  type="number"
                  value={str("outside_lab_charges")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── 10. Billing & Service Facility ── */}
          <AccordionItem
            value="billing"
            className="border border-slate-200 rounded-xl px-4"
          >
            <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
              10. Billing & Service Facility
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 pb-4">
              <FormField
                label="Federal Tax ID"
                name="federal_tax_id"
                value={str("federal_tax_id")}
                onChange={handleChange}
                disabled={!canEdit}
                required={isReqField("federal_tax_id")}
                hasError={fieldError("federal_tax_id")}
              />
              <CheckField
                label="Tax ID is SSN?"
                name="tax_id_ssn"
                value={bool("tax_id_ssn")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <CheckField
                label="Accept Assignment?"
                name="accept_assignment"
                value={bool("accept_assignment")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Total Charge ($)"
                  name="total_charge"
                  type="number"
                  value={str("total_charge")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Amount Paid ($)"
                  name="amount_paid"
                  type="number"
                  value={str("amount_paid")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
              </div>
              <FormField
                label="Physician Signature"
                name="physician_signature"
                value={str("physician_signature")}
                onChange={handleChange}
                disabled={!canEdit}
                required={isReqField("physician_signature")}
                hasError={fieldError("physician_signature")}
              />
              <FormField
                label="Physician Signature Date"
                name="physician_signature_date"
                type="date"
                value={str("physician_signature_date")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Service Facility Name"
                name="service_facility_name"
                value={str("service_facility_name")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Service Facility Address"
                name="service_facility_address"
                value={str("service_facility_address")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Service Facility NPI"
                name="service_facility_npi"
                value={str("service_facility_npi")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Billing Provider Name"
                name="billing_provider_name"
                value={str("billing_provider_name")}
                onChange={handleChange}
                disabled={!canEdit}
                required={isReqField("billing_provider_name")}
                hasError={fieldError("billing_provider_name")}
              />
              <FormField
                label="Billing Provider Address"
                name="billing_provider_address"
                value={str("billing_provider_address")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Billing Provider Phone"
                  name="billing_provider_phone"
                  type="tel"
                  value={str("billing_provider_phone")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <FormField
                  label="Billing Provider NPI"
                  name="billing_provider_npi"
                  value={str("billing_provider_npi")}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={isReqField("billing_provider_npi")}
                  hasError={fieldError("billing_provider_npi")}
                />
              </div>
              <FormField
                label="Billing Provider Tax ID"
                name="billing_provider_tax_id"
                value={str("billing_provider_tax_id")}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <FormField
                label="Box 30 — Reserved NUCC"
                name="rsvd_nucc"
                value={str("rsvd_nucc")}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
