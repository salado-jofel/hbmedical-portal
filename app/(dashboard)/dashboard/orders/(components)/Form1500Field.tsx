"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

export function FormField({
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

export function CheckField({
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
