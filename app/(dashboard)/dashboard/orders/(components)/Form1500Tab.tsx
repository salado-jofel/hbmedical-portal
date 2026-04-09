"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Accordion,
} from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { upsertForm1500 } from "../(services)/order-document-actions";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import type { IServiceLine } from "@/utils/interfaces/orders";
import { Form1500InsuranceSection } from "./Form1500InsuranceSection";
import { Form1500PatientSection } from "./Form1500PatientSection";
import { Form1500DiagnosisSection } from "./Form1500DiagnosisSection";
import { Form1500BillingSection } from "./Form1500BillingSection";

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

export function Form1500Tab({
  orderId,
  canEdit,
  initialData,
  isReady,
  onSave,
  onDirtyChange,
}: Form1500TabProps) {
  const [formData, setFormData] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [baseline, setBaseline] = useState<Form1500Data>(
    (initialData as Form1500Data) ?? {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [validationTouched, setValidationTouched] = useState(false);

  /* Dirty = any field differs between formData and baseline */
  const isDirty = useMemo(() => {
    const allKeys = new Set([...Object.keys(formData), ...Object.keys(baseline)]);
    return Array.from(allKeys).some(
      (k) => String((formData as Record<string, unknown>)[k] ?? "") !== String((baseline as Record<string, unknown>)[k] ?? ""),
    );
  }, [formData, baseline]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sync when initialData changes (modal reopened for different order) */
  useEffect(() => {
    const snap = (initialData as Form1500Data) ?? {};
    setFormData(snap);
    setBaseline(snap);
    setValidationTouched(false);
  }, [initialData]);

  const handleChange = useCallback((name: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  function handleDiscard() {
    setFormData({ ...baseline } as Form1500Data);
    setValidationTouched(false);
  }

  function getServiceLines(): IServiceLine[] {
    return (formData.service_lines as IServiceLine[] | null) ?? [];
  }

  function updateServiceLine(
    id: string,
    field: keyof IServiceLine,
    value: string | boolean,
  ) {
    setFormData((prev) => ({
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
    setFormData((prev) => ({
      ...prev,
      service_lines: [...getServiceLines(), newLine],
    }));
  }

  function removeServiceLine(id: string) {
    setFormData((prev) => ({
      ...prev,
      service_lines: getServiceLines().filter((l) => l.id !== id),
    }));
  }

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(({ field, label, box }) => {
      const value = formData[field];
      if (!value || (typeof value === "string" && !value.trim())) {
        errors[field] = `Box ${box}: ${label} is required`;
      }
    });
    const sl = (formData.service_lines as IServiceLine[] | null) ?? [];
    if (!sl.length) {
      errors["service_lines"] = "Box 24: At least one service line is required";
    }
    return errors;
  }, [formData]);

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
        formData as Record<string, unknown>,
      );
      if (result.success) {
        setBaseline({ ...formData } as Form1500Data);
        onSave?.(formData as Record<string, unknown>);
        toast.success("1500 form saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function str(key: string): string {
    return (formData[key] as string) ?? "";
  }

  function bool(key: string): boolean {
    return !!(formData[key] as boolean);
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
                "bg-[var(--navy)] text-white",
                "hover:bg-[var(--navy)]/90 transition-colors",
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
          <Form1500InsuranceSection
            str={str}
            bool={bool}
            canEdit={canEdit}
            handleChange={handleChange}
            isReqField={isReqField}
            fieldError={fieldError}
          />
          <Form1500PatientSection
            str={str}
            canEdit={canEdit}
            handleChange={handleChange}
            isReqField={isReqField}
            fieldError={fieldError}
          />
          <Form1500DiagnosisSection
            str={str}
            bool={bool}
            canEdit={canEdit}
            handleChange={handleChange}
            isReqField={isReqField}
            fieldError={fieldError}
            lines={lines}
            addServiceLine={addServiceLine}
            removeServiceLine={removeServiceLine}
            updateServiceLine={updateServiceLine}
            validationTouched={validationTouched}
          />
          <Form1500BillingSection
            str={str}
            bool={bool}
            canEdit={canEdit}
            handleChange={handleChange}
            isReqField={isReqField}
            fieldError={fieldError}
          />
        </Accordion>
      </div>
    </div>
  );
}
