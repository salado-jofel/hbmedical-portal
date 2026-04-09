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

  return (
    <div>
      <AuthField
        id={id}
        name={name ?? id}
        label={label}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
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
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
