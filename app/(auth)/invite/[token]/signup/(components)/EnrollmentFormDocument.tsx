"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/utils";
import { MEDICARE_MAC_OPTIONS } from "@/utils/constants/medicare-mac";

const SUPPORT_EMAIL = "Support@MeridianSurgical.com";
const COMPANY_ADDRESS = "Meridian Surgical Partners · 123 Commerce Drive · Suite 100 · Nashville, TN 37201";

/* ── Primitives ── */

function FormInput({
  value,
  onChange,
  readOnly,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange?: (v: string) => void;
}) {
  return (
    <input
      value={value}
      readOnly={readOnly}
      onChange={readOnly || !onChange ? undefined : (e) => onChange(e.target.value)}
      className={cn(
        "border-0 border-b text-[13px] outline-none bg-transparent",
        "transition-colors px-1 py-0.5 leading-tight text-[#222]",
        "placeholder:text-[#bbb] w-full border-[#333] focus:border-[var(--navy)]",
        readOnly && "cursor-default select-text border-[#aaa] text-[#555]",
        className,
      )}
      {...props}
    />
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-[4px] text-[11px] font-bold uppercase tracking-wide text-white w-full bg-[var(--navy)]">
      {children}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wide shrink-0 text-[#333]">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  type,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <FL>{label}</FL>
      <FormInput
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  readOnly,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: readonly { value: string; label: string }[];
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <FL>{label}</FL>
      <select
        value={value}
        disabled={readOnly}
        onChange={readOnly || !onChange ? undefined : (e) => onChange(e.target.value)}
        className={cn(
          "border-0 border-b text-[13px] outline-none bg-transparent",
          "px-1 py-0.5 leading-tight text-[#222] w-full cursor-pointer",
          "border-[#333] focus:border-[var(--navy)]",
          readOnly && "cursor-default select-text border-[#aaa] text-[#555]",
        )}
      >
        <option value="" disabled hidden>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-t-0 border-[#ddd] p-3 space-y-3">
      {children}
    </div>
  );
}

/* ── Main component ── */

export function EnrollmentFormDocument({
  canEdit,
  // Display-only (always read-only)
  facilityName,
  providerName,
  providerNpi,
  billingAddress,
  billingCity,
  billingState,
  billingZip,
  billingPhone,
  // Section 1 — Billing
  facilityEin,
  onFacilityEinChange,
  facilityNpi,
  onFacilityNpiChange,
  facilityPtan,
  onFacilityPtanChange,
  medicareMac,
  onMedicareMacChange,
  apContactName,
  onApContactNameChange,
  apContactEmail,
  onApContactEmailChange,
  dpaContact,
  onDpaContactChange,
  dpaContactEmail,
  onDpaContactEmailChange,
  // Section 2 — Provider
  additionalProvider1Name,
  onAdditionalProvider1NameChange,
  additionalProvider1Npi,
  onAdditionalProvider1NpiChange,
  additionalProvider2Name,
  onAdditionalProvider2NameChange,
  additionalProvider2Npi,
  onAdditionalProvider2NpiChange,
  // Section 3 — Shipping
  shippingFacilityName,
  onShippingFacilityNameChange,
  shippingFacilityNpi,
  onShippingFacilityNpiChange,
  shippingFacilityPtan,
  onShippingFacilityPtanChange,
  shippingContactName,
  onShippingContactNameChange,
  shippingContactEmail,
  onShippingContactEmailChange,
  shippingAddress,
  onShippingAddressChange,
  shippingPhone,
  onShippingPhoneChange,
}: {
  canEdit: boolean;
  facilityName: string;
  providerName: string;
  providerNpi: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingPhone: string;
  facilityEin: string;
  onFacilityEinChange?: (v: string) => void;
  facilityNpi: string;
  onFacilityNpiChange?: (v: string) => void;
  facilityPtan: string;
  onFacilityPtanChange?: (v: string) => void;
  medicareMac: string;
  onMedicareMacChange?: (v: string) => void;
  apContactName: string;
  onApContactNameChange?: (v: string) => void;
  apContactEmail: string;
  onApContactEmailChange?: (v: string) => void;
  dpaContact: string;
  onDpaContactChange?: (v: string) => void;
  dpaContactEmail: string;
  onDpaContactEmailChange?: (v: string) => void;
  additionalProvider1Name: string;
  onAdditionalProvider1NameChange?: (v: string) => void;
  additionalProvider1Npi: string;
  onAdditionalProvider1NpiChange?: (v: string) => void;
  additionalProvider2Name: string;
  onAdditionalProvider2NameChange?: (v: string) => void;
  additionalProvider2Npi: string;
  onAdditionalProvider2NpiChange?: (v: string) => void;
  shippingFacilityName: string;
  onShippingFacilityNameChange?: (v: string) => void;
  shippingFacilityNpi: string;
  onShippingFacilityNpiChange?: (v: string) => void;
  shippingFacilityPtan: string;
  onShippingFacilityPtanChange?: (v: string) => void;
  shippingContactName: string;
  onShippingContactNameChange?: (v: string) => void;
  shippingContactEmail: string;
  onShippingContactEmailChange?: (v: string) => void;
  shippingAddress: string;
  onShippingAddressChange?: (v: string) => void;
  shippingPhone: string;
  onShippingPhoneChange?: (v: string) => void;
}) {
  const ro = !canEdit;

  return (
    <div className="mx-auto border border-[#ddd] shadow-sm max-w-[800px] px-8 py-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[18px] font-bold text-[#222] uppercase tracking-wide">
            Enrollment Form
          </p>
          <p className="text-[11px] text-[#666] mt-0.5">Meridian Surgical Partners</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#999]">REV2.0</p>
        </div>
      </div>

      {/* Info callout */}
      <div className="bg-[#EFF6FF] border border-[var(--navy)]/20 rounded px-3 py-2 mb-4">
        <p className="text-[12px] text-[var(--navy)] font-medium">
          All fields are optional. Complete what you can now — you can update the
          rest later from your account settings.
        </p>
      </div>

      {/* ── Section 1: Billing ── */}
      <SectionHeader>Account Billing Information</SectionHeader>
      <SectionBody>
        <Field label="Facility Name" value={facilityName} readOnly className="w-full" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Facility EIN" value={facilityEin} onChange={ro ? undefined : onFacilityEinChange} readOnly={ro} />
          <Field label="Facility NPI" value={facilityNpi} onChange={ro ? undefined : onFacilityNpiChange} readOnly={ro} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Facility PTAN" value={facilityPtan} onChange={ro ? undefined : onFacilityPtanChange} readOnly={ro} />
          <SelectField
            label="GMAC"
            value={medicareMac}
            onChange={ro ? undefined : onMedicareMacChange}
            options={MEDICARE_MAC_OPTIONS}
            readOnly={ro}
          />
        </div>

        <Field label="Billing Address" value={billingAddress} readOnly className="w-full" />

        <div className="grid grid-cols-3 gap-4">
          <Field label="City" value={billingCity} readOnly />
          <Field label="State" value={billingState} readOnly />
          <Field label="ZIP" value={billingZip} readOnly />
        </div>

        <Field label="Billing Phone" value={billingPhone} readOnly />

        <div className="grid grid-cols-2 gap-4">
          <Field label="AP Contact Name" value={apContactName} onChange={ro ? undefined : onApContactNameChange} readOnly={ro} />
          <Field label="AP Contact Email" value={apContactEmail} onChange={ro ? undefined : onApContactEmailChange} readOnly={ro} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="DPA Contact" value={dpaContact} onChange={ro ? undefined : onDpaContactChange} readOnly={ro} />
          <Field label="DPA Contact Email" value={dpaContactEmail} onChange={ro ? undefined : onDpaContactEmailChange} readOnly={ro} />
        </div>
      </SectionBody>

      {/* ── Section 2: Provider ── */}
      <div className="mt-4">
        <SectionHeader>Provider Information</SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider Name" value={providerName} readOnly />
            <Field label="Provider NPI" value={providerNpi} readOnly />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Additional Provider 1 Name" value={additionalProvider1Name} onChange={ro ? undefined : onAdditionalProvider1NameChange} readOnly={ro} />
            <Field label="Additional Provider 1 NPI" value={additionalProvider1Npi} onChange={ro ? undefined : onAdditionalProvider1NpiChange} readOnly={ro} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Additional Provider 2 Name" value={additionalProvider2Name} onChange={ro ? undefined : onAdditionalProvider2NameChange} readOnly={ro} />
            <Field label="Additional Provider 2 NPI" value={additionalProvider2Npi} onChange={ro ? undefined : onAdditionalProvider2NpiChange} readOnly={ro} />
          </div>
        </SectionBody>
      </div>

      {/* ── Section 3: Shipping Location ── */}
      <div className="mt-4">
        <SectionHeader>Account Shipping Information</SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility Name" value={shippingFacilityName} onChange={ro ? undefined : onShippingFacilityNameChange} readOnly={ro} />
            <Field label="Facility NPI" value={shippingFacilityNpi} onChange={ro ? undefined : onShippingFacilityNpiChange} readOnly={ro} />
          </div>
          <Field label="Facility PTAN" value={shippingFacilityPtan} onChange={ro ? undefined : onShippingFacilityPtanChange} readOnly={ro} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name" value={shippingContactName} onChange={ro ? undefined : onShippingContactNameChange} readOnly={ro} />
            <Field label="Contact Email" value={shippingContactEmail} onChange={ro ? undefined : onShippingContactEmailChange} readOnly={ro} />
          </div>
          <Field label="Address" value={shippingAddress} onChange={ro ? undefined : onShippingAddressChange} readOnly={ro} className="w-full" />
          <Field label="Phone" value={shippingPhone} onChange={ro ? undefined : onShippingPhoneChange} readOnly={ro} />
        </SectionBody>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-[#ddd] text-center space-y-0.5">
        <p className="text-[11px] text-[#555]">
          Email completed form to <span className="font-semibold">{SUPPORT_EMAIL}</span>
        </p>
        <p className="text-[11px] text-[#555]">{COMPANY_ADDRESS}</p>
        <p className="text-[10px] text-[#999] mt-1">REV2.0</p>
      </div>
    </div>
  );
}
