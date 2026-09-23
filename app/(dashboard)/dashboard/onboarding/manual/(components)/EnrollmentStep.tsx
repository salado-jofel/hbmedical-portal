"use client";

import { useEffect, useRef } from "react";
import { EnrollmentFormDocument } from "@/app/(auth)/invite/[token]/signup/(components)/EnrollmentFormDocument";
import type {
  ManualEnrollmentInput,
  ManualFormPatch,
  ManualOnboardingForm,
} from "@/utils/interfaces/manual-onboarding";
import { WizardStepHeading } from "./WizardField";

/** Same enrollment document the provider fills during invite signup, with
 *  shipping pre-filled from the practice step on first visit. */
export function EnrollmentStep({
  form,
  patch,
}: {
  form: ManualOnboardingForm;
  patch: (p: ManualFormPatch) => void;
}) {
  const e = form.enrollment;
  const providerName = `${form.first_name} ${form.last_name}`.trim();

  const set = (key: keyof ManualEnrollmentInput) => (value: string) =>
    patch((f) => ({ enrollment: { ...f.enrollment, [key]: value } }));

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const hasShipping = Object.entries(e).some(([k, v]) => k.startsWith("shipping_") && v);
    if (hasShipping) return;
    patch({
      enrollment: {
        ...e,
        shipping_facility_name: form.office_name,
        shipping_facility_npi: form.npi_number,
        shipping_contact_name: providerName,
        shipping_contact_email: form.email,
        shipping_address: [form.office_address, form.office_city, form.office_state, form.office_postal_code]
          .filter(Boolean)
          .join(", "),
        shipping_phone: form.office_phone,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <WizardStepHeading
        title="Enrollment form"
        description="Copy what the clinic filled in on paper. Every field is optional and can be updated later from their settings."
      />
      <EnrollmentFormDocument
        canEdit
        facilityName={form.office_name}
        providerName={providerName}
        providerNpi={form.npi_number}
        billingAddress={form.office_address}
        billingCity={form.office_city}
        billingState={form.office_state}
        billingZip={form.office_postal_code}
        billingPhone={form.office_phone}
        facilityEin={e.facility_ein} onFacilityEinChange={set("facility_ein")}
        facilityNpi={e.facility_npi} onFacilityNpiChange={set("facility_npi")}
        facilityPtan={e.facility_ptan} onFacilityPtanChange={set("facility_ptan")}
        medicareMac={e.medicare_mac} onMedicareMacChange={set("medicare_mac")}
        apContactName={e.ap_contact_name} onApContactNameChange={set("ap_contact_name")}
        apContactEmail={e.ap_contact_email} onApContactEmailChange={set("ap_contact_email")}
        dpaContact={e.dpa_contact} onDpaContactChange={set("dpa_contact")}
        dpaContactEmail={e.dpa_contact_email} onDpaContactEmailChange={set("dpa_contact_email")}
        additionalProvider1Name={e.additional_provider_1_name} onAdditionalProvider1NameChange={set("additional_provider_1_name")}
        additionalProvider1Npi={e.additional_provider_1_npi} onAdditionalProvider1NpiChange={set("additional_provider_1_npi")}
        additionalProvider2Name={e.additional_provider_2_name} onAdditionalProvider2NameChange={set("additional_provider_2_name")}
        additionalProvider2Npi={e.additional_provider_2_npi} onAdditionalProvider2NpiChange={set("additional_provider_2_npi")}
        shippingFacilityName={e.shipping_facility_name} onShippingFacilityNameChange={set("shipping_facility_name")}
        shippingFacilityNpi={e.shipping_facility_npi} onShippingFacilityNpiChange={set("shipping_facility_npi")}
        shippingFacilityPtan={e.shipping_facility_ptan} onShippingFacilityPtanChange={set("shipping_facility_ptan")}
        shippingContactName={e.shipping_contact_name} onShippingContactNameChange={set("shipping_contact_name")}
        shippingContactEmail={e.shipping_contact_email} onShippingContactEmailChange={set("shipping_contact_email")}
        shippingAddress={e.shipping_address} onShippingAddressChange={set("shipping_address")}
        shippingPhone={e.shipping_phone} onShippingPhoneChange={set("shipping_phone")}
      />
    </div>
  );
}
