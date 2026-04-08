"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FormField, CheckField } from "./Form1500Field";

interface BillingSectionProps {
  str: (key: string) => string;
  bool: (key: string) => boolean;
  canEdit: boolean;
  handleChange: (name: string, value: string | boolean) => void;
  isReqField: (name: string) => boolean;
  fieldError: (name: string) => boolean;
}

export function Form1500BillingSection({
  str,
  bool,
  canEdit,
  handleChange,
  isReqField,
  fieldError,
}: BillingSectionProps) {
  return (
    <AccordionItem
      value="billing"
      className="border border-slate-200 rounded-xl px-4"
    >
      <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
        10. Billing & Service Facility
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pt-2 pb-4">
        <FormField
          label="Federal Tax ID"
          name="federal_tax_id"
          value={str("federal_tax_id")}
          onChange={handleChange}
          disabled={!canEdit}
          required={isReqField("federal_tax_id")}
          hasError={fieldError("federal_tax_id")}
        />
        <CheckField
          label="Tax ID is SSN?"
          name="tax_id_ssn"
          value={bool("tax_id_ssn")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <CheckField
          label="Accept Assignment?"
          name="accept_assignment"
          value={bool("accept_assignment")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Total Charge ($)"
            name="total_charge"
            type="number"
            value={str("total_charge")}
            onChange={handleChange}
            disabled={!canEdit}
          />
          <FormField
            label="Amount Paid ($)"
            name="amount_paid"
            type="number"
            value={str("amount_paid")}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
        <FormField
          label="Physician Signature"
          name="physician_signature"
          value={str("physician_signature")}
          onChange={handleChange}
          disabled={!canEdit}
          required={isReqField("physician_signature")}
          hasError={fieldError("physician_signature")}
        />
        <FormField
          label="Physician Signature Date"
          name="physician_signature_date"
          type="date"
          value={str("physician_signature_date")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <FormField
          label="Service Facility Name"
          name="service_facility_name"
          value={str("service_facility_name")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <FormField
          label="Service Facility Address"
          name="service_facility_address"
          value={str("service_facility_address")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <FormField
          label="Service Facility NPI"
          name="service_facility_npi"
          value={str("service_facility_npi")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <FormField
          label="Billing Provider Name"
          name="billing_provider_name"
          value={str("billing_provider_name")}
          onChange={handleChange}
          disabled={!canEdit}
          required={isReqField("billing_provider_name")}
          hasError={fieldError("billing_provider_name")}
        />
        <FormField
          label="Billing Provider Address"
          name="billing_provider_address"
          value={str("billing_provider_address")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Billing Provider Phone"
            name="billing_provider_phone"
            type="tel"
            value={str("billing_provider_phone")}
            onChange={handleChange}
            disabled={!canEdit}
          />
          <FormField
            label="Billing Provider NPI"
            name="billing_provider_npi"
            value={str("billing_provider_npi")}
            onChange={handleChange}
            disabled={!canEdit}
            required={isReqField("billing_provider_npi")}
            hasError={fieldError("billing_provider_npi")}
          />
        </div>
        <FormField
          label="Billing Provider Tax ID"
          name="billing_provider_tax_id"
          value={str("billing_provider_tax_id")}
          onChange={handleChange}
          disabled={!canEdit}
        />
        <FormField
          label="Box 30 — Reserved NUCC"
          name="rsvd_nucc"
          value={str("rsvd_nucc")}
          onChange={handleChange}
          disabled={!canEdit}
        />
      </AccordionContent>
    </AccordionItem>
  );
}
