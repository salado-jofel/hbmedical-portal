// ── GOOGLE GEMINI (active for testing — free tier) ────────────────────────
import { createGoogleGenerativeAI } from "@ai-sdk/google";
const aiModel = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ── ANTHROPIC CLAUDE (commented out — restore when ready) ─────────────────
// import { createAnthropic } from "@ai-sdk/anthropic";
// const aiModel = createAnthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/* ── Field sanitizers ── */

const ORDER_FORM_ALLOWED_FIELDS = new Set([
  "wound_visit_number",
  "chief_complaint",
  "has_vasculitis_or_burns",
  "is_receiving_home_health",
  "is_patient_at_snf",
  "icd10_code",
  "followup_days",
  "wound_site",
  "wound_stage",
  "wound_length_cm",
  "wound_width_cm",
  "wound_depth_cm",
  "subjective_symptoms",
  "clinical_notes",
  // Medical conditions
  "condition_decreased_mobility",
  "condition_diabetes",
  "condition_infection",
  "condition_cvd",
  "condition_copd",
  "condition_chf",
  "condition_anemia",
  // Blood thinners
  "use_blood_thinners",
  "blood_thinner_details",
  // Wound details
  "wound_location_side",
  "granulation_tissue_pct",
  "exudate_amount",
  "third_degree_burns",
  "active_vasculitis",
  "active_charcot",
  "skin_condition",
  // Second wound
  "wound2_length_cm",
  "wound2_width_cm",
  "wound2_depth_cm",
  // Treatment
  "drainage_description",
  "treatment_plan",
]);

const ORDER_FORM_FIELD_ALIASES: Record<string, string> = {
  is_receiving_health: "is_receiving_home_health",
  receiving_home_health: "is_receiving_home_health",
  home_health: "is_receiving_home_health",
  is_home_health: "is_receiving_home_health",
  vasculitis_or_burns: "has_vasculitis_or_burns",
  has_vasculitis: "has_vasculitis_or_burns",
  vasculitis: "has_vasculitis_or_burns",
  patient_at_snf: "is_patient_at_snf",
  snf: "is_patient_at_snf",
  icd10: "icd10_code",
  icd_10_code: "icd10_code",
  icd_10: "icd10_code",
  diagnosis_code: "icd10_code",
  followup: "followup_days",
  follow_up_days: "followup_days",
  follow_up: "followup_days",
  visit_number: "wound_visit_number",
  wound_visit: "wound_visit_number",
  wound_length: "wound_length_cm",
  wound_width: "wound_width_cm",
  wound_depth: "wound_depth_cm",
  length_cm: "wound_length_cm",
  width_cm: "wound_width_cm",
  depth_cm: "wound_depth_cm",
  symptoms: "subjective_symptoms",
  notes: "clinical_notes",
  complaint: "chief_complaint",
  // Medical condition aliases
  decreased_mobility: "condition_decreased_mobility",
  diabetes: "condition_diabetes",
  infection: "condition_infection",
  cardiovascular_disease: "condition_cvd",
  copd: "condition_copd",
  chf: "condition_chf",
  anemia: "condition_anemia",
  // Blood thinner aliases
  blood_thinners: "use_blood_thinners",
  on_blood_thinners: "use_blood_thinners",
  blood_thinner_medications: "blood_thinner_details",
  // Wound detail aliases
  wound_side: "wound_location_side",
  laterality: "wound_location_side",
  granulation_pct: "granulation_tissue_pct",
  granulation_percentage: "granulation_tissue_pct",
  exudate: "exudate_amount",
  drainage_amount: "exudate_amount",
  burns_third_degree: "third_degree_burns",
  charcot: "active_charcot",
  periwound_skin: "skin_condition",
  skin_type: "skin_condition",
  // Second wound aliases
  wound2_length: "wound2_length_cm",
  wound2_width: "wound2_width_cm",
  wound2_depth: "wound2_depth_cm",
  // Treatment aliases
  drainage: "drainage_description",
  wound_drainage: "drainage_description",
  plan: "treatment_plan",
  dressing_plan: "treatment_plan",
};

function sanitizeOrderFormFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_FORM_FIELD_ALIASES[key] ?? key;
    if (ORDER_FORM_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    } else {
      console.warn(
        `[extract-document] Unknown order_form field ignored: ${key}`,
      );
    }
  }
  return sanitized;
}

