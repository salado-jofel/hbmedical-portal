"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IOrderIVR, IOrderForm } from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  requireIVREditRole,
  generateOrderPDFs,
  triggerAiExtraction,
} from "./_shared";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
import { safeLogError } from "@/lib/logging/safe-log";
import { requireOrderAccess } from "@/lib/supabase/order-access";

/* -------------------------------------------------------------------------- */
/* getOrderIVR                                                                 */
/* -------------------------------------------------------------------------- */

function mapIvrRow(data: Record<string, unknown>): IOrderIVR {
  return {
    id:                          data.id as string,
    orderId:                     data.order_id as string,
    insuranceProvider:           data.insurance_provider as string | null,
    insurancePhone:              data.insurance_phone as string | null,
    memberId:                    data.member_id as string | null,
    groupNumber:                 data.group_number as string | null,
    planName:                    data.plan_name as string | null,
    planType:                    data.plan_type as string | null,
    subscriberName:              data.subscriber_name as string | null,
    subscriberDob:               data.subscriber_dob as string | null,
    subscriberRelationship:      data.subscriber_relationship as string | null,
    coverageStartDate:           data.coverage_start_date as string | null,
    coverageEndDate:             data.coverage_end_date as string | null,
    deductibleAmount:            data.deductible_amount != null ? Number(data.deductible_amount) : null,
    deductibleMet:               data.deductible_met != null ? Number(data.deductible_met) : null,
    outOfPocketMax:              data.out_of_pocket_max != null ? Number(data.out_of_pocket_max) : null,
    outOfPocketMet:              data.out_of_pocket_met != null ? Number(data.out_of_pocket_met) : null,
    copayAmount:                 data.copay_amount != null ? Number(data.copay_amount) : null,
    coinsurancePercent:          data.coinsurance_percent != null ? Number(data.coinsurance_percent) : null,
    dmeCovered:                  (data.dme_covered as boolean) ?? false,
    woundCareCovered:            (data.wound_care_covered as boolean) ?? false,
    priorAuthRequired:           (data.prior_auth_required as boolean) ?? false,
    priorAuthNumber:             data.prior_auth_number as string | null,
    priorAuthStartDate:          data.prior_auth_start_date as string | null,
    priorAuthEndDate:            data.prior_auth_end_date as string | null,
    unitsAuthorized:             data.units_authorized as number | null,
    placeOfService:              data.place_of_service as string | null,
    medicareAdminContractor:     data.medicare_admin_contractor as string | null,
    facilityNpi:                 data.facility_npi as string | null,
    facilityTin:                 data.facility_tin as string | null,
    facilityPtan:                data.facility_ptan as string | null,
    facilityFax:                 data.facility_fax as string | null,
    physicianTin:                data.physician_tin as string | null,
    physicianFax:                data.physician_fax as string | null,
    physicianAddress:            data.physician_address as string | null,
    patientPhone:                data.patient_phone as string | null,
    patientAddress:              data.patient_address as string | null,
    okToContactPatient:          data.ok_to_contact_patient as boolean | null,
    providerParticipatesPrimary: data.provider_participates_primary as string | null,
    providerParticipatesSecondary: data.provider_participates_secondary as string | null,
    priorAuthPermission:         data.prior_auth_permission as boolean | null,
    specialtySiteName:           data.specialty_site_name as string | null,
    secondaryInsuranceProvider:  data.secondary_insurance_provider as string | null,
    secondaryInsurancePhone:     data.secondary_insurance_phone as string | null,
    secondarySubscriberName:     data.secondary_subscriber_name as string | null,
    secondaryPolicyNumber:       data.secondary_policy_number as string | null,
    secondarySubscriberDob:      data.secondary_subscriber_dob as string | null,
    secondaryPlanType:           data.secondary_plan_type as string | null,
    secondaryGroupNumber:        data.secondary_group_number as string | null,
    secondarySubscriberRelationship: data.secondary_subscriber_relationship as string | null,
    // Override / display fields
    facilityName:                data.facility_name as string | null,
    facilityAddress:             data.facility_address as string | null,
    facilityPhone:               data.facility_phone as string | null,
    facilityContact:             data.facility_contact as string | null,
    physicianName:               data.physician_name as string | null,
    physicianPhone:              data.physician_phone as string | null,
    physicianNpi:                data.physician_npi as string | null,
    patientName:                 data.patient_name as string | null,
    patientDob:                  data.patient_dob as string | null,
    applicationCpts:             data.application_cpts as string | null,
    surgicalGlobalPeriod:        data.surgical_global_period as boolean | null,
    globalPeriodCpt:             data.global_period_cpt as string | null,
    verifiedBy:                  data.verified_by as string | null,
    verifiedDate:                data.verified_date as string | null,
    verificationReference:       data.verification_reference as string | null,
    notes:                       data.notes as string | null,
    salesRepName:                data.sales_rep_name as string | null,
    woundType:                   data.wound_type as string | null,
    woundSizes:                  data.wound_sizes as string | null,
    dateOfProcedure:             data.date_of_procedure as string | null,
    icd10Codes:                  data.icd10_codes as string | null,
    productInformation:          data.product_information as string | null,
    isPatientAtSnf:              data.is_patient_at_snf as boolean | null,
    physicianSignature:          data.physician_signature as string | null,
    physicianSignatureDate:      data.physician_signature_date as string | null,
    physicianSignedAt:           data.physician_signed_at as string | null,
    physicianSignedBy:           data.physician_signed_by as string | null,
    physicianSignatureImage:     data.physician_signature_image as string | null,
    aiExtracted:                 (data.ai_extracted as boolean) ?? false,
    ivrMode:                     ((data.ivr_mode as string) ?? "built") as IOrderIVR["ivrMode"],
    createdAt:                   data.created_at as string,
    updatedAt:                   data.updated_at as string,
  };
}

