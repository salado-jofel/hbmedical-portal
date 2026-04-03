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

  const inputClassName = isLight
    ? "!w-full !h-9 !bg-white !border-input !text-sm !rounded-r-md focus:!border-[#15689E] !transition-all"
    : "!w-full !h-11 !bg-white/5 !border-white/10 !text-white !rounded-r-lg focus:!border-[#e8821a] !transition-all";

  const buttonClassName = isLight
    ? "!h-9 !w-[52px] !min-w-[52px] !justify-center !px-0 !bg-transparent !border-input !rounded-l-md hover:!bg-slate-50 !transition-all"
    : "!h-11 !w-[52px] !min-w-[52px] !justify-center !px-0 !bg-transparent !border-white/10 !rounded-l-lg hover:!bg-white/10 !transition-all";

  return (
    <div className="space-y-1.5">
      <Label className={isLight ? "text-xs" : "text-sm font-medium text-white/70"}>
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
