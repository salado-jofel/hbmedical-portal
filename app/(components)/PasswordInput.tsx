"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthField } from "@/app/(components)/AuthField";

interface PasswordInputProps {
  id: string;
  name?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
}

export function PasswordInput({
  id,
  name,
  label,
  placeholder = "••••••••",
  value,
  onChange,
  error,
  required,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  // Forward `error` down to AuthField so the border/label/icon tint red AND
  // the error message renders below the input. Previously this only rendered
  // the message in a sibling <p>, which left the border looking unaffected.
  return (
    <AuthField
      id={id}
      name={name ?? id}
      label={label}
      type={show ? "text" : "password"}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      rightElement={
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="text-[var(--text3)] hover:text-[var(--text2)] transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}
