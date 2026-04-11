"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import type { IOrderIVR, IOrderForm } from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  requireIVREditRole,
  generateOrderPDFs,
  triggerAiExtraction,
} from "./_shared";

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
    aiExtracted:                 (data.ai_extracted as boolean) ?? false,
    createdAt:                   data.created_at as string,
    updatedAt:                   data.updated_at as string,
  };
}

export async function getOrderIVR(
  orderId: string,
): Promise<{ ivr: IOrderIVR | null; physicianName: string | null }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();

    // Fetch IVR record and order context in parallel
    const [ivrRes, orderCtxRes] = await Promise.all([
      adminClient.from("order_ivr").select("*").eq("order_id", orderId).maybeSingle(),
      adminClient
        .from("orders")
        .select(`
          assigned_provider_id, created_by,
          facilities!orders_facility_id_fkey(name, address_line_1, phone, contact),
          patients!orders_patient_id_fkey(first_name, last_name, date_of_birth)
        `)
        .eq("id", orderId)
        .single(),
    ]);

    if (ivrRes.error) {
      console.error("[getOrderIVR]", JSON.stringify(ivrRes.error));
      return { ivr: null, physicianName: null };
    }

    const orderCtx = orderCtxRes.data;

    // Resolve facility from join
    const facilityRaw = orderCtx?.facilities as unknown;
    const facility = (Array.isArray(facilityRaw) ? facilityRaw[0] : facilityRaw) as
      | { name: string; address_line_1: string | null; phone: string | null; contact: string | null }
      | null | undefined;

    // Resolve patient from join
    const patientRaw = orderCtx?.patients as unknown;
    const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
      | { first_name: string; last_name: string; date_of_birth: string | null }
      | null | undefined;
    const resolvedPatientName = patient?.first_name
      ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
      : null;

    // Resolve physician name: assigned_provider_id → created_by fallback
    let physicianName: string | null = null;
    try {
      const providerId = orderCtx?.assigned_provider_id || orderCtx?.created_by;
      if (providerId) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", providerId)
          .maybeSingle();
        if (profile) {
          physicianName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;
        }
      }
    } catch {
      // Non-fatal
    }

    let data = ivrRes.data;

    // Auto-initialize a new IVR record pre-populated from source tables (Fix 5)
    if (!data) {
      await adminClient.from("order_ivr").upsert(
        {
          order_id:         orderId,
          place_of_service: "office",
          subscriber_name:  resolvedPatientName,
          // Override columns pre-populated from source tables
          facility_name:    facility?.name ?? null,
          facility_address: facility?.address_line_1 ?? null,
          facility_phone:   facility?.phone ?? null,
          facility_contact: facility?.contact ?? null,
          physician_name:   physicianName,
          patient_name:     resolvedPatientName,
          patient_dob:      patient?.date_of_birth ?? null,
        },
        { onConflict: "order_id" },
      );

      const { data: created } = await adminClient
        .from("order_ivr").select("*").eq("order_id", orderId).single();
      data = created;
    }

    if (!data) return { ivr: null, physicianName };

    const ivrData = mapIvrRow(data as Record<string, unknown>);

    // Fix 2: Apply source table fallback for null override fields
    if (!ivrData.facilityName)    ivrData.facilityName    = facility?.name    ?? null;
    if (!ivrData.facilityAddress) ivrData.facilityAddress = facility?.address_line_1 ?? null;
    if (!ivrData.facilityPhone)   ivrData.facilityPhone   = facility?.phone   ?? null;
    if (!ivrData.facilityContact) ivrData.facilityContact = facility?.contact  ?? null;
    if (!ivrData.physicianName)   ivrData.physicianName   = physicianName;
    if (!ivrData.patientName)     ivrData.patientName     = resolvedPatientName;
    if (!ivrData.patientDob)      ivrData.patientDob      = patient?.date_of_birth ?? null;

    return { ivr: ivrData, physicianName };
  } catch (err) {
    console.error("[getOrderIVR] unexpected:", err);
    return { ivr: null, physicianName: null };
  }
}

/* -------------------------------------------------------------------------- */
/* upsertOrderIVR                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertOrderIVR(
  orderId: string,
  data: Partial<IOrderIVR>,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireIVREditRole();
    const adminClient = createAdminClient();

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

    const { error } = await adminClient
      .from("order_ivr")
      .upsert(payload, { onConflict: "order_id" });

    if (error) {
      console.error("[upsertOrderIVR]", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save IVR." };
    }

    revalidatePath(ORDERS_PATH);

    generateOrderPDFs(orderId, ["ivr"]).catch(
      err => console.error("[IVR PDF]", err),
    );

    return { success: true, error: null };
  } catch (err) {
    console.error("[upsertOrderIVR] unexpected:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getOrderAiStatus                                                            */
/* -------------------------------------------------------------------------- */

export async function getOrderAiStatus(
  orderId: string,
): Promise<{ aiExtracted: boolean; orderForm: IOrderForm | null }> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

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
      aiExtracted:                 form.ai_extracted ?? false,
      aiExtractedAt:               form.ai_extracted_at ?? null,
      isLocked:                    form.is_locked ?? false,
      lockedAt:                    form.locked_at ?? null,
      lockedBy:                    form.locked_by ?? null,
    },
  };
}
