"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FormField } from "./Form1500Field";
import { cn } from "@/utils/utils";

interface PatientSectionProps {
  str: (key: string) => string;
  canEdit: boolean;
  handleChange: (name: string, value: string | boolean) => void;
  isReqField: (name: string) => boolean;
  fieldError: (name: string) => boolean;
}

export function Form1500PatientSection({
  str,
  canEdit,
  handleChange,
  isReqField,
  fieldError,
}: PatientSectionProps) {
  return (
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
              onChange={(e) => handleChange("patient_sex", e.target.value)}
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
  );
}
