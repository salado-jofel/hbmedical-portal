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
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        {icon && icon}
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
          className={`${height} text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0`}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(0,212,200,0.2)",
            paddingRight: rightElement ? "2.5rem" : undefined,
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(0,212,200,0.6)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(0,212,200,0.2)")
          }
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
