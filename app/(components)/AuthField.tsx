"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReactNode } from "react";

interface AuthFieldProps {
  id: string;
  name: string;
  label: string;
  icon?: ReactNode;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rightElement?: ReactNode;
  height?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Field-level error message. When set: label + icon + border go red and the
   *  message renders directly beneath the input. */
  error?: string | null;
}

export function AuthField({
  id,
  name,
  label,
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  rightElement,
  height = "h-12",
  required,
  readOnly,
  error,
}: AuthFieldProps) {
  const hasError = Boolean(error);
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className={`flex items-center gap-2 text-xs font-medium mb-1.5 ${
          hasError ? "text-[var(--red)]" : "text-[#374151]"
        }`}
      >
        {icon && (
          <span className={hasError ? "text-[var(--red)]" : "text-[var(--navy)]"}>
            {icon}
          </span>
        )}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          aria-invalid={hasError || undefined}
          {...(value !== undefined && { value })}
          {...(onChange !== undefined && { onChange })}
          className={`${height} h-9 text-sm text-[var(--navy)] placeholder:text-[var(--text3)] bg-white rounded-lg px-3 transition-colors ${
            hasError
              ? "border border-[var(--red)] focus-visible:ring-2 focus-visible:ring-[var(--red)]/20 focus-visible:border-[var(--red)]"
              : "border border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--navy)]/10 focus-visible:border-[var(--navy)]"
          } ${readOnly ? "bg-slate-50 text-[var(--text2)] cursor-not-allowed" : ""}`}
          style={{
            paddingRight: rightElement ? "2.5rem" : undefined,
          }}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {hasError && <p className="text-xs text-[var(--red)]">{error}</p>}
    </div>
  );
}
