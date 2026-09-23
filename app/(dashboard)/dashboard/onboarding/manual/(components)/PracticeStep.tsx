"use client";

import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import type {
  ManualFormPatch,
  ManualOnboardingForm,
} from "@/utils/interfaces/manual-onboarding";
import { WizardField, WizardStepHeading } from "./WizardField";

export function PracticeStep({
  form,
  patch,
  errors,
  clearError,
}: {
  form: ManualOnboardingForm;
  patch: (p: ManualFormPatch) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
}) {
  const set = (key: keyof ManualOnboardingForm) => (value: string) => {
    patch({ [key]: value } as Partial<ManualOnboardingForm>);
    clearError(key);
  };

  return (
    <div className="space-y-4">
      <WizardStepHeading
        title="Practice information"
        description="This becomes the clinic account. The address is also used as the billing address on the enrollment form."
      />

      <WizardField id="office_name" label="Practice name" required value={form.office_name} onChange={set("office_name")} error={errors.office_name} placeholder="Sunrise Medical Group" autoComplete="organization" />

      <PhoneInputField
        value={form.office_phone}
        onChange={(val) => set("office_phone")(val)}
        label="Office phone"
        required
        theme="light"
        error={errors.office_phone}
      />

      <WizardField id="office_address" label="Address" required value={form.office_address} onChange={set("office_address")} error={errors.office_address} placeholder="123 Main St" autoComplete="street-address" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <WizardField id="office_city" label="City" required value={form.office_city} onChange={set("office_city")} error={errors.office_city} placeholder="Dallas" />
        <WizardField id="office_state" label="State" required value={form.office_state} onChange={set("office_state")} error={errors.office_state} placeholder="TX" />
        <WizardField id="office_postal_code" label="ZIP code" required value={form.office_postal_code} onChange={set("office_postal_code")} error={errors.office_postal_code} placeholder="75001" inputMode="numeric" />
      </div>
    </div>
  );
}
