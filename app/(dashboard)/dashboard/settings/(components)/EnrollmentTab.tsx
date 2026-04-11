"use client";

import { useState, useCallback } from "react";
import { Save, RotateCcw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { EnrollmentFormDocument } from "@/app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument";
import { saveEnrollmentData } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { FacilityEnrollmentData } from "@/app/(dashboard)/dashboard/settings/(services)/actions";

const s = (v: string | null | undefined) => v ?? "";

function toPayload(state: ReturnType<typeof buildState>): Omit<FacilityEnrollmentData, "facility_id"> {
  return {
    facility_ein:               state.facilityEin || null,
    facility_npi:               state.facilityNpi || null,
    facility_tin:               state.facilityTin || null,
    facility_ptan:              state.facilityPtan || null,
    ap_contact_name:            state.apContactName || null,
    ap_contact_email:           state.apContactEmail || null,
    billing_address:            state.billingAddress || null,
    billing_city:               state.billingCity || null,
    billing_state:              state.billingState || null,
    billing_zip:                state.billingZip || null,
    billing_phone:              state.billingPhone || null,
    billing_fax:                state.billingFax || null,
    dpa_contact:                state.dpaContact || null,
    dpa_contact_email:          state.dpaContactEmail || null,
    additional_provider_1_name: state.additionalProvider1Name || null,
    additional_provider_1_npi:  state.additionalProvider1Npi || null,
    additional_provider_2_name: state.additionalProvider2Name || null,
    additional_provider_2_npi:  state.additionalProvider2Npi || null,
    shipping_facility_name:     state.shippingFacilityName || null,
    shipping_facility_npi:      state.shippingFacilityNpi || null,
    shipping_facility_tin:      state.shippingFacilityTin || null,
    shipping_facility_ptan:     state.shippingFacilityPtan || null,
    shipping_contact_name:      state.shippingContactName || null,
    shipping_contact_email:     state.shippingContactEmail || null,
    shipping_address:           state.shippingAddress || null,
    shipping_days_times:        state.shippingDaysTimes || null,
    shipping_phone:             state.shippingPhone || null,
    shipping_fax:               state.shippingFax || null,
    shipping2_facility_name:    state.shipping2FacilityName || null,
    shipping2_facility_npi:     state.shipping2FacilityNpi || null,
    shipping2_facility_tin:     state.shipping2FacilityTin || null,
    shipping2_facility_ptan:    state.shipping2FacilityPtan || null,
    shipping2_contact_name:     state.shipping2ContactName || null,
    shipping2_contact_email:    state.shipping2ContactEmail || null,
    shipping2_address:          state.shipping2Address || null,
    shipping2_days_times:       state.shipping2DaysTimes || null,
    shipping2_phone:            state.shipping2Phone || null,
    shipping2_fax:              state.shipping2Fax || null,
    claims_contact_name:        state.claimsContactName || null,
    claims_contact_phone:       state.claimsContactPhone || null,
    claims_contact_email:       state.claimsContactEmail || null,
    claims_third_party:         state.claimsThirdParty || null,
  };
}

function buildState(d: FacilityEnrollmentData | null) {
  return {
    facilityEin:              s(d?.facility_ein),
    facilityNpi:              s(d?.facility_npi),
    facilityTin:              s(d?.facility_tin),
    facilityPtan:             s(d?.facility_ptan),
    apContactName:            s(d?.ap_contact_name),
    apContactEmail:           s(d?.ap_contact_email),
    billingAddress:           s(d?.billing_address),
    billingCity:              s(d?.billing_city),
    billingState:             s(d?.billing_state),
    billingZip:               s(d?.billing_zip),
    billingPhone:             s(d?.billing_phone),
    billingFax:               s(d?.billing_fax),
    dpaContact:               s(d?.dpa_contact),
    dpaContactEmail:          s(d?.dpa_contact_email),
    additionalProvider1Name:  s(d?.additional_provider_1_name),
    additionalProvider1Npi:   s(d?.additional_provider_1_npi),
    additionalProvider2Name:  s(d?.additional_provider_2_name),
    additionalProvider2Npi:   s(d?.additional_provider_2_npi),
    shippingFacilityName:     s(d?.shipping_facility_name),
    shippingFacilityNpi:      s(d?.shipping_facility_npi),
    shippingFacilityTin:      s(d?.shipping_facility_tin),
    shippingFacilityPtan:     s(d?.shipping_facility_ptan),
    shippingContactName:      s(d?.shipping_contact_name),
    shippingContactEmail:     s(d?.shipping_contact_email),
    shippingAddress:          s(d?.shipping_address),
    shippingDaysTimes:        s(d?.shipping_days_times),
    shippingPhone:            s(d?.shipping_phone),
    shippingFax:              s(d?.shipping_fax),
    shipping2FacilityName:    s(d?.shipping2_facility_name),
    shipping2FacilityNpi:     s(d?.shipping2_facility_npi),
    shipping2FacilityTin:     s(d?.shipping2_facility_tin),
    shipping2FacilityPtan:    s(d?.shipping2_facility_ptan),
    shipping2ContactName:     s(d?.shipping2_contact_name),
    shipping2ContactEmail:    s(d?.shipping2_contact_email),
    shipping2Address:         s(d?.shipping2_address),
    shipping2DaysTimes:       s(d?.shipping2_days_times),
    shipping2Phone:           s(d?.shipping2_phone),
    shipping2Fax:             s(d?.shipping2_fax),
    claimsContactName:        s(d?.claims_contact_name),
    claimsContactPhone:       s(d?.claims_contact_phone),
    claimsContactEmail:       s(d?.claims_contact_email),
    claimsThirdParty:         s(d?.claims_third_party),
  };
}

interface EnrollmentTabProps {
  enrollmentData: FacilityEnrollmentData | null;
  facilityName: string;
  providerName: string;
  providerNpi: string;
  billingAddressPrefill: string;
  billingCityPrefill: string;
  billingStatePrefill: string;
  billingZipPrefill: string;
  billingPhonePrefill: string;
}

export function EnrollmentTab({
  enrollmentData,
  facilityName,
  providerName,
  providerNpi,
  billingAddressPrefill,
  billingCityPrefill,
  billingStatePrefill,
  billingZipPrefill,
  billingPhonePrefill,
}: EnrollmentTabProps) {
  const initial = buildState(enrollmentData);
  const [fields, setFields] = useState(initial);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  const set = useCallback((key: keyof typeof initial) => (v: string) => {
    setFields((prev) => ({ ...prev, [key]: v }));
    setIsDirty(true);
    setMissingFields((prev) => { const next = new Set(prev); next.delete(key); return next; });
  }, []);

  function discard() {
    setFields(initial);
    setIsDirty(false);
    setMissingFields(new Set());
  }

  async function handleSave() {
    // Validate required fields
    const requiredKeys: (keyof typeof initial)[] = [
      "facilityEin", "facilityNpi", "facilityTin", "facilityPtan",
      "apContactName", "apContactEmail", "billingFax", "dpaContact", "dpaContactEmail",
      "additionalProvider1Name", "additionalProvider1Npi",
      "additionalProvider2Name", "additionalProvider2Npi",
      "shippingFacilityName", "shippingFacilityNpi", "shippingFacilityTin", "shippingFacilityPtan",
      "shippingContactName", "shippingContactEmail", "shippingAddress", "shippingDaysTimes",
      "shippingPhone", "shippingFax",
      "shipping2FacilityName", "shipping2FacilityNpi", "shipping2FacilityTin", "shipping2FacilityPtan",
      "shipping2ContactName", "shipping2ContactEmail", "shipping2Address", "shipping2DaysTimes",
      "shipping2Phone", "shipping2Fax",
      "claimsContactName", "claimsContactPhone", "claimsContactEmail", "claimsThirdParty",
    ];

    const empty = new Set(requiredKeys.filter((k) => !fields[k].trim()));
    if (empty.size > 0) {
      setMissingFields(empty);
      toast.error("Please complete all highlighted fields.");
      return;
    }

    setIsSaving(true);
    const result = await saveEnrollmentData(toPayload(fields));
    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setIsDirty(false);
      setMissingFields(new Set());
      toast.success("Enrollment data saved.");
    }
  }

  // Billing address: use enrollment data if saved, otherwise prefill from facility
  const billingAddr  = fields.billingAddress  || billingAddressPrefill;
  const billingCity  = fields.billingCity     || billingCityPrefill;
  const billingState = fields.billingState    || billingStatePrefill;
  const billingZip   = fields.billingZip      || billingZipPrefill;
  const billingPhone = fields.billingPhone    || billingPhonePrefill;

  return (
    <div className="space-y-4">
      {/* Save / Discard bar */}
      {isDirty && (
        <div className="flex items-center justify-between gap-3 bg-[#EFF6FF] border border-[var(--navy)]/20 rounded-lg px-4 py-2.5">
          <p className="text-[13px] text-[var(--navy)] font-medium">You have unsaved changes.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-[12px] text-[#64748B] hover:text-[#0F172A] transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 text-white text-[12px] font-medium px-3 h-7 transition-colors"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      <EnrollmentFormDocument
        canEdit
        facilityName={facilityName}
        providerName={providerName}
        providerNpi={providerNpi}
        billingAddress={billingAddr}
        billingCity={billingCity}
        billingState={billingState}
        billingZip={billingZip}
        billingPhone={billingPhone}
        missingFields={missingFields}
        onClearMissing={(name) => setMissingFields((prev) => { const next = new Set(prev); next.delete(name); return next; })}
        facilityEin={fields.facilityEin}               onFacilityEinChange={set("facilityEin")}
        facilityNpi={fields.facilityNpi}               onFacilityNpiChange={set("facilityNpi")}
        facilityTin={fields.facilityTin}               onFacilityTinChange={set("facilityTin")}
        facilityPtan={fields.facilityPtan}             onFacilityPtanChange={set("facilityPtan")}
        apContactName={fields.apContactName}           onApContactNameChange={set("apContactName")}
        apContactEmail={fields.apContactEmail}         onApContactEmailChange={set("apContactEmail")}
        billingFax={fields.billingFax}                 onBillingFaxChange={set("billingFax")}
        dpaContact={fields.dpaContact}                 onDpaContactChange={set("dpaContact")}
        dpaContactEmail={fields.dpaContactEmail}       onDpaContactEmailChange={set("dpaContactEmail")}
        additionalProvider1Name={fields.additionalProvider1Name} onAdditionalProvider1NameChange={set("additionalProvider1Name")}
        additionalProvider1Npi={fields.additionalProvider1Npi}   onAdditionalProvider1NpiChange={set("additionalProvider1Npi")}
        additionalProvider2Name={fields.additionalProvider2Name} onAdditionalProvider2NameChange={set("additionalProvider2Name")}
        additionalProvider2Npi={fields.additionalProvider2Npi}   onAdditionalProvider2NpiChange={set("additionalProvider2Npi")}
        shippingFacilityName={fields.shippingFacilityName}     onShippingFacilityNameChange={set("shippingFacilityName")}
        shippingFacilityNpi={fields.shippingFacilityNpi}       onShippingFacilityNpiChange={set("shippingFacilityNpi")}
        shippingFacilityTin={fields.shippingFacilityTin}       onShippingFacilityTinChange={set("shippingFacilityTin")}
        shippingFacilityPtan={fields.shippingFacilityPtan}     onShippingFacilityPtanChange={set("shippingFacilityPtan")}
        shippingContactName={fields.shippingContactName}       onShippingContactNameChange={set("shippingContactName")}
        shippingContactEmail={fields.shippingContactEmail}     onShippingContactEmailChange={set("shippingContactEmail")}
        shippingAddress={fields.shippingAddress}               onShippingAddressChange={set("shippingAddress")}
        shippingDaysTimes={fields.shippingDaysTimes}           onShippingDaysTimesChange={set("shippingDaysTimes")}
        shippingPhone={fields.shippingPhone}                   onShippingPhoneChange={set("shippingPhone")}
        shippingFax={fields.shippingFax}                       onShippingFaxChange={set("shippingFax")}
        shipping2FacilityName={fields.shipping2FacilityName}   onShipping2FacilityNameChange={set("shipping2FacilityName")}
        shipping2FacilityNpi={fields.shipping2FacilityNpi}     onShipping2FacilityNpiChange={set("shipping2FacilityNpi")}
        shipping2FacilityTin={fields.shipping2FacilityTin}     onShipping2FacilityTinChange={set("shipping2FacilityTin")}
        shipping2FacilityPtan={fields.shipping2FacilityPtan}   onShipping2FacilityPtanChange={set("shipping2FacilityPtan")}
        shipping2ContactName={fields.shipping2ContactName}     onShipping2ContactNameChange={set("shipping2ContactName")}
        shipping2ContactEmail={fields.shipping2ContactEmail}   onShipping2ContactEmailChange={set("shipping2ContactEmail")}
        shipping2Address={fields.shipping2Address}             onShipping2AddressChange={set("shipping2Address")}
        shipping2DaysTimes={fields.shipping2DaysTimes}         onShipping2DaysTimesChange={set("shipping2DaysTimes")}
        shipping2Phone={fields.shipping2Phone}                 onShipping2PhoneChange={set("shipping2Phone")}
        shipping2Fax={fields.shipping2Fax}                     onShipping2FaxChange={set("shipping2Fax")}
        claimsContactName={fields.claimsContactName}           onClaimsContactNameChange={set("claimsContactName")}
        claimsContactPhone={fields.claimsContactPhone}         onClaimsContactPhoneChange={set("claimsContactPhone")}
        claimsContactEmail={fields.claimsContactEmail}         onClaimsContactEmailChange={set("claimsContactEmail")}
        claimsThirdParty={fields.claimsThirdParty}             onClaimsThirdPartyChange={set("claimsThirdParty")}
      />

      {/* Bottom save button (always visible for convenience) */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium px-4 h-9 transition-colors"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Enrollment
        </button>
      </div>
    </div>
  );
}
