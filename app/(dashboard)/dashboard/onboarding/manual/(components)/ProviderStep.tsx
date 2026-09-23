"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import { CREDENTIAL_OPTIONS } from "@/utils/constants/auth";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import type {
  ManualFormPatch,
  ManualOnboardingForm,
} from "@/utils/interfaces/manual-onboarding";
import { WizardField, WizardStepHeading } from "./WizardField";

export function ProviderStep({
  form,
  patch,
  errors,
  clearError,
  isAdmin,
  reps,
}: {
  form: ManualOnboardingForm;
  patch: (p: ManualFormPatch) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
  isAdmin: boolean;
  reps: RepWithFacility[];
}) {
  const set = (key: keyof ManualOnboardingForm) => (value: string) => {
    patch({ [key]: value } as Partial<ManualOnboardingForm>);
    clearError(key);
  };

  return (
    <div className="space-y-4">
      <WizardStepHeading
        title="Clinical provider"
        description="The provider who signed the paper agreements. They'll receive an email to set their password."
      />

      {isAdmin && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Assign to Rep <span className="text-red-400">*</span>
          </Label>
          {reps.length === 0 ? (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                No reps have set up their office yet. Ask a rep to complete setup first.
              </p>
            </div>
          ) : (
            <Select
              value={form.repId ?? ""}
              onValueChange={(v) => {
                patch({ repId: v });
                clearError("repId");
              }}
            >
              <SelectTrigger className={`h-9 text-sm ${errors.repId ? "border-red-400" : ""}`}>
                <SelectValue placeholder="Select a sales rep..." />
              </SelectTrigger>
              <SelectContent>
                {reps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id} className="text-sm">
                    {rep.name} — {rep.facilityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.repId && <p className="text-xs text-red-500">{errors.repId}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <WizardField id="first_name" label="First name" required value={form.first_name} onChange={set("first_name")} error={errors.first_name} placeholder="Jane" autoComplete="given-name" />
        <WizardField id="last_name" label="Last name" required value={form.last_name} onChange={set("last_name")} error={errors.last_name} placeholder="Doe" autoComplete="family-name" />
      </div>

      <WizardField id="email" label="Email" required type="email" inputMode="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="doctor@clinic.com" />

      <PhoneInputField
        value={form.phone}
        onChange={(val) => set("phone")(val)}
        label="Mobile number (used for sign-in verification codes)"
        required
        theme="light"
        error={errors.phone}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Credential</Label>
          <Select value={form.credential} onValueChange={(v) => set("credential")(v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select credential..." />
            </SelectTrigger>
            <SelectContent>
              {CREDENTIAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <WizardField
          id="npi_number"
          label="NPI number"
          required
          inputMode="numeric"
          maxLength={10}
          value={form.npi_number}
          onChange={(v) => set("npi_number")(v.replace(/\D/g, "").slice(0, 10))}
          error={errors.npi_number}
          placeholder="10 digits"
        />
      </div>
    </div>
  );
}
