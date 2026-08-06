/**
 * Server-safe shape + helpers for the standalone IVR rich form.
 *
 * Extracted out of StandaloneIvrForm.tsx so server-only surfaces (the
 * PDF route, future email templates, etc.) can import them without
 * pulling in the "use client" component. The client component re-
 * exports these so existing browser consumers keep the same import
 * path.
 */

import type {
  IStandaloneIvr,
  IStandaloneIvrForm,
} from "@/utils/interfaces/standalone-ivrs";

/**
 * Value shape the StandaloneIvrForm component owns. Wider than
 * IStandaloneIvrForm: patient name / DOB / physician name+NPI /
 * product summary live on the parent standalone_ivrs row, not the
 * form bag. Bundled here so the form is the sole source of truth for
 * every editable cell on the paper document.
 */
export interface StandaloneIvrFormValue extends IStandaloneIvrForm {
  patientName: string | null;
  patientDob: string | null;
  physicianName: string | null;
  physicianNpi: string | null;
  productSummary: string | null;
}

/** Blank-form factory — used for reset() and initial-load fallbacks so
 *  callers don't have to remember which columns exist. */
export function emptyStandaloneIvrForm(): StandaloneIvrFormValue {
  return {
    patientName: null,
    patientDob: null,
    physicianName: null,
    physicianNpi: null,
    productSummary: null,
    salesRepName: null,
    placeOfService: null,
    specialtySiteName: null,
    medicareAdminContractor: null,
    facilityName: null,
    facilityAddress: null,
    facilityContact: null,
    facilityPhone: null,
    facilityFax: null,
    facilityNpi: null,
    facilityTin: null,
    facilityPtan: null,
    physicianPhone: null,
    physicianFax: null,
    physicianAddress: null,
    physicianTin: null,
    patientPhone: null,
    patientAddress: null,
    okToContactPatient: null,
    insuranceProvider: null,
    insurancePhone: null,
    memberId: null,
    groupNumber: null,
    planName: null,
    planType: null,
    subscriberName: null,
    subscriberDob: null,
    subscriberRelationship: null,
    providerParticipatesPrimary: null,
    coverageStartDate: null,
    coverageEndDate: null,
    deductibleAmount: null,
    deductibleMet: null,
    outOfPocketMax: null,
    outOfPocketMet: null,
    copayAmount: null,
    coinsurancePercent: null,
    dmeCovered: null,
    woundCareCovered: null,
    priorAuthRequired: null,
    priorAuthNumber: null,
    priorAuthStartDate: null,
    priorAuthEndDate: null,
    unitsAuthorized: null,
    verifiedBy: null,
    verifiedDate: null,
    verificationReference: null,
    secondaryInsuranceProvider: null,
    secondaryInsurancePhone: null,
    secondarySubscriberName: null,
    secondaryPolicyNumber: null,
    secondarySubscriberDob: null,
    secondaryPlanType: null,
    secondaryGroupNumber: null,
    secondarySubscriberRelationship: null,
    providerParticipatesSecondary: null,
    woundType: null,
    woundSizes: null,
    applicationCpts: null,
    dateOfProcedure: null,
    icd10Codes: null,
    productInformation: null,
    isPatientAtSnf: null,
    surgicalGlobalPeriod: null,
    globalPeriodCpt: null,
    priorAuthPermission: null,
    formNotes: null,
  };
}

/**
 * Fold a hydrated IStandaloneIvr into the flat StandaloneIvrFormValue
 * shape the form component consumes. Top-level metadata lives on the
 * parent record; everything else lives on the nested `form` bag.
 * Consumers (detail modal + PDF route + anywhere else the form gets
 * rendered) call this so the fold logic stays in one place.
 */
export function foldIvrToFormValue(
  ivr: IStandaloneIvr,
): StandaloneIvrFormValue {
  return {
    ...emptyStandaloneIvrForm(),
    ...(ivr.form ?? {}),
    patientName: ivr.patientName,
    patientDob: ivr.patientDob,
    physicianName: ivr.physicianName,
    physicianNpi: ivr.physicianNpi,
    productSummary: ivr.productSummary,
  };
}

/**
 * Merge an AI-extracted patch into the current form value, only
 * overwriting keys the user hasn't touched from empty. User edits
 * always win.
 */
export function mergeAiExtract(
  current: StandaloneIvrFormValue,
  extracted: Partial<StandaloneIvrFormValue>,
): StandaloneIvrFormValue {
  const next = { ...current };
  for (const [k, v] of Object.entries(extracted)) {
    const key = k as keyof StandaloneIvrFormValue;
    const cur = current[key];
    const curEmpty =
      cur === null ||
      cur === undefined ||
      (typeof cur === "string" && cur.trim() === "");
    const nextEmpty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && (v as string).trim() === "");
    if (curEmpty && !nextEmpty) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = v;
    }
  }
  return next;
}
