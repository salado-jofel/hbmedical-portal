"use client";

import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { Label } from "@/components/ui/label";

export interface PhoneInputFieldProps {
  value: string;
  onChange: (phone: string, country: string) => void;
  label?: string;
  required?: boolean;
  theme?: "dark" | "light";
  error?: string;
  defaultCountry?: string;
}

export function PhoneInputField({
  value,
  onChange,
  label = "Phone Number",
  required = false,
  theme = "light",
  error,
  defaultCountry = "us",
}: PhoneInputFieldProps) {
  const isLight = theme === "light";
  const hasError = Boolean(error);

  // react-international-phone applies these classNames with !important. When
  // in error state we swap the border + focus classes to red so the field
  // looks visually consistent with AuthField/PasswordInput.
  const inputBorderClass = hasError
    ? "!border-[var(--red)] focus:!border-[var(--red)]"
    : isLight
      ? "!border-input focus:!border-[var(--navy)]"
      : "!border-white/10 focus:!border-[#e8821a]";
  const inputClassName = isLight
    ? `!w-full !h-9 !bg-white !text-sm !rounded-r-md !transition-all ${inputBorderClass}`
    : `!w-full !h-11 !bg-white/5 !text-white !rounded-r-lg !transition-all ${inputBorderClass}`;

  const buttonBorderClass = hasError
    ? "!border-[var(--red)]"
    : isLight
      ? "!border-input"
      : "!border-white/10";
  const buttonClassName = isLight
    ? `!h-9 !w-[52px] !min-w-[52px] !justify-center !px-0 !bg-transparent !rounded-l-md hover:!bg-slate-50 !transition-all ${buttonBorderClass}`
    : `!h-11 !w-[52px] !min-w-[52px] !justify-center !px-0 !bg-transparent !rounded-l-lg hover:!bg-white/10 !transition-all ${buttonBorderClass}`;

  return (
    <div className="space-y-1.5">
      <Label
        className={`${isLight ? "text-xs" : "text-sm font-medium text-white/70"} ${
          hasError ? "text-[var(--red)]" : ""
        }`}
      >
        {label}
        {required && <span className="text-red-400"> *</span>}
      </Label>
      <PhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={(phone, meta) =>
          onChange(phone, (meta as any)?.country?.iso2 ?? defaultCountry)
        }
        inputClassName={inputClassName}
        countrySelectorStyleProps={{
          buttonClassName,
          buttonContentWrapperClassName: "!w-full !justify-center !items-center !gap-0",
          flagClassName: "!m-0",
          dropdownArrowClassName: "!hidden",
        }}
      />
      {hasError && <p className="text-xs text-[var(--red)]">{error}</p>}
    </div>
  );
}
