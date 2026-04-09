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
}: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-2 text-xs font-medium text-[#374151] mb-1.5"
      >
        {icon && <span className="text-[var(--navy)]">{icon}</span>}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          {...(value !== undefined && { value })}
          {...(onChange !== undefined && { onChange })}
          className={`${height} h-9 text-sm text-[var(--navy)] placeholder:text-[var(--text3)] border border-[var(--border)] bg-white rounded-lg px-3 focus-visible:ring-2 focus-visible:ring-[var(--navy)]/10 focus-visible:border-[var(--navy)] transition-colors`}
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
    </div>
  );
}
