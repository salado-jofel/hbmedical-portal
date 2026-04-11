"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/utils";

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
        "border-0 border-b border-[#333] text-[13px] outline-none bg-transparent",
        "focus:border-amber-500 transition-colors px-1 py-0.5 leading-tight text-[#222]",
        "placeholder:text-[#bbb]",
        readOnly && "cursor-default select-text border-[#aaa] text-[#555]",
        className,
      )}
      {...props}
    />
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 py-[4px] text-[11px] font-bold uppercase tracking-wide text-black w-full"
      style={{ backgroundColor: "#f59e0b" }}
    >
      {children}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#333] shrink-0">
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
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
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
      />
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
  facilityTin,
  onFacilityTinChange,
  facilityPtan,
  onFacilityPtanChange,
  apContactName,
  onApContactNameChange,
  apContactEmail,
  onApContactEmailChange,
  billingFax,
  onBillingFaxChange,
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
  // Section 3 — Shipping 1
  shippingFacilityName,
  onShippingFacilityNameChange,
  shippingFacilityNpi,
  onShippingFacilityNpiChange,
  shippingFacilityTin,
  onShippingFacilityTinChange,
  shippingFacilityPtan,
  onShippingFacilityPtanChange,
  shippingContactName,
  onShippingContactNameChange,
  shippingContactEmail,
  onShippingContactEmailChange,
  shippingAddress,
  onShippingAddressChange,
  shippingDaysTimes,
  onShippingDaysTimesChange,
  shippingPhone,
  onShippingPhoneChange,
  shippingFax,
  onShippingFaxChange,
  // Section 4 — Shipping 2
  shipping2FacilityName,
  onShipping2FacilityNameChange,
  shipping2FacilityNpi,
  onShipping2FacilityNpiChange,
  shipping2FacilityTin,
  onShipping2FacilityTinChange,
  shipping2FacilityPtan,
  onShipping2FacilityPtanChange,
  shipping2ContactName,
  onShipping2ContactNameChange,
  shipping2ContactEmail,
  onShipping2ContactEmailChange,
  shipping2Address,
  onShipping2AddressChange,
  shipping2DaysTimes,
  onShipping2DaysTimesChange,
  shipping2Phone,
  onShipping2PhoneChange,
  shipping2Fax,
  onShipping2FaxChange,
  // Section 5 — Claims
  claimsContactName,
  onClaimsContactNameChange,
  claimsContactPhone,
  onClaimsContactPhoneChange,
  claimsContactEmail,
  onClaimsContactEmailChange,
  claimsThirdParty,
  onClaimsThirdPartyChange,
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
  onFacilityEinChange: (v: string) => void;
  facilityNpi: string;
  onFacilityNpiChange: (v: string) => void;
  facilityTin: string;
  onFacilityTinChange: (v: string) => void;
  facilityPtan: string;
  onFacilityPtanChange: (v: string) => void;
  apContactName: string;
  onApContactNameChange: (v: string) => void;
  apContactEmail: string;
  onApContactEmailChange: (v: string) => void;
  billingFax: string;
  onBillingFaxChange: (v: string) => void;
  dpaContact: string;
  onDpaContactChange: (v: string) => void;
  dpaContactEmail: string;
  onDpaContactEmailChange: (v: string) => void;
  additionalProvider1Name: string;
  onAdditionalProvider1NameChange: (v: string) => void;
  additionalProvider1Npi: string;
  onAdditionalProvider1NpiChange: (v: string) => void;
  additionalProvider2Name: string;
  onAdditionalProvider2NameChange: (v: string) => void;
  additionalProvider2Npi: string;
  onAdditionalProvider2NpiChange: (v: string) => void;
  shippingFacilityName: string;
  onShippingFacilityNameChange: (v: string) => void;
  shippingFacilityNpi: string;
  onShippingFacilityNpiChange: (v: string) => void;
  shippingFacilityTin: string;
  onShippingFacilityTinChange: (v: string) => void;
  shippingFacilityPtan: string;
  onShippingFacilityPtanChange: (v: string) => void;
  shippingContactName: string;
  onShippingContactNameChange: (v: string) => void;
  shippingContactEmail: string;
  onShippingContactEmailChange: (v: string) => void;
  shippingAddress: string;
  onShippingAddressChange: (v: string) => void;
  shippingDaysTimes: string;
  onShippingDaysTimesChange: (v: string) => void;
  shippingPhone: string;
  onShippingPhoneChange: (v: string) => void;
  shippingFax: string;
  onShippingFaxChange: (v: string) => void;
  shipping2FacilityName: string;
  onShipping2FacilityNameChange: (v: string) => void;
  shipping2FacilityNpi: string;
  onShipping2FacilityNpiChange: (v: string) => void;
  shipping2FacilityTin: string;
  onShipping2FacilityTinChange: (v: string) => void;
  shipping2FacilityPtan: string;
  onShipping2FacilityPtanChange: (v: string) => void;
  shipping2ContactName: string;
  onShipping2ContactNameChange: (v: string) => void;
  shipping2ContactEmail: string;
  onShipping2ContactEmailChange: (v: string) => void;
  shipping2Address: string;
  onShipping2AddressChange: (v: string) => void;
  shipping2DaysTimes: string;
  onShipping2DaysTimesChange: (v: string) => void;
  shipping2Phone: string;
  onShipping2PhoneChange: (v: string) => void;
  shipping2Fax: string;
  onShipping2FaxChange: (v: string) => void;
  claimsContactName: string;
  onClaimsContactNameChange: (v: string) => void;
  claimsContactPhone: string;
  onClaimsContactPhoneChange: (v: string) => void;
  claimsContactEmail: string;
  onClaimsContactEmailChange: (v: string) => void;
  claimsThirdParty: string;
  onClaimsThirdPartyChange: (v: string) => void;
}) {
  const ro = !canEdit;

  return (
    <div
      className="mx-auto border border-[#ddd] shadow-sm"
      style={{ maxWidth: 800, padding: "28px 32px" }}
    >
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
      <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
        <p className="text-[12px] text-amber-800 font-medium">
          All fields are required and will be used to process your orders.
        </p>
      </div>

      {/* ── Section 1: Billing ── */}
      <SectionHeader>Section 1 — Billing Information</SectionHeader>
      <SectionBody>
        {/* Facility Name (read-only, full width) */}
        <Field
          label="Facility Name"
          value={facilityName}
          readOnly
          className="w-full"
        />

        {/* EIN + NPI */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Facility EIN" value={facilityEin} onChange={ro ? undefined : onFacilityEinChange} readOnly={ro} />
          <Field label="Facility NPI" value={facilityNpi} onChange={ro ? undefined : onFacilityNpiChange} readOnly={ro} />
        </div>

        {/* TIN + PTAN */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Facility TIN" value={facilityTin} onChange={ro ? undefined : onFacilityTinChange} readOnly={ro} />
          <Field label="Facility PTAN" value={facilityPtan} onChange={ro ? undefined : onFacilityPtanChange} readOnly={ro} />
        </div>

        {/* Billing Address (read-only, full width) */}
        <Field
          label="Billing Address"
          value={billingAddress}
          readOnly
          className="w-full"
        />

        {/* City / State / ZIP (3 cols) */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" value={billingCity} readOnly />
          <Field label="State" value={billingState} readOnly />
          <Field label="ZIP" value={billingZip} readOnly />
        </div>

        {/* Phone + Fax */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Billing Phone" value={billingPhone} readOnly />
          <Field label="Billing Fax" value={billingFax} onChange={ro ? undefined : onBillingFaxChange} readOnly={ro} />
        </div>

        {/* AP Contact Name + Email */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="AP Contact Name" value={apContactName} onChange={ro ? undefined : onApContactNameChange} readOnly={ro} />
          <Field label="AP Contact Email" value={apContactEmail} onChange={ro ? undefined : onApContactEmailChange} readOnly={ro} />
        </div>

        {/* DPA Contact + Email */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="DPA Contact" value={dpaContact} onChange={ro ? undefined : onDpaContactChange} readOnly={ro} />
          <Field label="DPA Contact Email" value={dpaContactEmail} onChange={ro ? undefined : onDpaContactEmailChange} readOnly={ro} />
        </div>
      </SectionBody>

      {/* ── Section 2: Provider ── */}
      <div className="mt-4">
        <SectionHeader>Section 2 — Provider Information</SectionHeader>
        <SectionBody>
          {/* Primary Provider (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider Name" value={providerName} readOnly />
            <Field label="Provider NPI" value={providerNpi} readOnly />
          </div>

          {/* Additional Provider 1 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Additional Provider 1 Name" value={additionalProvider1Name} onChange={ro ? undefined : onAdditionalProvider1NameChange} readOnly={ro} />
            <Field label="Additional Provider 1 NPI" value={additionalProvider1Npi} onChange={ro ? undefined : onAdditionalProvider1NpiChange} readOnly={ro} />
          </div>

          {/* Additional Provider 2 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Additional Provider 2 Name" value={additionalProvider2Name} onChange={ro ? undefined : onAdditionalProvider2NameChange} readOnly={ro} />
            <Field label="Additional Provider 2 NPI" value={additionalProvider2Npi} onChange={ro ? undefined : onAdditionalProvider2NpiChange} readOnly={ro} />
          </div>
        </SectionBody>
      </div>

      {/* ── Section 3: Shipping Location 1 ── */}
      <div className="mt-4">
        <SectionHeader>Section 3 — Shipping Location 1</SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility Name" value={shippingFacilityName} onChange={ro ? undefined : onShippingFacilityNameChange} readOnly={ro} />
            <Field label="Facility NPI" value={shippingFacilityNpi} onChange={ro ? undefined : onShippingFacilityNpiChange} readOnly={ro} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility TIN" value={shippingFacilityTin} onChange={ro ? undefined : onShippingFacilityTinChange} readOnly={ro} />
            <Field label="Facility PTAN" value={shippingFacilityPtan} onChange={ro ? undefined : onShippingFacilityPtanChange} readOnly={ro} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name" value={shippingContactName} onChange={ro ? undefined : onShippingContactNameChange} readOnly={ro} />
            <Field label="Contact Email" value={shippingContactEmail} onChange={ro ? undefined : onShippingContactEmailChange} readOnly={ro} />
          </div>
          <Field label="Address" value={shippingAddress} onChange={ro ? undefined : onShippingAddressChange} readOnly={ro} className="w-full" />
          <Field label="Receiving Days / Times" value={shippingDaysTimes} onChange={ro ? undefined : onShippingDaysTimesChange} readOnly={ro} className="w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={shippingPhone} onChange={ro ? undefined : onShippingPhoneChange} readOnly={ro} />
            <Field label="Fax" value={shippingFax} onChange={ro ? undefined : onShippingFaxChange} readOnly={ro} />
          </div>
        </SectionBody>
      </div>

      {/* ── Section 4: Shipping Location 2 ── */}
      <div className="mt-4">
        <SectionHeader>Section 4 — Shipping Location 2</SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility Name" value={shipping2FacilityName} onChange={ro ? undefined : onShipping2FacilityNameChange} readOnly={ro} />
            <Field label="Facility NPI" value={shipping2FacilityNpi} onChange={ro ? undefined : onShipping2FacilityNpiChange} readOnly={ro} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility TIN" value={shipping2FacilityTin} onChange={ro ? undefined : onShipping2FacilityTinChange} readOnly={ro} />
            <Field label="Facility PTAN" value={shipping2FacilityPtan} onChange={ro ? undefined : onShipping2FacilityPtanChange} readOnly={ro} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name" value={shipping2ContactName} onChange={ro ? undefined : onShipping2ContactNameChange} readOnly={ro} />
            <Field label="Contact Email" value={shipping2ContactEmail} onChange={ro ? undefined : onShipping2ContactEmailChange} readOnly={ro} />
          </div>
          <Field label="Address" value={shipping2Address} onChange={ro ? undefined : onShipping2AddressChange} readOnly={ro} className="w-full" />
          <Field label="Receiving Days / Times" value={shipping2DaysTimes} onChange={ro ? undefined : onShipping2DaysTimesChange} readOnly={ro} className="w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={shipping2Phone} onChange={ro ? undefined : onShipping2PhoneChange} readOnly={ro} />
            <Field label="Fax" value={shipping2Fax} onChange={ro ? undefined : onShipping2FaxChange} readOnly={ro} />
          </div>
        </SectionBody>
      </div>

      {/* ── Section 5: Claims ── */}
      <div className="mt-4">
        <SectionHeader>Section 5 — Claims Contact</SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name" value={claimsContactName} onChange={ro ? undefined : onClaimsContactNameChange} readOnly={ro} />
            <Field label="Contact Phone" value={claimsContactPhone} onChange={ro ? undefined : onClaimsContactPhoneChange} readOnly={ro} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Email" value={claimsContactEmail} onChange={ro ? undefined : onClaimsContactEmailChange} readOnly={ro} />
            <Field label="Third Party Biller" value={claimsThirdParty} onChange={ro ? undefined : onClaimsThirdPartyChange} readOnly={ro} />
          </div>
        </SectionBody>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-[#ddd] text-center space-y-0.5">
        <p className="text-[11px] text-[#555]">
          Email completed form to{" "}
          <span className="font-semibold">Support@MeridianSurgical.com</span>
        </p>
        <p className="text-[11px] text-[#555]">
          Meridian Surgical Partners · 123 Commerce Drive · Suite 100 · Nashville, TN 37201
        </p>
        <p className="text-[10px] text-[#999] mt-1">REV2.0</p>
      </div>
    </div>
  );
}