const ORDER_FORM_1500_ALLOWED_FIELDS = new Set([
  "insurance_type",
  "insured_id_number",
  "patient_last_name",
  "patient_first_name",
  "patient_middle_initial",
  "patient_dob",
  "patient_sex",
  "insured_last_name",
  "insured_first_name",
  "insured_middle_initial",
  "patient_address",
  "patient_city",
  "patient_state",
  "patient_zip",
  "patient_phone",
  "patient_relationship",
  "insured_address",
  "insured_city",
  "insured_state",
  "insured_zip",
  "insured_phone",
  "insured_policy_group",
  "insured_dob",
  "insured_sex",
  "insured_employer",
  "insured_plan_name",
  "another_health_benefit",
  "accept_assignment",
  "federal_tax_id",
  "patient_account_number",
  "billing_provider_name",
  "billing_provider_address",
  "billing_provider_phone",
  "billing_provider_npi",
  // Diagnosis codes (box 21 on CMS-1500) — populated from order_form.icd10_code + clinical context
  "diagnosis_a",
  "diagnosis_b",
  "diagnosis_c",
  "diagnosis_d",
  "diagnosis_e",
  "diagnosis_f",
  "diagnosis_g",
  "diagnosis_h",
  "diagnosis_i",
  "diagnosis_j",
  "diagnosis_k",
  "diagnosis_l",
]);

const ORDER_FORM_1500_ALIASES: Record<string, string> = {
  patient_date_of_birth: "patient_dob",
  date_of_birth: "patient_dob",
  dob: "patient_dob",
  gender: "patient_sex",
  sex: "patient_sex",
  insurance: "insurance_type",
  plan_type: "insurance_type",
  member_id: "insured_id_number",
  policy_number: "insured_id_number",
  subscriber_id: "insured_id_number",
  group_number: "insured_policy_group",
  group_no: "insured_policy_group",
  plan_name: "insured_plan_name",
  employer: "insured_employer",
  relationship: "patient_relationship",
  patient_rel: "patient_relationship",
};

function sanitizeForm1500Fields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_FORM_1500_ALIASES[key] ?? key;
    if (ORDER_FORM_1500_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    } else {
      console.warn(
        `[extract-document] Unknown order_form_1500 field ignored: ${key}`,
      );
    }
  }
  return sanitized;
}

const ORDER_IVR_ALLOWED_FIELDS = new Set([
  // Primary insurance
  "insurance_provider",
  "insurance_phone",
  "member_id",
  "group_number",
  "plan_name",
  "plan_type",
  "subscriber_name",
  "subscriber_dob",
  "subscriber_relationship",
  "coverage_start_date",
  "coverage_end_date",
  // Patient context (facesheet-extractable)
  "patient_phone",
  "patient_address",
  // Secondary insurance
  "secondary_insurance_provider",
  "secondary_insurance_phone",
  "secondary_subscriber_name",
  "secondary_policy_number",
  "secondary_subscriber_dob",
  "secondary_plan_type",
  "secondary_group_number",
  "secondary_subscriber_relationship",
]);

const ORDER_IVR_ALIASES: Record<string, string> = {
  insured_plan_name:    "plan_name",
  insured_id_number:    "member_id",
  insured_policy_group: "group_number",
  insurance_name:       "insurance_provider",
  insured_dob:          "subscriber_dob",
  patient_relationship: "subscriber_relationship",
};

function sanitizeIvrFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // Combine insured_first_name + insured_last_name → subscriber_name (single text column)
  const firstName = raw.insured_first_name as string | undefined;
  const lastName  = raw.insured_last_name  as string | undefined;
  const working: Record<string, unknown> = { ...raw };
  if (firstName || lastName) {
    const full = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (full) working.subscriber_name = full;
  }
  delete working.insured_first_name;
  delete working.insured_last_name;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(working)) {
    if (value === null || value === undefined) continue;
    const mappedKey = ORDER_IVR_ALIASES[key] ?? key;
    if (ORDER_IVR_ALLOWED_FIELDS.has(mappedKey)) {
      sanitized[mappedKey] = value;
    }
  }
  return sanitized;
}

/* ── PDF generation helper ── */

