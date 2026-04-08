"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2 } from "lucide-react";
import { FormField, CheckField } from "./Form1500Field";
import { cn } from "@/utils/utils";
import type { IServiceLine } from "@/utils/interfaces/orders";

interface DiagnosisSectionProps {
  str: (key: string) => string;
  bool: (key: string) => boolean;
  canEdit: boolean;
  handleChange: (name: string, value: string | boolean) => void;
  isReqField: (name: string) => boolean;
  fieldError: (name: string) => boolean;
  lines: IServiceLine[];
  addServiceLine: () => void;
  removeServiceLine: (id: string) => void;
  updateServiceLine: (
    id: string,
    field: keyof IServiceLine,
    value: string | boolean,
  ) => void;
  validationTouched: boolean;
}

export function Form1500DiagnosisSection({
  str,
  bool,
  canEdit,
  handleChange,
  isReqField,
  fieldError,
  lines,
  addServiceLine,
  removeServiceLine,
  updateServiceLine,
  validationTouched,
}: DiagnosisSectionProps) {
  return (
    <>
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
            {["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map(
              (letter) => (
                <FormField
                  key={letter}
                  label={`Diagnosis ${letter.toUpperCase()}`}
                  name={`diagnosis_${letter}`}
                  value={str(`diagnosis_${letter}`)}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required={
                    letter === "a" ? isReqField("diagnosis_a") : undefined
                  }
                  hasError={
                    letter === "a" ? fieldError("diagnosis_a") : undefined
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
          fieldError("service_lines") ? "border-red-300" : "border-slate-200",
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
                      updateServiceLine(line.id, "cpt_code", e.target.value)
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
                      updateServiceLine(line.id, "charges", e.target.value)
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
                      updateServiceLine(line.id, "days_units", e.target.value)
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
    </>
  );
}
