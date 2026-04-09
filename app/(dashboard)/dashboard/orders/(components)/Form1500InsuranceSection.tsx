"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FormField, CheckField } from "./Form1500Field";
import { cn } from "@/utils/utils";

interface InsuranceSectionProps {
  str: (key: string) => string;
  bool: (key: string) => boolean;
  canEdit: boolean;
  handleChange: (name: string, value: string | boolean) => void;
  isReqField: (name: string) => boolean;
  fieldError: (name: string) => boolean;
}

export function Form1500InsuranceSection({
  str,
  bool,
  canEdit,
  handleChange,
  isReqField,
  fieldError,
}: InsuranceSectionProps) {
  return (
    <>
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
              onChange={(e) => handleChange("insurance_type", e.target.value)}
              className={cn(
                "w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--navy)] disabled:opacity-60",
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
                onChange={(e) => handleChange("insured_sex", e.target.value)}
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
    </>
  );
}
