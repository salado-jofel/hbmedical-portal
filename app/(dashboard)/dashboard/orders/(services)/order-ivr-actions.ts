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

export async function getOrderIVR(
  orderId: string,
): Promise<IOrderIVR | null> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("order_ivr")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[getOrderIVR]", JSON.stringify(error));
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      orderId: data.order_id,
      insuranceProvider: data.insurance_provider,
      insurancePhone: data.insurance_phone,
      memberId: data.member_id,
      groupNumber: data.group_number,
      planName: data.plan_name,
      planType: data.plan_type,
      subscriberName: data.subscriber_name,
      subscriberDob: data.subscriber_dob,
      subscriberRelationship: data.subscriber_relationship,
      coverageStartDate: data.coverage_start_date,
      coverageEndDate: data.coverage_end_date,
      deductibleAmount: data.deductible_amount != null ? Number(data.deductible_amount) : null,
      deductibleMet: data.deductible_met != null ? Number(data.deductible_met) : null,
      outOfPocketMax: data.out_of_pocket_max != null ? Number(data.out_of_pocket_max) : null,
      outOfPocketMet: data.out_of_pocket_met != null ? Number(data.out_of_pocket_met) : null,
      copayAmount: data.copay_amount != null ? Number(data.copay_amount) : null,
      coinsurancePercent: data.coinsurance_percent != null ? Number(data.coinsurance_percent) : null,
      dmeCovered: data.dme_covered ?? false,
      woundCareCovered: data.wound_care_covered ?? false,
      priorAuthRequired: data.prior_auth_required ?? false,
      priorAuthNumber: data.prior_auth_number,
      priorAuthStartDate: data.prior_auth_start_date,
      priorAuthEndDate: data.prior_auth_end_date,
      unitsAuthorized: data.units_authorized,
      verifiedBy: data.verified_by,
      verifiedDate: data.verified_date,
      verificationReference: data.verification_reference,
      notes: data.notes,
      aiExtracted: data.ai_extracted ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("[getOrderIVR] unexpected:", err);
    return null;
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
