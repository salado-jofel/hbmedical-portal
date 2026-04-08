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
  "insurance_provider",
  "insurance_phone",
  "member_id",
  "group_number",
  "plan_name",
  "plan_type",
  "subscriber_name",
  "subscriber_dob",
  "subscriber_relationship",
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
  try {
    const { orderId, documentType, filePath, bucket } = await req.json();

    if (!orderId || !documentType || !filePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["facesheet", "clinical_docs"].includes(documentType)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const adminClient = createAdminClient();

    /* -- Download file from storage -- */
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(bucket ?? "hbmedical-bucket-private")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Failed to download file: ${downloadError?.message}` },
        { status: 500 },
      );
    }

    /* -- Convert to base64 -- */
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

    /* -- Call model -- */
    const prompt =
      documentType === "facesheet" ? FACESHEET_PROMPT : CLINICAL_DOCS_PROMPT;

    const { text } = await generateText({
      // ── Gemini (active) ──
      model: aiModel("gemini-3.1-flash-lite-preview"),
      // ── Claude (commented out — swap model string when switching) ──
      // model: aiModel("claude-sonnet-4-6"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: base64,
              mediaType: mimeType as
                | "application/pdf"
                | "image/png"
                | "image/jpeg"
                | "image/heic",
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    /* -- Parse JSON response -- */
    let extractedFields: Record<string, unknown> = {};
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[2] ?? text;
      extractedFields = JSON.parse(jsonStr.trim());
    } catch {
      console.error("[extract-document] JSON parse failed:", text);
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 },
      );
    }

    /* -- Write to appropriate table using sanitized fields only -- */
    if (documentType === "facesheet") {
      const safeFields = sanitizeForm1500Fields(extractedFields);

      const { error: form1500Error } = await adminClient
        .from("order_form_1500")
        .upsert(
          { order_id: orderId, ...safeFields },
          { onConflict: "order_id" },
        );

      if (form1500Error) {
        return NextResponse.json(
          { error: `DB write failed: ${form1500Error.message}` },
          { status: 500 },
        );
      }

      /* -- Auto-create patient from extracted facesheet data -- */
      const firstName = safeFields.patient_first_name as string | undefined;
      const lastName = safeFields.patient_last_name as string | undefined;
      const dob = safeFields.patient_dob as string | undefined;

      if (firstName && lastName) {
        const { data: orderRow } = await adminClient
          .from("orders")
          .select("facility_id, patient_id")
          .eq("id", orderId)
          .single();

        if (orderRow && !orderRow.patient_id) {
          // Check if patient already exists in this facility
          const { data: existingPatient } = await adminClient
            .from("patients")
            .select("id")
            .eq("facility_id", orderRow.facility_id)
            .ilike("first_name", firstName.trim())
            .ilike("last_name", lastName.trim())
            .maybeSingle();

          let patientId: string | undefined;

          if (existingPatient) {
            patientId = existingPatient.id;
          } else {
            const { data: newPatient, error: patientError } = await adminClient
              .from("patients")
              .insert({
                facility_id: orderRow.facility_id,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                date_of_birth: dob ?? null,
                is_active: true,
              })
              .select("id")
              .single();

            if (patientError || !newPatient) {
              console.error(
                "[extract-document] Failed to create patient:",
                patientError,
              );
              // Non-fatal — continue without patient link
            } else {
              patientId = newPatient.id;
            }
          }

          if (patientId) {
            await adminClient
              .from("orders")
              .update({ patient_id: patientId })
              .eq("id", orderId);
          }
        }
      }

      /* -- Upsert insurance data into order_ivr -- */
      const safeIvrFields = sanitizeIvrFields(extractedFields);
      if (Object.keys(safeIvrFields).length > 0) {
        const { error: ivrError } = await adminClient
          .from("order_ivr")
          .upsert(
            {
              order_id: orderId,
              ai_extracted: true,
              ai_extracted_at: new Date().toISOString(),
              ...safeIvrFields,
            },
            { onConflict: "order_id" },
          );
        if (ivrError) {
          console.error(
            "[AI Extract] order_ivr upsert error:",
            JSON.stringify(ivrError),
          );
        }
      }
    } else {
      const safeFields = sanitizeOrderFormFields(extractedFields);

      const { error } = await adminClient.from("order_form").upsert(
        {
          order_id: orderId,
          ai_extracted: true,
          ai_extracted_at: new Date().toISOString(),
          ...safeFields,
        },
        { onConflict: "order_id" },
      );

      if (error) {
        return NextResponse.json(
          { error: `DB write failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    /* -- Mark order as AI-extracted (triggers Realtime in the UI) -- */
    await adminClient
      .from("orders")
      .update({ ai_extracted: true, ai_extracted_at: new Date().toISOString() })
      .eq("id", orderId);

    /* -- Log AI extraction to history -- */
    adminClient.from("order_history").insert({
      order_id: orderId,
      performed_by: null,
      action:
        documentType === "facesheet"
          ? "AI extracted patient data from facesheet"
          : "AI extracted clinical data from doctor's notes",
      old_status: null,
      new_status: null,
      notes: null,
    }).then(({ error }) => {
      if (error) console.error("[AI history]", error.message);
    });

    /* -- Auto-generate PDFs (both types, awaited with retry) -- */
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Small delay to let the DB upsert propagate before generate-pdf reads it
    await new Promise((r) => setTimeout(r, 500));

    await Promise.allSettled([
      generatePDFWithRetry(baseUrl, orderId, "order_form"),
      generatePDFWithRetry(baseUrl, orderId, "hcfa_1500"),
      generatePDFWithRetry(baseUrl, orderId, "ivr"),
    ]);

    return NextResponse.json({ success: true, documentType, extractedFields });
  } catch (err) {
    console.error("[extract-document API]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ── Prompts ── */

const FACESHEET_PROMPT = `
You are a medical data extraction specialist.
Extract patient and insurance information from this patient facesheet document.

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
  "insured_plan_name": string | null
}

IMPORTANT: "insurance_name" is the insurance COMPANY name (e.g. "BlueCross BlueShield", "Aetna", "UnitedHealthcare").
"insured_plan_name" is the specific PLAN or benefit name (e.g. "PPO Gold 500", "HMO Select", "Medicare Supplement Plan G").
Do NOT put the company name in "insured_plan_name".
`.trim();

const CLINICAL_DOCS_PROMPT = `
You are a medical data extraction specialist.
Extract clinical information from this doctor's note.

IMPORTANT: Return ONLY a valid JSON object.
Use EXACTLY these field names (no abbreviations).
Use null for fields not found.
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
  "clinical_notes": string | null
}

CRITICAL: Use the EXACT field names above including all underscores. For example:
  "is_receiving_home_health" NOT "is_receiving_health"
  "has_vasculitis_or_burns" NOT "has_vasculitis"
  "icd10_code" NOT "icd10" or "icd_10"
  "subjective_symptoms" NOT "symptoms"

For subjective_symptoms only use values from: ["Pain", "Numbness", "Fever", "Chills", "Nausea"]
`.trim();
