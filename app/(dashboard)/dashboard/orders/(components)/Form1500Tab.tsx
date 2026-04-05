"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { upsertForm1500 } from "../(services)/actions";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";

type Form1500Data = Record<string, string | boolean | number | null>;

interface Form1500TabProps {
  orderId: string;
  canEdit: boolean;
  initialData: Record<string, unknown> | null;
  isReady: boolean;
  onSave?: (data: Record<string, unknown>) => void;
}

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (name: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-500">{label}</label>
      <Input
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, e.target.value)}
        className="h-8 text-sm"
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
}: Form1500TabProps) {
  const [savedData, setSavedData] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [draftData, setDraftData] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(draftData) !== JSON.stringify(savedData);

  // Sync when initialData changes (modal reopened for different order)
  useEffect(() => {
    setSavedData((initialData as Form1500Data) ?? {});
    setDraftData((initialData as Form1500Data) ?? {});
  }, [initialData]);

  function handleChange(name: string, value: string | boolean) {
    setDraftData((prev) => ({ ...prev, [name]: value }));
  }

  function handleDiscard() {
    setDraftData(savedData);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await upsertForm1500(orderId, draftData);
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

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-10  bg-white border-b border-gray-300 py-3 flex items-center justify-between ">
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

          <Accordion
            type="multiple"
            defaultValue={["insurance", "patient"]}
            className="space-y-2"
          >
            {/* 1. Insurance */}
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
                  </label>
                  <select
                    value={str("insurance_type")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      handleChange("insurance_type", e.target.value)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#15689E] disabled:opacity-60"
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

            {/* 2. Patient Info */}
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
                  />
                  <FormField
                    label="First Name"
                    name="patient_first_name"
                    value={str("patient_first_name")}
                    onChange={handleChange}
                    disabled={!canEdit}
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
                  />
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Sex</label>
                    <select
                      value={str("patient_sex")}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleChange("patient_sex", e.target.value)
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
                  label="Address"
                  name="patient_address"
                  value={str("patient_address")}
                  onChange={handleChange}
                  disabled={!canEdit}
                />
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    label="City"
                    name="patient_city"
                    value={str("patient_city")}
                    onChange={handleChange}
                    disabled={!canEdit}
                  />
                  <FormField
                    label="State"
                    name="patient_state"
                    value={str("patient_state")}
                    onChange={handleChange}
                    disabled={!canEdit}
                  />
                  <FormField
                    label="ZIP"
                    name="patient_zip"
                    value={str("patient_zip")}
                    onChange={handleChange}
                    disabled={!canEdit}
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
              </AccordionContent>
            </AccordionItem>

            {/* 3. Insured Info */}
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
                  />
                  <FormField
                    label="First Name"
                    name="insured_first_name"
                    value={str("insured_first_name")}
                    onChange={handleChange}
                    disabled={!canEdit}
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

            {/* 4. Other Insured */}
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

            {/* 5. Condition */}
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

            {/* 6. Dates & Referring Provider */}
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

            {/* 7. Diagnoses */}
            <AccordionItem
              value="diagnoses"
              className="border border-slate-200 rounded-xl px-4"
            >
              <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
                7. Diagnosis Codes (ICD-10)
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    "a",
                    "b",
                    "c",
                    "d",
                    "e",
                    "f",
                    "g",
                    "h",
                    "i",
                    "j",
                    "k",
                    "l",
                  ].map((letter) => (
                    <FormField
                      key={letter}
                      label={`Diagnosis ${letter.toUpperCase()}`}
                      name={`diagnosis_${letter}`}
                      value={str(`diagnosis_${letter}`)}
                      onChange={handleChange}
                      disabled={!canEdit}
                    />
                  ))}
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

            {/* 8. Outside Lab */}
            <AccordionItem
              value="lab"
              className="border border-slate-200 rounded-xl px-4"
            >
              <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
                8. Outside Lab
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

            {/* 9. Billing Provider */}
            <AccordionItem
              value="billing"
              className="border border-slate-200 rounded-xl px-4"
            >
              <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
                9. Billing & Service Facility
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2 pb-4">
                <FormField
                  label="Federal Tax ID"
                  name="federal_tax_id"
                  value={str("federal_tax_id")}
                  onChange={handleChange}
                  disabled={!canEdit}
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
                  />
                </div>
                <FormField
                  label="Billing Provider Tax ID"
                  name="billing_provider_tax_id"
                  value={str("billing_provider_tax_id")}
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
