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
    let { data, error } = await adminClient
      .from("order_ivr")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[getOrderIVR]", JSON.stringify(error));
      return { ivr: null, physicianName: null };
    }

    // Auto-initialize a new IVR record with sensible defaults
    if (!data) {
      // Fetch patient name from the order (for subscriber_name default)
      const { data: orderRow } = await adminClient
        .from("orders")
        .select("patient_id, patients(first_name, last_name)")
        .eq("id", orderId)
        .single();

      const patientRow = orderRow?.patients as unknown;
      const patient = (
        Array.isArray(patientRow) ? patientRow[0] : patientRow
      ) as { first_name: string; last_name: string } | null | undefined;
      const patientName = patient?.first_name
        ? `${patient.first_name} ${patient.last_name ?? ""}`.trim()
        : null;

      await adminClient
        .from("order_ivr")
        .upsert(
          {
            order_id:        orderId,
            place_of_service: "office",
            subscriber_name:  patientName,
          },
          { onConflict: "order_id" },
        );

      const { data: created } = await adminClient
        .from("order_ivr")
        .select("*")
        .eq("order_id", orderId)
        .single();

      data = created;
    }

    if (!data) return { ivr: null, physicianName: null };

    // Resolve physician name: assigned_provider_id → created_by fallback
    let physicianName: string | null = null;
    try {
      const { data: orderCtx } = await adminClient
        .from("orders")
        .select("assigned_provider_id, created_by")
        .eq("id", orderId)
        .single();
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
      // Non-fatal — physician name stays null
    }

    return { ivr: mapIvrRow(data as Record<string, unknown>), physicianName };
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
      id:                    form.id,
      orderId:               form.order_id,
      woundVisitNumber:      form.wound_visit_number ?? null,
      chiefComplaint:        form.chief_complaint ?? null,
      hasVasculitisOrBurns:  form.has_vasculitis_or_burns ?? false,
      isReceivingHomeHealth: form.is_receiving_home_health ?? false,
      isPatientAtSnf:        form.is_patient_at_snf ?? false,
      icd10Code:             form.icd10_code ?? null,
      followupDays:          form.followup_days ?? null,
      woundSite:             form.wound_site ?? null,
      woundStage:            form.wound_stage ?? null,
      woundLengthCm:         form.wound_length_cm ?? null,
      woundWidthCm:          form.wound_width_cm ?? null,
      woundDepthCm:          form.wound_depth_cm ?? null,
      subjectiveSymptoms:    form.subjective_symptoms ?? [],
      clinicalNotes:         form.clinical_notes ?? null,
      aiExtracted:           form.ai_extracted ?? false,
      aiExtractedAt:         form.ai_extracted_at ?? null,
      isLocked:              form.is_locked ?? false,
      lockedAt:              form.locked_at ?? null,
      lockedBy:              form.locked_by ?? null,
    },
  };
}
