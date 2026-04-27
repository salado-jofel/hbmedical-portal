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
      drainageDescription:         form.drainage_description ?? null,
      treatmentPlan:               form.treatment_plan ?? null,
      patientName:                 form.patient_name ?? null,
      patientDate:                 form.patient_date ?? null,
      physicianSignature:          form.physician_signature ?? null,
      physicianSignatureDate:      form.physician_signature_date ?? null,
      physicianSignedAt:           form.physician_signed_at ?? null,
      physicianSignedBy:           form.physician_signed_by ?? null,
      physicianSignatureImage:     form.physician_signature_image ?? null,
      aiExtracted:                 form.ai_extracted ?? false,
      aiExtractedAt:               form.ai_extracted_at ?? null,
      isLocked:                    form.is_locked ?? false,
      lockedAt:                    form.locked_at ?? null,
      lockedBy:                    form.locked_by ?? null,
      updatedAt:                   form.updated_at ?? null,
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
      drainageDescription:         form.drainage_description ?? null,
      treatmentPlan:               form.treatment_plan ?? null,
      patientName:                 form.patient_name ?? null,
      patientDate:                 form.patient_date ?? null,
      physicianSignature:          form.physician_signature ?? null,
      physicianSignatureDate:      form.physician_signature_date ?? null,
      physicianSignedAt:           form.physician_signed_at ?? null,
      physicianSignedBy:           form.physician_signed_by ?? null,
      physicianSignatureImage:     form.physician_signature_image ?? null,
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