export async function getOrderIVR(
  orderId: string,
): Promise<{ ivr: IOrderIVR | null }> {
  try {
    await requireOrderAccess(orderId);

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("order_ivr")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      safeLogError("getOrderIVR", error, { orderId });
      return { ivr: null };
    }

    if (!data) return { ivr: null };

    void logPhiAccess({
      action: "ivr.read",
      resource: "order_ivr",
      resourceId: (data as { id?: string }).id ?? null,
      orderId,
    });

    return { ivr: mapIvrRow(data as Record<string, unknown>) };
  } catch (err) {
    safeLogError("getOrderIVR", err, { orderId });
    return { ivr: null };
  }
}

/* -------------------------------------------------------------------------- */
/* upsertOrderIVR                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertOrderIVR(
  orderId: string,
  data: Partial<IOrderIVR>,
  ifMatchUpdatedAt?: string | null,
): Promise<{
  success: boolean;
  error: string | null;
  conflict?: boolean;
  updatedAt?: string;
}> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    if (ifMatchUpdatedAt) {
      const { data: current } = await adminClient
        .from("order_ivr")
        .select("updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (current && current.updated_at !== ifMatchUpdatedAt) {
        return {
          success: false,
          conflict: true,
          error:
            "Someone else saved this form while you were editing. Reload to see their changes.",
        };
      }
    }

    const payload: Record<string, unknown> = { order_id: orderId };
    // Primary insurance
    if (data.insuranceProvider !== undefined) payload.insurance_provider = data.insuranceProvider;
    if (data.insurancePhone !== undefined) payload.insurance_phone = data.insurancePhone;
    if (data.memberId !== undefined) payload.member_id = data.memberId;
    if (data.groupNumber !== undefined) payload.group_number = data.groupNumber;
    if (data.planName !== undefined) payload.plan_name = data.planName;
    if (data.planType !== undefined) payload.plan_type = data.planType;
    if (data.subscriberName !== undefined) payload.subscriber_name = data.subscriberName;
    if (data.subscriberDob !== undefined) payload.subscriber_dob = data.subscriberDob;
    if (data.subscriberRelationship !== undefined) payload.subscriber_relationship = data.subscriberRelationship;
    if (data.coverageStartDate !== undefined) payload.coverage_start_date = data.coverageStartDate;
    if (data.coverageEndDate !== undefined) payload.coverage_end_date = data.coverageEndDate;
    if (data.deductibleAmount !== undefined) payload.deductible_amount = data.deductibleAmount;
    if (data.deductibleMet !== undefined) payload.deductible_met = data.deductibleMet;
    if (data.outOfPocketMax !== undefined) payload.out_of_pocket_max = data.outOfPocketMax;
    if (data.outOfPocketMet !== undefined) payload.out_of_pocket_met = data.outOfPocketMet;
    if (data.copayAmount !== undefined) payload.copay_amount = data.copayAmount;
    if (data.coinsurancePercent !== undefined) payload.coinsurance_percent = data.coinsurancePercent;
    if (data.dmeCovered !== undefined) payload.dme_covered = data.dmeCovered;
    if (data.woundCareCovered !== undefined) payload.wound_care_covered = data.woundCareCovered;
    if (data.priorAuthRequired !== undefined) payload.prior_auth_required = data.priorAuthRequired;
    if (data.priorAuthNumber !== undefined) payload.prior_auth_number = data.priorAuthNumber;
    if (data.priorAuthStartDate !== undefined) payload.prior_auth_start_date = data.priorAuthStartDate;
    if (data.priorAuthEndDate !== undefined) payload.prior_auth_end_date = data.priorAuthEndDate;
    if (data.unitsAuthorized !== undefined) payload.units_authorized = data.unitsAuthorized;
    // Facility / physician / patient context
    if (data.placeOfService !== undefined) payload.place_of_service = data.placeOfService;
    if (data.medicareAdminContractor !== undefined) payload.medicare_admin_contractor = data.medicareAdminContractor;
    if (data.facilityNpi !== undefined) payload.facility_npi = data.facilityNpi;
    if (data.facilityTin !== undefined) payload.facility_tin = data.facilityTin;
    if (data.facilityPtan !== undefined) payload.facility_ptan = data.facilityPtan;
    if (data.facilityFax !== undefined) payload.facility_fax = data.facilityFax;
    if (data.physicianTin !== undefined) payload.physician_tin = data.physicianTin;
    if (data.physicianFax !== undefined) payload.physician_fax = data.physicianFax;
    if (data.physicianAddress !== undefined) payload.physician_address = data.physicianAddress;
    if (data.patientPhone !== undefined) payload.patient_phone = data.patientPhone;
    if (data.patientAddress !== undefined) payload.patient_address = data.patientAddress;
    if (data.okToContactPatient !== undefined) payload.ok_to_contact_patient = data.okToContactPatient;
    // Network / auth
    if (data.providerParticipatesPrimary !== undefined) payload.provider_participates_primary = data.providerParticipatesPrimary;
    if (data.providerParticipatesSecondary !== undefined) payload.provider_participates_secondary = data.providerParticipatesSecondary;
    if (data.priorAuthPermission !== undefined) payload.prior_auth_permission = data.priorAuthPermission;
    if (data.specialtySiteName !== undefined) payload.specialty_site_name = data.specialtySiteName;
    // Secondary insurance
    if (data.secondaryInsuranceProvider !== undefined) payload.secondary_insurance_provider = data.secondaryInsuranceProvider;
    if (data.secondaryInsurancePhone !== undefined) payload.secondary_insurance_phone = data.secondaryInsurancePhone;
    if (data.secondarySubscriberName !== undefined) payload.secondary_subscriber_name = data.secondarySubscriberName;
    if (data.secondaryPolicyNumber !== undefined) payload.secondary_policy_number = data.secondaryPolicyNumber;
    if (data.secondarySubscriberDob !== undefined) payload.secondary_subscriber_dob = data.secondarySubscriberDob;
    if (data.secondaryPlanType !== undefined) payload.secondary_plan_type = data.secondaryPlanType;
    if (data.secondaryGroupNumber !== undefined) payload.secondary_group_number = data.secondaryGroupNumber;
    if (data.secondarySubscriberRelationship !== undefined) payload.secondary_subscriber_relationship = data.secondarySubscriberRelationship;
    // CPT / global period
    // Override columns
    if (data.facilityName !== undefined)    payload.facility_name    = data.facilityName;
    if (data.facilityAddress !== undefined) payload.facility_address = data.facilityAddress;
    if (data.facilityPhone !== undefined)   payload.facility_phone   = data.facilityPhone;
    if (data.facilityContact !== undefined) payload.facility_contact = data.facilityContact;
    if (data.physicianName !== undefined)   payload.physician_name   = data.physicianName;
    if (data.physicianPhone !== undefined)  payload.physician_phone  = data.physicianPhone;
    if (data.physicianNpi !== undefined)    payload.physician_npi    = data.physicianNpi;
    if (data.patientName !== undefined)     payload.patient_name     = data.patientName;
    if (data.patientDob !== undefined)      payload.patient_dob      = data.patientDob;
    if (data.applicationCpts !== undefined) payload.application_cpts = data.applicationCpts;
    if (data.surgicalGlobalPeriod !== undefined) payload.surgical_global_period = data.surgicalGlobalPeriod;
    if (data.globalPeriodCpt !== undefined) payload.global_period_cpt = data.globalPeriodCpt;
    // Verification
    if (data.verifiedBy !== undefined) payload.verified_by = data.verifiedBy;
    if (data.verifiedDate !== undefined) payload.verified_date = data.verifiedDate;
    if (data.verificationReference !== undefined) payload.verification_reference = data.verificationReference;
    if (data.notes !== undefined) payload.notes = data.notes;
    // New document fields
    if (data.salesRepName !== undefined)         payload.sales_rep_name         = data.salesRepName;
    if (data.woundType !== undefined)            payload.wound_type             = data.woundType;
    if (data.woundSizes !== undefined)           payload.wound_sizes            = data.woundSizes;
    if (data.dateOfProcedure !== undefined)      payload.date_of_procedure      = data.dateOfProcedure;
    if (data.icd10Codes !== undefined)           payload.icd10_codes            = data.icd10Codes;
    if (data.productInformation !== undefined)   payload.product_information    = data.productInformation;
    if (data.isPatientAtSnf !== undefined)       payload.is_patient_at_snf      = data.isPatientAtSnf;
    if (data.physicianSignature !== undefined)   payload.physician_signature    = data.physicianSignature;
    if (data.physicianSignatureDate !== undefined) payload.physician_signature_date = data.physicianSignatureDate;
    if (data.physicianSignedAt !== undefined)    payload.physician_signed_at    = data.physicianSignedAt;
    if (data.physicianSignedBy !== undefined)    payload.physician_signed_by    = data.physicianSignedBy;

    const nowIso = new Date().toISOString();
    payload.updated_at = nowIso;
    const { data: saved, error } = await adminClient
      .from("order_ivr")
      .upsert(payload, { onConflict: "order_id" })
      .select("updated_at")
      .single();

    if (error) {
      safeLogError("upsertOrderIVR", error, { orderId });
      return { success: false, error: error.message ?? "Failed to save IVR." };
    }

    revalidatePath(ORDERS_PATH);

    generateOrderPDFs(orderId, ["ivr"]).catch(
      err => safeLogError("IVR PDF", err, { orderId }),
    );

    return { success: true, error: null, updatedAt: saved?.updated_at ?? nowIso };
  } catch (err) {
    safeLogError("upsertOrderIVR", err, { orderId });
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getOrderAiStatus                                                            */
/* -------------------------------------------------------------------------- */

