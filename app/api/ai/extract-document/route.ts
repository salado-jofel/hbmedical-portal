import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { orderId, documentType, filePath, bucket } = await req.json();

    if (!orderId || !documentType || !filePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    /* -- Call Claude -- */
    const prompt = documentType === "facesheet" ? FACESHEET_PROMPT : CLINICAL_DOCS_PROMPT;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: base64,
              mediaType: mimeType,
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
      return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
    }

    /* -- Filter out nulls so we don't overwrite existing data -- */
    const cleanFields = Object.fromEntries(
      Object.entries(extractedFields).filter(([, v]) => v !== null && v !== undefined),
    );

    /* -- Write to appropriate table -- */
    if (documentType === "facesheet") {
      const { error } = await adminClient
        .from("order_form_1500")
        .upsert({ order_id: orderId, ...cleanFields }, { onConflict: "order_id" });

      if (error) {
        return NextResponse.json({ error: `DB write failed: ${error.message}` }, { status: 500 });
      }
    } else {
      const { error } = await adminClient
        .from("order_form")
        .upsert(
          {
            order_id: orderId,
            ai_extracted: true,
            ai_extracted_at: new Date().toISOString(),
            ...cleanFields,
          },
          { onConflict: "order_id" },
        );

      if (error) {
        return NextResponse.json({ error: `DB write failed: ${error.message}` }, { status: 500 });
      }
    }

    /* -- Mark order as AI-extracted (triggers Realtime in the UI) -- */
    await adminClient
      .from("orders")
      .update({ ai_extracted: true, ai_extracted_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({ success: true, documentType, extractedFields: cleanFields });
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
  "insured_plan_name": string | null
}
`.trim();

const CLINICAL_DOCS_PROMPT = `
You are a medical data extraction specialist.
Extract clinical information from this doctor's note or clinical documentation.

Return ONLY a valid JSON object. Use null for fields not found. Use false for booleans not mentioned. No text outside the JSON.

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

For subjective_symptoms only use values from: ["Pain", "Numbness", "Fever", "Chills", "Nausea"]
`.trim();