async function generatePDFWithRetry(
  baseUrl: string,
  orderId: string,
  formType: string,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`${baseUrl}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(
          `[PDF auto-gen] ${formType} attempt ${attempt + 1} failed:`,
          data.error ?? res.status,
        );
        continue;
      }
      return; // success
    } catch (err) {
      console.error(
        `[PDF auto-gen] ${formType} attempt ${attempt + 1} network error:`,
        err,
      );
    }
  }
  console.error(
    `[PDF auto-gen] ${formType} failed after 2 attempts for order ${orderId}`,
  );
}

/* ── Route handler ── */

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  try {
    const { orderId, documentType, filePath, bucket } = await req.json();

    if (!orderId || !documentType || !filePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["facesheet", "clinical_docs"].includes(documentType)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const adminClient = createAdminClient();

    /* ── STEP 1: Fetch ALL context before anything else ── */

    // Order + facility + patient (these FKs point to their own tables — safe to join)
    const { data: orderCtx, error: orderCtxErr } = await adminClient
      .from("orders")
      .select(`
        *,
        facility:facilities!orders_facility_id_fkey(id, name, phone, contact, address_line_1, city, state, postal_code, assigned_rep),
        patient:patients!orders_patient_id_fkey(first_name, last_name, date_of_birth)
      `)
      .eq("id", orderId)
      .single();

    if (orderCtxErr || !orderCtx) {
      console.error("[extract] Failed to fetch order:", orderCtxErr?.message);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facility = orderCtx.facility as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patient  = orderCtx.patient  as any;

    // Creator profile (orders.created_by → auth.users, so query profiles separately)
    const { data: creator } = await adminClient
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", orderCtx.created_by)
      .maybeSingle();

    // Assigned provider profile (may be null)
    let assignedProvider: { first_name: string | null; last_name: string | null; phone: string | null } | null = null;
    if (orderCtx.assigned_provider_id) {
      const { data: ap } = await adminClient
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", orderCtx.assigned_provider_id)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignedProvider = ap as any;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const physician = (assignedProvider || creator) as any;
    const physicianName: string | null = physician
      ? `${physician.first_name ?? ""} ${physician.last_name ?? ""}`.trim() || null
      : null;
    const patientName: string | null = patient
      ? `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || null
      : null;

    // Facility enrollment
    const { data: enrollmentRaw } = await adminClient
      .from("facility_enrollment")
      .select("*")
      .eq("facility_id", orderCtx.facility_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enr = enrollmentRaw as any;

    // Provider credentials
    const physicianId = orderCtx.assigned_provider_id || orderCtx.created_by;
    const { data: creds } = await adminClient
      .from("provider_credentials")
      .select("npi_number, ptan_number")
      .eq("user_id", physicianId)
      .maybeSingle();

    // Sales rep name (facility.assigned_rep → profiles)
    let repName: string | null = null;
    if (facility?.assigned_rep) {
      const { data: rep } = await adminClient
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", facility.assigned_rep)
        .maybeSingle();
      if (rep) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = rep as any;
        repName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || null;
      }
    }

    // Billing address: enrollment first, facility fallback
    const addr: string | null = enr
      ? [enr.billing_address, enr.billing_city, enr.billing_state, enr.billing_zip].filter(Boolean).join(", ") || null
      : facility
        ? [facility.address_line_1, facility.city, facility.state, facility.postal_code].filter(Boolean).join(", ") || null
        : null;

    console.log(
      "[extract] Context — facility:", facility?.name ?? null,
      "| enrollment:", !!enr,
      "| enr.facility_npi:", enr?.facility_npi ?? null,
      "| physician:", physicianName,
      "| patient:", patientName,
      "| rep:", repName,
      "| creds.npi:", creds?.npi_number ?? null,
    );

    /* ── STEP 2: Download file ── */
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(bucket ?? "hbmedical-bucket-private")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Failed to download file: ${downloadError?.message}` },
        { status: 500 },
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const lowerPath = filePath.toLowerCase();
    const mimeType = lowerPath.endsWith(".pdf")
      ? "application/pdf"
      : lowerPath.endsWith(".png")
        ? "image/png"
        : lowerPath.endsWith(".heic")
          ? "image/heic"
          : "image/jpeg";

    /* ── STEP 3: Fetch existing order_form clinical context (facesheet only) ── */
    let orderFormCtx: Record<string, unknown> | null = null;
    if (documentType === "facesheet") {
      const { data: existingForm } = await adminClient
        .from("order_form")
        .select(
          "icd10_code, chief_complaint, wound_site, wound_stage, " +
          "condition_diabetes, condition_cvd, condition_copd, condition_chf, " +
          "condition_anemia, condition_decreased_mobility, condition_infection",
        )
        .eq("order_id", orderId)
        .maybeSingle();
      orderFormCtx =
        existingForm && typeof existingForm === "object" && !("error" in existingForm)
          ? (existingForm as Record<string, unknown>)
          : null;
    }

    /* ── STEP 4: Call AI model ── */
    const prompt =
      documentType === "facesheet"
        ? buildFacesheetPrompt(orderFormCtx)
        : CLINICAL_DOCS_PROMPT;

    const { text } = await generateText({
      model: aiModel("gemini-3.1-flash-lite-preview"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: base64,
              mediaType: mimeType as "application/pdf" | "image/png" | "image/jpeg" | "image/heic",
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    /* ── STEP 5: Parse JSON response ── */
    let extractedFields: Record<string, unknown> = {};
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[2] ?? text;
      extractedFields = JSON.parse(jsonStr.trim());
    } catch {
      console.error("[extract] JSON parse failed:", text);
      return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
    }

    /* ── STEP 6: Sanitize AI fields per document type ── */
    const aiIvr  = documentType === "facesheet"     ? sanitizeIvrFields(extractedFields)        : {};
    const ai1500 = documentType === "facesheet"     ? sanitizeForm1500Fields(extractedFields)    : {};
    const aiOf   = documentType === "clinical_docs" ? sanitizeOrderFormFields(extractedFields)   : {};
    const icd10  = aiOf.icd10_code as string | null | undefined;

    /* ── STEP 7: Upsert order_ivr — AI insurance fields + enrollment fallbacks ── */
    const ivrPayload = {
      order_id:          orderId,
      ai_extracted:      true,
      ai_extracted_at:   new Date().toISOString(),
      ...aiIvr,
      facility_name:     (aiIvr.facility_name     as string | null) || facility?.name           || null,
      facility_npi:      (aiIvr.facility_npi      as string | null) || enr?.facility_npi        || null,
      facility_tin:      (aiIvr.facility_tin      as string | null) || enr?.facility_tin        || null,
      facility_ptan:     (aiIvr.facility_ptan     as string | null) || enr?.facility_ptan       || null,
      facility_fax:      (aiIvr.facility_fax      as string | null) || enr?.billing_fax         || null,
      facility_address:  (aiIvr.facility_address  as string | null) || addr                     || null,
      facility_phone:    (aiIvr.facility_phone    as string | null) || enr?.billing_phone       || facility?.phone || null,
      facility_contact:  (aiIvr.facility_contact  as string | null) || enr?.ap_contact_name     || facility?.contact || null,
      physician_name:    (aiIvr.physician_name    as string | null) || physicianName             || null,
      physician_npi:     (aiIvr.physician_npi     as string | null) || creds?.npi_number        || null,
      physician_tin:     (aiIvr.physician_tin     as string | null) || enr?.facility_tin        || null,
      physician_fax:     (aiIvr.physician_fax     as string | null) || enr?.billing_fax         || null,
      physician_address: (aiIvr.physician_address as string | null) || addr                     || null,
      physician_phone:   (aiIvr.physician_phone   as string | null) || physician?.phone         || null,
      patient_name:      (aiIvr.patient_name      as string | null) || patientName              || null,
      patient_dob:       (aiIvr.patient_dob       as string | null) || patient?.date_of_birth   || null,
      sales_rep_name:    repName                                                                  || null,
    };

    const { error: ivrErr } = await adminClient
      .from("order_ivr")
      .upsert(ivrPayload, { onConflict: "order_id" });
    if (ivrErr) {
      console.error("[extract] order_ivr FAILED:", JSON.stringify(ivrErr));
    } else {
      console.log(
        "[extract] order_ivr saved — facility_name:", ivrPayload.facility_name,
        "| facility_npi:", ivrPayload.facility_npi,
        "| physician:", ivrPayload.physician_name,
        "| patient:", ivrPayload.patient_name,
      );
    }

    /* ── STEP 8: Upsert order_form_1500 — AI patient/insurance fields + enrollment fallbacks ── */
    const form1500Payload = {
      order_id:                orderId,
      ...ai1500,
      ...(icd10 ? { diagnosis_a: icd10 } : {}),
      service_facility_name:    (ai1500.service_facility_name    as string | null) || facility?.name     || null,
      service_facility_address: (ai1500.service_facility_address as string | null) || addr               || null,
      service_facility_npi:     (ai1500.service_facility_npi     as string | null) || enr?.facility_npi  || null,
      billing_provider_name:    (ai1500.billing_provider_name    as string | null) || facility?.name     || null,
      billing_provider_address: (ai1500.billing_provider_address as string | null) || addr               || null,
      billing_provider_phone:   (ai1500.billing_provider_phone   as string | null) || enr?.billing_phone || facility?.phone || null,
      billing_provider_npi:     (ai1500.billing_provider_npi     as string | null) || enr?.facility_npi  || null,
      billing_provider_tax_id:  (ai1500.billing_provider_tax_id  as string | null) || enr?.facility_tin  || null,
      federal_tax_id:           (ai1500.federal_tax_id           as string | null) || enr?.facility_tin  || null,
      referring_provider_name:  (ai1500.referring_provider_name  as string | null) || physicianName      || null,
      referring_provider_npi:   (ai1500.referring_provider_npi   as string | null) || creds?.npi_number  || null,
    };

    const { error: f15Err } = await adminClient
      .from("order_form_1500")
      .upsert(form1500Payload, { onConflict: "order_id" });
    if (f15Err) {
      console.error("[extract] order_form_1500 FAILED:", JSON.stringify(f15Err));
    } else {
      console.log(
        "[extract] order_form_1500 saved — billing_provider_name:", form1500Payload.billing_provider_name,
        "| federal_tax_id:", form1500Payload.federal_tax_id,
      );
    }

    /* ── STEP 9: Upsert order_form — AI clinical fields + physician/patient context ── */
    const orderFormPayload = {
      order_id:            orderId,
      ...aiOf,
      patient_name:        (aiOf.patient_name        as string | null) || patientName         || null,
      patient_date:        (orderCtx as any).date_of_service           || null,
      physician_signature: physicianName                                || null,
      ai_extracted:        true,
      ai_extracted_at:     new Date().toISOString(),
    };

    const { error: ofErr } = await adminClient
      .from("order_form")
      .upsert(orderFormPayload, { onConflict: "order_id" });
    if (ofErr) {
      console.error("[extract] order_form FAILED:", JSON.stringify(ofErr));
    } else {
      console.log("[extract] order_form saved — patient_name:", orderFormPayload.patient_name, "| physician_signature:", orderFormPayload.physician_signature);
    }

    /* ── STEP 10: Auto-create patient record from facesheet ── */
    if (documentType === "facesheet") {
      const firstName = ai1500.patient_first_name as string | undefined;
      const lastName  = ai1500.patient_last_name  as string | undefined;
      const dob       = ai1500.patient_dob        as string | undefined;

      if (firstName && lastName && !orderCtx.patient_id) {
        const { data: existingPatient } = await adminClient
          .from("patients")
          .select("id")
          .eq("facility_id", orderCtx.facility_id)
          .ilike("first_name", firstName.trim())
          .ilike("last_name", lastName.trim())
          .maybeSingle();

        let patientId: string | undefined;
        if (existingPatient) {
          patientId = existingPatient.id;
        } else {
          const { data: newPatient, error: patientErr } = await adminClient
            .from("patients")
            .insert({
              facility_id:   orderCtx.facility_id,
              first_name:    firstName.trim(),
              last_name:     lastName.trim(),
              date_of_birth: dob ?? null,
              is_active:     true,
            })
            .select("id")
            .single();
          if (patientErr) console.error("[extract] patient create failed:", patientErr.message);
          else patientId = newPatient?.id;
        }
        if (patientId) {
          await adminClient.from("orders").update({ patient_id: patientId }).eq("id", orderId);
        }
      }
    }

    /* ── STEP 11: Mark order AI-extracted (triggers Realtime) ── */
    await adminClient
      .from("orders")
      .update({ ai_extracted: true, ai_extracted_at: new Date().toISOString() })
      .eq("id", orderId);
    console.log("[extract] orders.ai_extracted=true for:", orderId);

    /* ── STEP 12: History log (fire-and-forget) ── */
    adminClient.from("order_history").insert({
      order_id:     orderId,
      performed_by: null,
      action:       documentType === "facesheet"
        ? "AI extracted patient data from facesheet"
        : "AI extracted clinical data from doctor's notes",
      old_status:  null,
      new_status:  null,
      notes:       null,
    }).then(({ error }) => {
      if (error) console.error("[extract] history error:", error.message);
    });

    /* ── STEP 13: Generate all 3 PDFs — all data is in DB ── */
    console.log("[extract] generating PDFs for order:", orderId);
    await new Promise((r) => setTimeout(r, 500));
    for (const formType of ["order_form", "ivr", "hcfa_1500"] as const) {
      try {
        const res = await fetch(`${baseUrl}/api/generate-pdf`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ orderId, formType }),
        });
        const pdfData = await res.json();
        if (!res.ok || pdfData.error) {
          console.error(`[extract] ${formType} PDF failed:`, pdfData.error ?? res.status);
        } else {
          console.log(`[extract] ${formType} PDF ok:`, pdfData.filePath);
        }
      } catch (err) {
        console.error(`[extract] ${formType} PDF error:`, err);
      }
    }

    return NextResponse.json({ success: true, documentType, extractedFields });
  } catch (err) {
    console.error("[extract-document API]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ── Prompts ── */

/* buildFacesheetPrompt
   Injects existing order_form clinical data as text context so the AI can
   populate CMS-1500 diagnosis codes even when clinical docs were not yet
   uploaded at the time the facesheet is processed (or vice-versa). */
function buildFacesheetPrompt(
  orderFormCtx: Record<string, unknown> | null,
): string {
  const clinicalSection = orderFormCtx
    ? `

== CLINICAL CONTEXT ==
The following data was already extracted from this patient's clinical documentation.
Use it to populate diagnosis code fields on the CMS-1500. Do NOT use it to override
patient demographics or insurance fields — extract those from the facesheet image.

${JSON.stringify(orderFormCtx, null, 2)}

Mapping rules:
- icd10_code → diagnosis_a (copy the value exactly, e.g. "L97.319")
- If the patient has documented comorbidities (diabetes, CVD, COPD, CHF, anemia, infection)
  add the standard ICD-10 code for each true condition as diagnosis_b, diagnosis_c, etc.
  Common codes: diabetes=E11.9, CVD=I25.10, COPD=J44.1, CHF=I50.9, anemia=D64.9
- Leave diagnosis fields null if no clinical context is provided.
`
    : "";

  return `You are a medical data extraction specialist.
Extract patient and insurance information from this patient facesheet document.${clinicalSection}

Return ONLY a valid JSON object. Use null for any field not found. No text outside the JSON.

{
  "patient_last_name": string | null,
  "patient_first_name": string | null,
  "patient_middle_initial": string | null,
  "patient_dob": "YYYY-MM-DD" | null,
  "patient_sex": "male" | "female" | "other" | null,
  "patient_address": string | null,
  "patient_city": string | null,
  "patient_state": string | null,
  "patient_zip": string | null,
  "patient_phone": string | null,
  "insurance_type": "medicare" | "medicaid" | "tricare" | "champva" | "group_health_plan" | "other" | null,
  "insured_id_number": string | null,
  "insured_last_name": string | null,
  "insured_first_name": string | null,
  "patient_relationship": "self" | "spouse" | "child" | "other" | null,
  "insured_address": string | null,
  "insured_city": string | null,
  "insured_state": string | null,
  "insured_zip": string | null,
  "insured_phone": string | null,
  "insured_policy_group": string | null,
  "insured_dob": "YYYY-MM-DD" | null,
  "insured_sex": "male" | "female" | "other" | null,
  "insured_employer": string | null,
  "insurance_name": string | null,
  "insurance_phone": string | null,
  "insured_plan_name": string | null,
  "plan_type": "HMO" | "PPO" | "Medicare" | "Medicaid" | "Other" | null,
  "coverage_start_date": "YYYY-MM-DD" | null,
  "coverage_end_date": "YYYY-MM-DD" | null,
  "secondary_insurance_provider": string | null,
  "secondary_insurance_phone": string | null,
  "secondary_subscriber_name": string | null,
  "secondary_policy_number": string | null,
  "secondary_subscriber_dob": "YYYY-MM-DD" | null,
  "secondary_plan_type": string | null,
  "secondary_group_number": string | null,
  "secondary_subscriber_relationship": "self" | "spouse" | "child" | "other" | null,
  "diagnosis_a": string | null,
  "diagnosis_b": string | null,
  "diagnosis_c": string | null,
  "diagnosis_d": string | null,
  "diagnosis_e": string | null,
  "diagnosis_f": string | null
}

IMPORTANT:
- Extract demographics and insurance data from the facesheet IMAGE only.
- "insurance_name" is the PRIMARY insurance COMPANY name (e.g. "BlueCross BlueShield").
- "insurance_phone" is the PRIMARY insurance company's customer service phone (NOT the patient's phone).
- "insured_plan_name" is the specific plan name (e.g. "PPO Gold 500"). Do NOT put the company name here.
- "plan_type" is the PRIMARY plan network type: HMO, PPO, Medicare, Medicaid, or Other.
- "coverage_start_date" / "coverage_end_date" are the PRIMARY insurance effective dates (YYYY-MM-DD).
- Populate secondary insurance fields only if a second/secondary policy is explicitly shown.
- "secondary_insurance_provider" is the secondary insurance company name.
- "secondary_plan_type" is the plan type for the secondary policy.
- For diagnosis_a–f: use ICD-10 format (e.g. "L97.319"). Only populate if clinical context
  is provided above — do not invent codes from the facesheet alone.`.trim();
}

const CLINICAL_DOCS_PROMPT = `
You are a medical data extraction specialist.
Extract clinical information from this doctor's note, wound assessment, or clinical documentation.

