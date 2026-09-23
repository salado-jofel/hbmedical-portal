"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** Label + Input + inline error, styled like the Onboarding invite forms. */
export function WizardField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  autoComplete = "off",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={`h-9 text-sm ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function WizardStepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-[var(--navy)]">{title}</h2>
      <p className="text-sm text-[var(--text2)] mt-0.5">{description}</p>
    </div>
  );
}
