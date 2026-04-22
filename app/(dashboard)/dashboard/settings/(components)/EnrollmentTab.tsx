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
    facility_ptan:              state.facilityPtan || null,
    medicare_mac:               state.medicareMac || null,
    ap_contact_name:            state.apContactName || null,
    ap_contact_email:           state.apContactEmail || null,
    billing_address:            state.billingAddress || null,
    billing_city:               state.billingCity || null,
    billing_state:              state.billingState || null,
    billing_zip:                state.billingZip || null,
    billing_phone:              state.billingPhone || null,
    dpa_contact:                state.dpaContact || null,
    dpa_contact_email:          state.dpaContactEmail || null,
    additional_provider_1_name: state.additionalProvider1Name || null,
    additional_provider_1_npi:  state.additionalProvider1Npi || null,
    additional_provider_2_name: state.additionalProvider2Name || null,
    additional_provider_2_npi:  state.additionalProvider2Npi || null,
    shipping_facility_name:     state.shippingFacilityName || null,
    shipping_facility_npi:      state.shippingFacilityNpi || null,
    shipping_facility_ptan:     state.shippingFacilityPtan || null,
    shipping_contact_name:      state.shippingContactName || null,
    shipping_contact_email:     state.shippingContactEmail || null,
    shipping_address:           state.shippingAddress || null,
    shipping_phone:             state.shippingPhone || null,
  };
}

function buildState(d: FacilityEnrollmentData | null) {
  return {
    facilityEin:              s(d?.facility_ein),
    facilityNpi:              s(d?.facility_npi),
    facilityPtan:             s(d?.facility_ptan),
    medicareMac:              s(d?.medicare_mac),
    apContactName:            s(d?.ap_contact_name),
    apContactEmail:           s(d?.ap_contact_email),
    billingAddress:           s(d?.billing_address),
    billingCity:              s(d?.billing_city),
    billingState:             s(d?.billing_state),
    billingZip:               s(d?.billing_zip),
    billingPhone:             s(d?.billing_phone),
    dpaContact:               s(d?.dpa_contact),
    dpaContactEmail:          s(d?.dpa_contact_email),
    additionalProvider1Name:  s(d?.additional_provider_1_name),
    additionalProvider1Npi:   s(d?.additional_provider_1_npi),
    additionalProvider2Name:  s(d?.additional_provider_2_name),
    additionalProvider2Npi:   s(d?.additional_provider_2_npi),
    shippingFacilityName:     s(d?.shipping_facility_name),
    shippingFacilityNpi:      s(d?.shipping_facility_npi),
    shippingFacilityPtan:     s(d?.shipping_facility_ptan),
    shippingContactName:      s(d?.shipping_contact_name),
    shippingContactEmail:     s(d?.shipping_contact_email),
    shippingAddress:          s(d?.shipping_address),
    shippingPhone:            s(d?.shipping_phone),
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

  const set = useCallback((key: keyof typeof initial) => (v: string) => {
    setFields((prev) => ({ ...prev, [key]: v }));
    setIsDirty(true);
  }, []);

  function discard() {
    setFields(initial);
    setIsDirty(false);
  }

  async function handleSave() {
    // All enrollment fields are optional — save whatever's filled.
    setIsSaving(true);
    const result = await saveEnrollmentData(toPayload(fields));
    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setIsDirty(false);
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
        facilityEin={fields.facilityEin}               onFacilityEinChange={set("facilityEin")}
        facilityNpi={fields.facilityNpi}               onFacilityNpiChange={set("facilityNpi")}
        facilityPtan={fields.facilityPtan}             onFacilityPtanChange={set("facilityPtan")}
        medicareMac={fields.medicareMac}               onMedicareMacChange={set("medicareMac")}
        apContactName={fields.apContactName}           onApContactNameChange={set("apContactName")}
        apContactEmail={fields.apContactEmail}         onApContactEmailChange={set("apContactEmail")}
        dpaContact={fields.dpaContact}                 onDpaContactChange={set("dpaContact")}
        dpaContactEmail={fields.dpaContactEmail}       onDpaContactEmailChange={set("dpaContactEmail")}
        additionalProvider1Name={fields.additionalProvider1Name} onAdditionalProvider1NameChange={set("additionalProvider1Name")}
        additionalProvider1Npi={fields.additionalProvider1Npi}   onAdditionalProvider1NpiChange={set("additionalProvider1Npi")}
        additionalProvider2Name={fields.additionalProvider2Name} onAdditionalProvider2NameChange={set("additionalProvider2Name")}
        additionalProvider2Npi={fields.additionalProvider2Npi}   onAdditionalProvider2NpiChange={set("additionalProvider2Npi")}
        shippingFacilityName={fields.shippingFacilityName}     onShippingFacilityNameChange={set("shippingFacilityName")}
        shippingFacilityNpi={fields.shippingFacilityNpi}       onShippingFacilityNpiChange={set("shippingFacilityNpi")}
        shippingFacilityPtan={fields.shippingFacilityPtan}     onShippingFacilityPtanChange={set("shippingFacilityPtan")}
        shippingContactName={fields.shippingContactName}       onShippingContactNameChange={set("shippingContactName")}
        shippingContactEmail={fields.shippingContactEmail}     onShippingContactEmailChange={set("shippingContactEmail")}
        shippingAddress={fields.shippingAddress}               onShippingAddressChange={set("shippingAddress")}
        shippingPhone={fields.shippingPhone}                   onShippingPhoneChange={set("shippingPhone")}
      />
    </div>
  );
}