IMPORTANT: Return ONLY a valid JSON object.
Use EXACTLY these field names (no abbreviations).
Use null for string/number fields not found.
Use false for boolean fields not mentioned.
No text outside the JSON.

{
  "chief_complaint": string | null,
  "wound_visit_number": number | null,
  "wound_site": string | null,
  "wound_stage": string | null,
  "wound_length_cm": number | null,
  "wound_width_cm": number | null,
  "wound_depth_cm": number | null,
  "has_vasculitis_or_burns": boolean,
  "is_receiving_home_health": boolean,
  "is_patient_at_snf": boolean,
  "icd10_code": string | null,
  "followup_days": 7 | 14 | 21 | 30 | null,
  "subjective_symptoms": string[],
  "clinical_notes": string | null,

  "condition_decreased_mobility": boolean,
  "condition_diabetes": boolean,
  "condition_infection": boolean,
  "condition_cvd": boolean,
  "condition_copd": boolean,
  "condition_chf": boolean,
  "condition_anemia": boolean,

  "use_blood_thinners": boolean,
  "blood_thinner_details": string | null,

  "wound_location_side": "RT" | "LT" | "bilateral" | null,
  "granulation_tissue_pct": number | null,
  "exudate_amount": "none" | "minimal" | "moderate" | "heavy" | null,
  "third_degree_burns": boolean,
  "active_vasculitis": boolean,
  "active_charcot": boolean,
  "skin_condition": "normal" | "thin" | "atrophic" | "stasis" | "ischemic" | null,

  "wound2_length_cm": number | null,
  "wound2_width_cm": number | null,
  "wound2_depth_cm": number | null,

  "drainage_description": string | null,
  "treatment_plan": string | null
}

CRITICAL: Use the EXACT field names above including all underscores. For example:
  "is_receiving_home_health" NOT "is_receiving_health"
  "has_vasculitis_or_burns" NOT "has_vasculitis"
  "icd10_code" NOT "icd10" or "icd_10"
  "subjective_symptoms" NOT "symptoms"

For subjective_symptoms only use values from: ["Pain", "Numbness", "Fever", "Chills", "Nausea"]

Field guidance:
- condition_* fields: set true if the patient's history/medical records mention that condition
- use_blood_thinners: true if any blood thinner is listed in the medication list
- blood_thinner_details: list specific medications found (e.g. "ASA, Plavix, Eliquis")
- wound_location_side: "RT" for right, "LT" for left, "bilateral" if both sides
- granulation_tissue_pct: percentage (0-100) of wound bed covered by granulation tissue
- exudate_amount: overall drainage level from the wound
- third_degree_burns / active_vasculitis / active_charcot: true only if explicitly documented as active
- skin_condition: condition of the periwound/surrounding skin
- wound2_* fields: measurements for a second wound only if a second wound is documented
- drainage_description: narrative description of wound drainage character/color/odor
- treatment_plan: full treatment plan including dressing type, frequency, and wound care orders
`.trim();