export async function getOrderAiStatus(
  orderId: string,
): Promise<{ aiExtracted: boolean; orderForm: IOrderForm | null }> {
  await requireOrderAccess(orderId);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("ai_extracted")
    .eq("id", orderId)
    .single();

  if (!order?.ai_extracted) {
    return { aiExtracted: false, orderForm: null };
  }

  const { data: form } = await supabase
    .from("order_form")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (!form) {
    return { aiExtracted: true, orderForm: null };
  }

  return {
    aiExtracted: true,
    orderForm: {
      id:                          form.id,
      orderId:                     form.order_id,
      woundVisitNumber:            form.wound_visit_number ?? null,
      chiefComplaint:              form.chief_complaint ?? null,
      hasVasculitisOrBurns:        form.has_vasculitis_or_burns ?? false,
      isReceivingHomeHealth:       form.is_receiving_home_health ?? false,
      isPatientAtSnf:              form.is_patient_at_snf ?? false,
      icd10Code:                   form.icd10_code ?? null,
      followupDays:                form.followup_days ?? null,
      woundSite:                   form.wound_site ?? null,
      woundStage:                  form.wound_stage ?? null,
      woundLengthCm:               form.wound_length_cm ?? null,
      woundWidthCm:                form.wound_width_cm ?? null,
      woundDepthCm:                form.wound_depth_cm ?? null,
      subjectiveSymptoms:          form.subjective_symptoms ?? [],
      clinicalNotes:               form.clinical_notes ?? null,
      conditionDecreasedMobility:  form.condition_decreased_mobility ?? false,
      conditionDiabetes:           form.condition_diabetes ?? false,
      conditionInfection:          form.condition_infection ?? false,
      conditionCvd:                form.condition_cvd ?? false,
      conditionCopd:               form.condition_copd ?? false,
      conditionChf:                form.condition_chf ?? false,
      conditionAnemia:             form.condition_anemia ?? false,
      useBloodThinners:            form.use_blood_thinners ?? false,
      bloodThinnerDetails:         form.blood_thinner_details ?? null,
      woundLocationSide:           (form.wound_location_side as "RT" | "LT" | "bilateral" | null) ?? null,
      granulationTissuePct:        form.granulation_tissue_pct ?? null,
      exudateAmount:               (form.exudate_amount as "none" | "minimal" | "moderate" | "heavy" | null) ?? null,
      thirdDegreeBurns:            form.third_degree_burns ?? false,
      activeVasculitis:            form.active_vasculitis ?? false,
      activeCharcot:               form.active_charcot ?? false,
      skinCondition:               (form.skin_condition as "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null) ?? null,
      wound2LengthCm:              form.wound2_length_cm ?? null,
      wound2WidthCm:               form.wound2_width_cm ?? null,
      wound2DepthCm:               form.wound2_depth_cm ?? null,
      surgicalDressingType:        form.surgical_dressing_type ?? null,
      anticipatedLengthDays:       form.anticipated_length_days ?? null,
      followupWeeks:               form.followup_weeks ?? null,
      treatmentPlan:               form.treatment_plan ?? null,
      patientName:                 form.patient_name ?? null,
      patientDate:                 form.patient_date ?? null,
      physicianSignature:          form.physician_signature ?? null,
      physicianSignatureDate:      form.physician_signature_date ?? null,
      physicianSignedAt:           form.physician_signed_at ?? null,
      physicianSignedBy:           form.physician_signed_by ?? null,
      physicianSignatureImage:     form.physician_signature_image ?? null,
      ...mapFortifyFields(form),
      aiExtracted:                 form.ai_extracted ?? false,
      aiExtractedAt:               form.ai_extracted_at ?? null,
      isLocked:                    form.is_locked ?? false,
      lockedAt:                    form.locked_at ?? null,
      lockedBy:                    form.locked_by ?? null,
      updatedAt:                   form.updated_at ?? null,
    },
  };
}

/**
 * Maps the Fortify-expansion fields (~50 columns added 2026-04-30) from
 * snake_case row shape to the camelCase IOrderForm interface. Extracted as
 * a helper so the two callers (`getOrderAiStatus` and `getOrderForm`) stay
 * in sync — adding a field in one place but not the other is a hard-to-spot
 * bug.
 */
function mapFortifyFields(
  form: Record<string, unknown>,
): Pick<
  IOrderForm,
  | "patientMrn" | "patientMbi" | "insuranceTypeLabel"
  | "anticipatedDosStart" | "anticipatedDosEnd"
  | "a1cValue" | "a1cDate" | "conditionPad" | "padDetails"
  | "conditionVenousInsufficiency" | "conditionNeuropathy"
  | "conditionImmunosuppression" | "immunosuppressionDetails"
  | "conditionMalnutrition" | "albuminValue" | "conditionSmoking"
  | "conditionRenalDisease" | "egfrValue" | "conditionOther"
  | "etiologyDfu" | "etiologyVenousStasis" | "etiologyPressureUlcer"
  | "pressureUlcerStage" | "etiologyArterial" | "etiologySurgical"
  | "etiologyTraumatic" | "etiologyOther" | "woundOnsetDate" | "woundDurationText"
  | "woundBedSloughPct" | "woundBedEscharPct" | "painLevel"
  | "infectionSignsDescribe" | "woundPhotoTaken"
  | "priorTreatments" | "advancementReason"
  | "goalOfTherapy" | "goalOfTherapyOther" | "adjunctOffloading"
  | "adjunctCompression" | "adjunctDebridement" | "adjunctOther"
  | "specialtyConsults"
  | "applicationFrequency" | "specialModifiers" | "priorAuthObtained"
  | "lcdReference" | "woundMeetsLcd" | "conservativeTxPeriodMet"
  | "qtyWithinLcdLimits" | "kxCriteriaMet" | "posEligible" | "coverageConcerns"
  | "physicianNpi" | "attestExaminedPatient" | "attestMedicallyNecessary"
  | "attestConservativeTxInadequate" | "attestFreqQtyClinicalJudgment"
  | "attestLcdSupported"
  | "surgicalQualifyingBasis" | "debridementDate" | "dateOfSurgery"
  | "cptCodes" | "procedureName" | "surgeonName" | "withinGlobalPeriod"
  | "attestNotRoutineCare" | "attestWoundMeasuredAtSurgery"
  | "dressingChangeFrequency"
  | "officeTracking"
  // ── VLU expansion (Phase 2) ──
  | "ceapClassification" | "relevantVascularHistory" | "woundSurfaceAreaCm2"
  | "periwoundStatus" | "signsActiveInfection" | "compressionTypeClass"
  | "initialWoundAreaCm2" | "currentWoundAreaCm2" | "venousStudiesFindings"
  | "arterialSupplyAdequateYn" | "arterialSupplyBasis"
  | "skinSubstituteProduct" | "skinSubstituteHcpcs"
  | "anticipatedApplicationsCount" | "applicationInterval"
  | "clinicalRationaleText"
  // ── DFU expansion (Phase 2) ──
  | "referringProvider" | "diabetesType" | "wagnerGrade" | "utStageGrade"
  | "osteomyelitisStatus" | "osteomyelitisBasis" | "depthStructuresExposed"
  | "tissueQualityBreakdown" | "infectionStatusCategory"
  | "infectionCultures" | "currentAntibiotics" | "tcpo2Value"
  | "pedalPulses" | "vascularSurgeryReferral" | "vascularSurgeryDetails"
  | "perfusionSummary" | "measuredResponse" | "dfuProcedures"
  | "plannedProcedureDate" | "procedureSetting"
  | "narrativeProgression" | "narrativeLessIntensive"
  | "narrativeLimbLoss" | "narrativePerfusion" | "additionalNarrative"
  | "physicianSpecialty" | "physicianStateLicense"
  | "placeOfService"
> {
  const priorRaw = Array.isArray(form.prior_treatments)
    ? (form.prior_treatments as Array<Record<string, unknown>>)
    : [];
  const priorTreatments = priorRaw.map((row) => ({
    treatment: typeof row.treatment === "string" ? row.treatment : "",
    datesUsed: typeof row.dates_used === "string" ? row.dates_used : "",
    outcome:   typeof row.outcome === "string" ? row.outcome : "",
  }));

  const ot =
    form.office_tracking && typeof form.office_tracking === "object"
      ? (form.office_tracking as Record<string, unknown>)
      : {};

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  return {
    patientMrn:                    (form.patient_mrn as string | null) ?? null,
    patientMbi:                    (form.patient_mbi as string | null) ?? null,
    insuranceTypeLabel:            (form.insurance_type_label as IOrderForm["insuranceTypeLabel"]) ?? null,
    anticipatedDosStart:           (form.anticipated_dos_start as string | null) ?? null,
    anticipatedDosEnd:             (form.anticipated_dos_end as string | null) ?? null,
    a1cValue:                      num(form.a1c_value),
    a1cDate:                       (form.a1c_date as string | null) ?? null,
    conditionPad:                  (form.condition_pad as boolean | null) ?? false,
    padDetails:                    (form.pad_details as string | null) ?? null,
    conditionVenousInsufficiency:  (form.condition_venous_insufficiency as boolean | null) ?? false,
    conditionNeuropathy:           (form.condition_neuropathy as boolean | null) ?? false,
    conditionImmunosuppression:    (form.condition_immunosuppression as boolean | null) ?? false,
    immunosuppressionDetails:      (form.immunosuppression_details as string | null) ?? null,
    conditionMalnutrition:         (form.condition_malnutrition as boolean | null) ?? false,
    albuminValue:                  num(form.albumin_value),
    conditionSmoking:              (form.condition_smoking as boolean | null) ?? false,
    conditionRenalDisease:         (form.condition_renal_disease as boolean | null) ?? false,
    egfrValue:                     num(form.egfr_value),
    conditionOther:                (form.condition_other as string | null) ?? null,
    etiologyDfu:                   (form.etiology_dfu as boolean | null) ?? false,
    etiologyVenousStasis:          (form.etiology_venous_stasis as boolean | null) ?? false,
    etiologyPressureUlcer:         (form.etiology_pressure_ulcer as boolean | null) ?? false,
    pressureUlcerStage:            (form.pressure_ulcer_stage as string | null) ?? null,
    etiologyArterial:              (form.etiology_arterial as boolean | null) ?? false,
    etiologySurgical:              (form.etiology_surgical as boolean | null) ?? false,
    etiologyTraumatic:             (form.etiology_traumatic as boolean | null) ?? false,
    etiologyOther:                 (form.etiology_other as string | null) ?? null,
    woundOnsetDate:                (form.wound_onset_date as string | null) ?? null,
    woundDurationText:             (form.wound_duration_text as string | null) ?? null,
    woundBedSloughPct:             num(form.wound_bed_slough_pct),
    woundBedEscharPct:             num(form.wound_bed_eschar_pct),
    painLevel:                     num(form.pain_level),
    infectionSignsDescribe:        (form.infection_signs_describe as string | null) ?? null,
    woundPhotoTaken:               (form.wound_photo_taken as boolean | null) ?? false,
    priorTreatments,
    advancementReason:             (form.advancement_reason as string | null) ?? null,
    goalOfTherapy:                 (form.goal_of_therapy as IOrderForm["goalOfTherapy"]) ?? null,
    goalOfTherapyOther:            (form.goal_of_therapy_other as string | null) ?? null,
    adjunctOffloading:             (form.adjunct_offloading as boolean | null) ?? false,
    adjunctCompression:            (form.adjunct_compression as boolean | null) ?? false,
    adjunctDebridement:            (form.adjunct_debridement as boolean | null) ?? false,
    adjunctOther:                  (form.adjunct_other as string | null) ?? null,
    specialtyConsults:             (form.specialty_consults as string | null) ?? null,
    applicationFrequency:          (form.application_frequency as string | null) ?? null,
    specialModifiers:              (form.special_modifiers as string | null) ?? null,
    priorAuthObtained:             (form.prior_auth_obtained as boolean | null) ?? false,
    lcdReference:                  (form.lcd_reference as string | null) ?? null,
    woundMeetsLcd:                 (form.wound_meets_lcd as boolean | null) ?? null,
    conservativeTxPeriodMet:       (form.conservative_tx_period_met as boolean | null) ?? null,
    qtyWithinLcdLimits:            (form.qty_within_lcd_limits as boolean | null) ?? null,
    kxCriteriaMet:                 (form.kx_criteria_met as IOrderForm["kxCriteriaMet"]) ?? null,
    posEligible:                   (form.pos_eligible as boolean | null) ?? null,
    coverageConcerns:              (form.coverage_concerns as string | null) ?? null,
    physicianNpi:                  (form.physician_npi as string | null) ?? null,
    attestExaminedPatient:           (form.attest_examined_patient as boolean | null) ?? false,
    attestMedicallyNecessary:        (form.attest_medically_necessary as boolean | null) ?? false,
    attestConservativeTxInadequate:  (form.attest_conservative_tx_inadequate as boolean | null) ?? false,
    attestFreqQtyClinicalJudgment:   (form.attest_freq_qty_clinical_judgment as boolean | null) ?? false,
    attestLcdSupported:              (form.attest_lcd_supported as boolean | null) ?? false,
    surgicalQualifyingBasis:        (form.surgical_qualifying_basis as IOrderForm["surgicalQualifyingBasis"]) ?? null,
    debridementDate:                (form.debridement_date as string | null) ?? null,
    dateOfSurgery:                  (form.date_of_surgery as string | null) ?? null,
    cptCodes:                       (form.cpt_codes as string | null) ?? null,
    procedureName:                  (form.procedure_name as string | null) ?? null,
    surgeonName:                    (form.surgeon_name as string | null) ?? null,
    withinGlobalPeriod:             (form.within_global_period as boolean | null) ?? null,
    attestNotRoutineCare:           (form.attest_not_routine_care as boolean | null) ?? false,
    attestWoundMeasuredAtSurgery:   (form.attest_wound_measured_at_surgery as boolean | null) ?? false,
    dressingChangeFrequency:        (form.dressing_change_frequency as IOrderForm["dressingChangeFrequency"]) ?? null,
    // ── VLU mapping (Phase 2) ──
    ceapClassification:             (form.ceap_classification as string | null) ?? null,
    relevantVascularHistory:        (form.relevant_vascular_history as string | null) ?? null,
    woundSurfaceAreaCm2:            num(form.wound_surface_area_cm2),
    periwoundStatus:                (form.periwound_status as string | null) ?? null,
    signsActiveInfection:           (form.signs_active_infection as string | null) ?? null,
    compressionTypeClass:           (form.compression_type_class as string | null) ?? null,
    initialWoundAreaCm2:            num(form.initial_wound_area_cm2),
    currentWoundAreaCm2:            num(form.current_wound_area_cm2),
    venousStudiesFindings:          (form.venous_studies_findings as string | null) ?? null,
    arterialSupplyAdequateYn:       (form.arterial_supply_adequate_yn as boolean | null) ?? null,
    arterialSupplyBasis:            (form.arterial_supply_basis as string | null) ?? null,
    skinSubstituteProduct:          (form.skin_substitute_product as string | null) ?? null,
    skinSubstituteHcpcs:            (form.skin_substitute_hcpcs as string | null) ?? null,
    anticipatedApplicationsCount:   num(form.anticipated_applications_count),
    applicationInterval:            (form.application_interval as string | null) ?? null,
    clinicalRationaleText:          (form.clinical_rationale_text as string | null) ?? null,
    // ── DFU mapping (Phase 2) ──
    referringProvider:              (form.referring_provider as string | null) ?? null,
    diabetesType:                   (form.diabetes_type as IOrderForm["diabetesType"]) ?? null,
    wagnerGrade:                    num(form.wagner_grade),
    utStageGrade:                   (form.ut_stage_grade as string | null) ?? null,
    osteomyelitisStatus:            (form.osteomyelitis_status as IOrderForm["osteomyelitisStatus"]) ?? null,
    osteomyelitisBasis:             (form.osteomyelitis_basis as string | null) ?? null,
    depthStructuresExposed:         (form.depth_structures_exposed as string | null) ?? null,
    tissueQualityBreakdown:
      form.tissue_quality_breakdown && typeof form.tissue_quality_breakdown === "object"
        ? (form.tissue_quality_breakdown as IOrderForm["tissueQualityBreakdown"])
        : null,
    infectionStatusCategory:        (form.infection_status_category as IOrderForm["infectionStatusCategory"]) ?? null,
    infectionCultures:              (form.infection_cultures as string | null) ?? null,
    currentAntibiotics:             (form.current_antibiotics as string | null) ?? null,
    tcpo2Value:                     num(form.tcpo2_value),
    pedalPulses:                    (form.pedal_pulses as string | null) ?? null,
    vascularSurgeryReferral:        (form.vascular_surgery_referral as boolean | null) ?? null,
    vascularSurgeryDetails:         (form.vascular_surgery_details as string | null) ?? null,
    perfusionSummary:               (form.perfusion_summary as string | null) ?? null,
    measuredResponse:               (form.measured_response as string | null) ?? null,
    dfuProcedures: Array.isArray(form.dfu_procedures)
      ? (form.dfu_procedures as IOrderForm["dfuProcedures"])
      : null,
    plannedProcedureDate:           (form.planned_procedure_date as string | null) ?? null,
    procedureSetting:               (form.procedure_setting as IOrderForm["procedureSetting"]) ?? null,
    narrativeProgression:
      form.narrative_progression && typeof form.narrative_progression === "object"
        ? (form.narrative_progression as IOrderForm["narrativeProgression"])
        : null,
    narrativeLessIntensive:
      form.narrative_less_intensive && typeof form.narrative_less_intensive === "object"
        ? (form.narrative_less_intensive as IOrderForm["narrativeLessIntensive"])
        : null,
    narrativeLimbLoss:
      form.narrative_limb_loss && typeof form.narrative_limb_loss === "object"
        ? (form.narrative_limb_loss as IOrderForm["narrativeLimbLoss"])
        : null,
    narrativePerfusion:
      form.narrative_perfusion && typeof form.narrative_perfusion === "object"
        ? (form.narrative_perfusion as IOrderForm["narrativePerfusion"])
        : null,
    additionalNarrative:            (form.additional_narrative as string | null) ?? null,
    physicianSpecialty:             (form.physician_specialty as string | null) ?? null,
    physicianStateLicense:          (form.physician_state_license as string | null) ?? null,
    placeOfService:                 (form.place_of_service as string | null) ?? null,
    officeTracking: {
      methodOfReceipt:          (ot.method_of_receipt as string | null) ?? null,
      baaInPlace:               (ot.baa_in_place as boolean | null) ?? null,
      reviewedBy:               (ot.reviewed_by as string | null) ?? null,
      documentationComplete:    (ot.documentation_complete as boolean | null) ?? null,
      gapsIdentified:           (ot.gaps_identified as string | null) ?? null,
      gapsCommunicatedAt:       (ot.gaps_communicated_at as string | null) ?? null,
      gapsResolvedAt:           (ot.gaps_resolved_at as string | null) ?? null,
      releasedToFulfillment:    (ot.released_to_fulfillment as boolean | null) ?? null,
      releasedToFulfillmentAt:  (ot.released_to_fulfillment_at as string | null) ?? null,
      filedInRepository:        (ot.filed_in_repository as boolean | null) ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* getOrderForm — lean re-fetch used by collaborative-edit reload flow         */
/* -------------------------------------------------------------------------- */

export async function getOrderForm(
  orderId: string,
): Promise<IOrderForm | null> {
  try {
    await requireOrderAccess(orderId);
    const adminClient = createAdminClient();

    const { data: form } = await adminClient
      .from("order_form")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!form) return null;

    return {
      id:                          form.id,
      orderId:                     form.order_id,
      woundVisitNumber:            form.wound_visit_number ?? null,
      chiefComplaint:              form.chief_complaint ?? null,
      hasVasculitisOrBurns:        form.has_vasculitis_or_burns ?? false,
      isReceivingHomeHealth:       form.is_receiving_home_health ?? false,
      isPatientAtSnf:              form.is_patient_at_snf ?? false,
      icd10Code:                   form.icd10_code ?? null,
      followupDays:                form.followup_days ?? null,
      woundSite:                   form.wound_site ?? null,
      woundStage:                  form.wound_stage ?? null,
      woundLengthCm:               form.wound_length_cm ?? null,
      woundWidthCm:                form.wound_width_cm ?? null,
      woundDepthCm:                form.wound_depth_cm ?? null,
      subjectiveSymptoms:          form.subjective_symptoms ?? [],
      clinicalNotes:               form.clinical_notes ?? null,
      conditionDecreasedMobility:  form.condition_decreased_mobility ?? false,
      conditionDiabetes:           form.condition_diabetes ?? false,
      conditionInfection:          form.condition_infection ?? false,
      conditionCvd:                form.condition_cvd ?? false,
      conditionCopd:               form.condition_copd ?? false,
      conditionChf:                form.condition_chf ?? false,
      conditionAnemia:             form.condition_anemia ?? false,
      useBloodThinners:            form.use_blood_thinners ?? false,
      bloodThinnerDetails:         form.blood_thinner_details ?? null,
      woundLocationSide:           (form.wound_location_side as "RT" | "LT" | "bilateral" | null) ?? null,
      granulationTissuePct:        form.granulation_tissue_pct ?? null,
      exudateAmount:               (form.exudate_amount as "none" | "minimal" | "moderate" | "heavy" | null) ?? null,
      thirdDegreeBurns:            form.third_degree_burns ?? false,
      activeVasculitis:            form.active_vasculitis ?? false,
      activeCharcot:               form.active_charcot ?? false,
      skinCondition:               (form.skin_condition as "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null) ?? null,
      wound2LengthCm:              form.wound2_length_cm ?? null,
      wound2WidthCm:               form.wound2_width_cm ?? null,
      wound2DepthCm:               form.wound2_depth_cm ?? null,
      surgicalDressingType:        form.surgical_dressing_type ?? null,
      anticipatedLengthDays:       form.anticipated_length_days ?? null,
      followupWeeks:               form.followup_weeks ?? null,
      treatmentPlan:               form.treatment_plan ?? null,
      patientName:                 form.patient_name ?? null,
      patientDate:                 form.patient_date ?? null,
      physicianSignature:          form.physician_signature ?? null,
      physicianSignatureDate:      form.physician_signature_date ?? null,
      physicianSignedAt:           form.physician_signed_at ?? null,
      physicianSignedBy:           form.physician_signed_by ?? null,
      physicianSignatureImage:     form.physician_signature_image ?? null,
      ...mapFortifyFields(form),
      aiExtracted:                 form.ai_extracted ?? false,
      aiExtractedAt:               form.ai_extracted_at ?? null,
      isLocked:                    form.is_locked ?? false,
      lockedAt:                    form.locked_at ?? null,
      lockedBy:                    form.locked_by ?? null,
      updatedAt:                   form.updated_at ?? null,
    };
  } catch (err) {
    safeLogError("getOrderForm", err, { orderId });
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* switchIvrMode                                                              */
/*                                                                            */
/* Toggle the IVR source between the in-portal built form and an externally   */
/* uploaded document. Wipes the opposite-mode data so there's a single        */
/* source of truth at any time.                                               */
/*                                                                            */
/* Status gate: blocked once order_status reaches manufacturer_review or      */
/* beyond — at that point the IVR (whichever shape) is already in the         */
/* manufacturer's queue and editing it would invalidate downstream work.      */
/* -------------------------------------------------------------------------- */

const IVR_MODE_LOCKED_STATUSES = new Set([
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
  "canceled",
]);

/** Snake_case columns that hold the built-IVR form data — wiped to NULL
 *  when switching from "built" → "uploaded". The structural ID, order
 *  link, ai_extracted flag, and audit columns stay untouched. */
const BUILT_IVR_DATA_COLUMNS: string[] = [
  // Primary insurance
  "insurance_provider", "insurance_phone", "member_id", "group_number",
  "plan_name", "plan_type", "subscriber_name", "subscriber_dob",
  "subscriber_relationship", "coverage_start_date", "coverage_end_date",
  "deductible_amount", "deductible_met", "out_of_pocket_max",
  "out_of_pocket_met", "copay_amount", "coinsurance_percent",
  "dme_covered", "wound_care_covered",
  "prior_auth_required", "prior_auth_number", "prior_auth_start_date",
  "prior_auth_end_date", "units_authorized",
  "verified_by", "verified_date", "verification_reference", "notes",
  // Place / MAC / extra physician/patient context
  "place_of_service", "medicare_admin_contractor",
  "facility_npi", "facility_tin", "facility_ptan", "facility_fax",
  "physician_tin", "physician_fax", "physician_address",
  "patient_phone", "patient_address", "ok_to_contact_patient",
  // Secondary insurance + provider participation
  "provider_participates_primary", "provider_participates_secondary",
  "secondary_insurance_provider", "secondary_insurance_phone",
  "secondary_subscriber_name", "secondary_policy_number",
  "secondary_subscriber_dob", "secondary_plan_type",
  "secondary_group_number", "secondary_subscriber_relationship",
  // CPTs + global period
  "application_cpts", "surgical_global_period", "global_period_cpt",
  "prior_auth_permission",
  // Facility / rep / clinical context
  "specialty_site_name", "facility_name", "facility_address",
  "facility_phone", "facility_contact",
  "physician_name", "physician_phone", "physician_npi",
  "patient_name", "patient_dob", "sales_rep_name",
  "wound_type", "wound_sizes", "date_of_procedure", "icd10_codes",
  "product_information", "is_patient_at_snf",
  // Signature
  "physician_signature", "physician_signature_date",
  "physician_signed_at", "physician_signed_by", "physician_signature_image",
];

export async function switchIvrMode(
  orderId: string,
  newMode: "built" | "uploaded",
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

    // Status gate — block switching once the order is at manufacturer review
    // or beyond. UI also enforces this but server is the boundary.
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return { success: false, error: "Order not found." };
    }
    if (IVR_MODE_LOCKED_STATUSES.has(order.order_status as string)) {
      return {
        success: false,
        error:
          "IVR mode can no longer be changed — order is under manufacturer review or beyond.",
      };
    }

    // Whichever direction we go, the in-portal IVR form data changes
    // (wiped on → uploaded; freshly reset on → built). Regenerate the
    // system-generated IVR PDF (document_type=additional_ivr) so the
    // sidebar "IVR Form" chip and any downstream consumer see the
    // current portal state instead of a stale snapshot from before the
    // switch. Fire-and-forget — pdf gen takes seconds and we don't want
    // to block the user response on it.
    const regenAfter = () =>
      generateOrderPDFs(orderId, ["ivr"]).catch((err) =>
        safeLogError("switchIvrMode", err, {
          phase: "post-switch PDF regen",
          orderId,
          newMode,
        }),
      );

    if (newMode === "uploaded") {
      // Wipe built-IVR data so the existing form-state column values don't
      // bleed into a future "switched back to built" path. Sets every form
      // column to NULL via an upsert on order_id. NOTE: order_ivr does NOT
      // have an `is_locked` column (unlike order_form) — the IVR's locked
      // state is derived from physician_signed_at being non-null, which we
      // null out below as part of the data wipe.
      const wipePayload: Record<string, unknown> = {
        order_id: orderId,
        ivr_mode: "uploaded",
        ai_extracted: false,
        ai_extracted_at: null,
      };
      for (const col of BUILT_IVR_DATA_COLUMNS) wipePayload[col] = null;
      const { error: wipeErr } = await adminClient
        .from("order_ivr")
        .upsert(wipePayload, { onConflict: "order_id" });
      if (wipeErr) {
        safeLogError("switchIvrMode", wipeErr, { phase: "wipe-to-uploaded", orderId });
        return { success: false, error: "Failed to switch IVR mode." };
      }
    } else {
      // Switching back to built — delete any uploaded IVR documents so the
      // user can't accidentally have both a half-filled form AND a stale
      // upload. Single source of truth.
      const { error: delErr } = await adminClient
        .from("order_documents")
        .delete()
        .eq("order_id", orderId)
        .eq("document_type", "uploaded_ivr");
      if (delErr) {
        safeLogError("switchIvrMode", delErr, { phase: "delete-uploads", orderId });
        return { success: false, error: "Failed to switch IVR mode." };
      }
      const { error: modeErr } = await adminClient
        .from("order_ivr")
        .upsert(
          {
            order_id: orderId,
            ivr_mode: "built",
          },
          { onConflict: "order_id" },
        );
      if (modeErr) {
        safeLogError("switchIvrMode", modeErr, { phase: "set-built", orderId });
        return { success: false, error: "Failed to switch IVR mode." };
      }
    }

    regenAfter();
    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    safeLogError("switchIvrMode", err, { orderId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* markIvrUploadedComplete                                                    */
/*                                                                            */
/* Equivalent of "Sign" for the uploaded-IVR path. Requires at least one      */
/* uploaded_ivr document to be present. Locks the IVR row and stamps the      */
/* signed_at/by columns so the audit trail is comparable to the built path.   */
/* -------------------------------------------------------------------------- */

export async function markIvrUploadedComplete(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireIVREditRole();
    const adminClient = createAdminClient();

    // Confirm there's an uploaded IVR document. Otherwise "complete" is
    // meaningless.
    const { count, error: countErr } = await adminClient
      .from("order_documents")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .eq("document_type", "additional_ivr");
    if (countErr) {
      safeLogError("markIvrUploadedComplete", countErr, { phase: "count", orderId });
      return { success: false, error: "Failed to verify upload." };
    }
    if (!count || count === 0) {
      return {
        success: false,
        error: "Upload a completed IVR document before marking complete.",
      };
    }

    const nowIso = new Date().toISOString();
    // Stamp physician_signed_at/by — that's the IVR's lock indicator
    // (order_ivr has no is_locked column, only physician_signed_at).
    const { error: lockErr } = await adminClient
      .from("order_ivr")
      .upsert(
        {
          order_id: orderId,
          ivr_mode: "uploaded",
          physician_signed_at: nowIso,
          physician_signed_by: userId,
        },
        { onConflict: "order_id" },
      );
    if (lockErr) {
      safeLogError("markIvrUploadedComplete", lockErr, { phase: "lock", orderId });
      return { success: false, error: "Failed to mark IVR complete." };
    }

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    safeLogError("markIvrUploadedComplete", err, { orderId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
