"use server";

/**
 * AI helper for the "Build IVR from fax" flow.
 *
 * Downloads the intake fax PDF from storage, sends it to Claude via AWS
 * Bedrock, and returns a small strict-typed shape suitable for pre-
 * populating the standalone_ivrs metadata form (patient / physician /
 * product summary). The user always gets the final edit — this is a
 * pre-fill, not a submission.
 *
 * Kept intentionally lightweight vs. the order-doc extract endpoint at
 * /api/ai/extract-document — that one is order-scoped and does a lot
 * more (PDF regen, field sanitizers, multi-doc combined prompt). Here
 * we only need five fields off a single PDF.
 */

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/supabase/auth";
import { safeLogError } from "@/lib/logging/safe-log";
import { logPhiAccess } from "@/lib/audit/log-phi-access";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Same inference profile the order-doc extractor uses. Bedrock requires
// the cross-region profile ID for Claude 4+.
const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

/**
 * Zod schema covers every rich-form field the standalone IVR captures.
 * All fields are nullable — the AI is a pre-fill, not a gate; the user
 * always has the final edit before saving.
 *
 * `.catchall(z.unknown())` is intentional at the top level so Claude
 * can return extra fields we don't recognize without failing the whole
 * parse; unknowns are dropped by the caller after validation.
 */
const IvrFieldsSchema = z.object({
  // Top-level metadata (mirrors standalone_ivrs top-level columns).
  patientName: z.string().max(200).nullable().default(null),
  patientDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
    .nullable()
    .default(null),
  physicianName: z.string().max(200).nullable().default(null),
  physicianNpi: z
    .string()
    .regex(/^\d{10}$/, "NPI must be 10 digits")
    .nullable()
    .default(null),
  productSummary: z.string().max(500).nullable().default(null),

  // Rich-form fields (mirror IStandaloneIvrForm).
  salesRepName: z.string().nullable().default(null),
  placeOfService: z.string().nullable().default(null),
  medicareAdminContractor: z.string().nullable().default(null),
  facilityName: z.string().nullable().default(null),
  facilityAddress: z.string().nullable().default(null),
  facilityContact: z.string().nullable().default(null),
  facilityPhone: z.string().nullable().default(null),
  facilityFax: z.string().nullable().default(null),
  facilityNpi: z.string().nullable().default(null),
  facilityTin: z.string().nullable().default(null),
  facilityPtan: z.string().nullable().default(null),
  physicianPhone: z.string().nullable().default(null),
  physicianFax: z.string().nullable().default(null),
  physicianAddress: z.string().nullable().default(null),
  physicianTin: z.string().nullable().default(null),
  patientPhone: z.string().nullable().default(null),
  patientAddress: z.string().nullable().default(null),
  insuranceProvider: z.string().nullable().default(null),
  insurancePhone: z.string().nullable().default(null),
  memberId: z.string().nullable().default(null),
  groupNumber: z.string().nullable().default(null),
  planName: z.string().nullable().default(null),
  planType: z.string().nullable().default(null),
  subscriberName: z.string().nullable().default(null),
  subscriberDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  subscriberRelationship: z.string().nullable().default(null),
  secondaryInsuranceProvider: z.string().nullable().default(null),
  secondaryInsurancePhone: z.string().nullable().default(null),
  secondarySubscriberName: z.string().nullable().default(null),
  secondaryPolicyNumber: z.string().nullable().default(null),
  secondarySubscriberDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  secondaryPlanType: z.string().nullable().default(null),
  secondaryGroupNumber: z.string().nullable().default(null),
  secondarySubscriberRelationship: z.string().nullable().default(null),
  woundType: z.string().nullable().default(null),
  woundSizes: z.string().nullable().default(null),
  applicationCpts: z.string().nullable().default(null),
  dateOfProcedure: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  icd10Codes: z.string().nullable().default(null),
  productInformation: z.string().nullable().default(null),
});

export type ExtractedIvrFields = z.infer<typeof IvrFieldsSchema>;

const PROMPT = `You are a medical data extraction specialist.
The attached document is an inbound fax that will be used to build an IVR
(Insurance Verification Request) for a wound-care order.

Extract as many of the following fields as the fax clearly supports and
return them as a single JSON object. Return ONLY the JSON — no prose,
no markdown fences.

{
  "patientName": string | null,
  "patientDob": "YYYY-MM-DD" | null,
  "physicianName": string | null,
  "physicianNpi": string | null,
  "productSummary": string | null,

  "salesRepName": string | null,
  "placeOfService": string | null,
  "medicareAdminContractor": string | null,

  "facilityName": string | null,
  "facilityAddress": string | null,
  "facilityContact": string | null,
  "facilityPhone": string | null,
  "facilityFax": string | null,
  "facilityNpi": string | null,
  "facilityTin": string | null,
  "facilityPtan": string | null,

  "physicianPhone": string | null,
  "physicianFax": string | null,
  "physicianAddress": string | null,
  "physicianTin": string | null,

  "patientPhone": string | null,
  "patientAddress": string | null,

  "insuranceProvider": string | null,
  "insurancePhone": string | null,
  "memberId": string | null,
  "groupNumber": string | null,
  "planName": string | null,
  "planType": string | null,
  "subscriberName": string | null,
  "subscriberDob": "YYYY-MM-DD" | null,
  "subscriberRelationship": string | null,

  "secondaryInsuranceProvider": string | null,
  "secondaryInsurancePhone": string | null,
  "secondarySubscriberName": string | null,
  "secondaryPolicyNumber": string | null,
  "secondarySubscriberDob": "YYYY-MM-DD" | null,
  "secondaryPlanType": string | null,
  "secondaryGroupNumber": string | null,
  "secondarySubscriberRelationship": string | null,

  "woundType": string | null,
  "woundSizes": string | null,
  "applicationCpts": string | null,
  "dateOfProcedure": "YYYY-MM-DD" | null,
  "icd10Codes": string | null,
  "productInformation": string | null
}

Rules:
- Use null when a value is not clearly present. Do NOT guess.
- Do NOT include titles ("Dr.", "MD") or credentials in physicianName.
- Dates must be YYYY-MM-DD. If the doc shows "3/14/1962", output "1962-03-14".
- All NPIs must be exactly 10 digits. Strip formatting. If uncertain, null.
- placeOfService must be one of: "Office (11)", "Patient home (12)", "Assisted Living Facility (13)", "Off Campus Outpatient Hospital (19)", "Hospital outpatient (22)", "Ambulatory Surgical Center (24)", "Independent Clinic (49)".
- woundType (when set) must be one of: "Diabetic Foot Ulcer", "Venous Leg Ulcer", "Pressure Ulcer", "Traumatic Burns", "Radiation Burns", "Necrotizing Fasciitis", "Dehisced Surgical Wound", "Post-Surgical Incision".
- subscriberRelationship (when set): "Self", "Spouse", "Child", or "Other".
- Numeric IDs (member/group/policy) stay as text — no formatting/cleanup beyond removing whitespace.
- Free-text fields (woundSizes, icd10Codes, applicationCpts, productInformation) can be short human-readable sentences.`;

/**
 * Extract IVR-metadata fields from a fax intake PDF. Callable from admin
 * / support only — same gate as the intake list itself. Returns null on
 * any failure (auth, download, AI parse) with the reason surfaced so the
 * modal can toast; the user can still fill the form by hand.
 */
export async function extractIvrFieldsFromFax(
  intakeId: string,
): Promise<
  | { success: true; fields: ExtractedIvrFields }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const role = await getUserRole(supabase);
    if (role !== "admin" && role !== "support_staff") {
      return { success: false, error: "Not authorized." };
    }

    // Look up the intake row via the user client so RLS still applies —
    // admin/support see everything, but this keeps future role changes
    // from silently widening access.
    const { data: intake, error: intakeErr } = await supabase
      .from("intake_documents")
      .select("id, bucket, file_path, mime_type")
      .eq("id", intakeId)
      .maybeSingle();
    if (intakeErr || !intake) {
      return { success: false, error: "Intake not found." };
    }

    // Download bytes via admin client — same reason as the order-doc
    // extractor: storage RLS on the intake path is tight and role
    // filtering on the row is what actually protects PHI.
    const adminClient = createAdminClient();
    const { data: blob, error: dlErr } = await adminClient.storage
      .from(intake.bucket as string)
      .download(intake.file_path as string);
    if (dlErr || !blob) {
      safeLogError("extractIvrFieldsFromFax", dlErr, {
        phase: "storage.download",
        intakeId,
      });
      return { success: false, error: "Failed to load the fax file." };
    }

    void logPhiAccess({
      action: "intake.ai_extract",
      resource: "intake_documents",
      metadata: { intakeId },
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mediaType =
      (intake.mime_type as string | null) ?? "application/pdf";

    const { text } = await generateText({
      model: bedrock(MODEL_ID),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "file",
              data: bytes,
              mediaType,
            },
          ],
        },
      ],
    });

    // Strip any accidental prose / markdown fences the model added,
    // then parse strictly against the Zod schema.
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return { success: false, error: "AI returned no JSON." };
    }
    const jsonRaw = text.slice(jsonStart, jsonEnd + 1);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonRaw);
    } catch {
      return { success: false, error: "AI returned invalid JSON." };
    }

    const check = IvrFieldsSchema.safeParse(parsed);
    if (check.success) return { success: true, fields: check.data };

    // Soft-fallback: coerce each field independently so a single bad
    // date or NPI doesn't wipe out the rest. Same policy as the order-
    // side extractor — the form is manual-review anyway.
    return { success: true, fields: softParseIvrFields(parsed) };
  } catch (err) {
    safeLogError("extractIvrFieldsFromFax", err, { intakeId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* ── Per-field coercers ─────────────────────────────────────────────────── */

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 500 ? t : null;
}

function dateOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function npiOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

/**
 * Field-by-field soft parse. Runs when the strict Zod parse rejects
 * the model's output — a single bad date shouldn't drop the whole
 * pre-fill. Every field coerces independently and defaults to null.
 */
function softParseIvrFields(raw: unknown): ExtractedIvrFields {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    patientName: strOrNull(r.patientName),
    patientDob: dateOrNull(r.patientDob),
    physicianName: strOrNull(r.physicianName),
    physicianNpi: npiOrNull(r.physicianNpi),
    productSummary: strOrNull(r.productSummary),

    salesRepName: strOrNull(r.salesRepName),
    placeOfService: strOrNull(r.placeOfService),
    medicareAdminContractor: strOrNull(r.medicareAdminContractor),
    facilityName: strOrNull(r.facilityName),
    facilityAddress: strOrNull(r.facilityAddress),
    facilityContact: strOrNull(r.facilityContact),
    facilityPhone: strOrNull(r.facilityPhone),
    facilityFax: strOrNull(r.facilityFax),
    facilityNpi: npiOrNull(r.facilityNpi),
    facilityTin: strOrNull(r.facilityTin),
    facilityPtan: strOrNull(r.facilityPtan),

    physicianPhone: strOrNull(r.physicianPhone),
    physicianFax: strOrNull(r.physicianFax),
    physicianAddress: strOrNull(r.physicianAddress),
    physicianTin: strOrNull(r.physicianTin),

    patientPhone: strOrNull(r.patientPhone),
    patientAddress: strOrNull(r.patientAddress),

    insuranceProvider: strOrNull(r.insuranceProvider),
    insurancePhone: strOrNull(r.insurancePhone),
    memberId: strOrNull(r.memberId),
    groupNumber: strOrNull(r.groupNumber),
    planName: strOrNull(r.planName),
    planType: strOrNull(r.planType),
    subscriberName: strOrNull(r.subscriberName),
    subscriberDob: dateOrNull(r.subscriberDob),
    subscriberRelationship: strOrNull(r.subscriberRelationship),

    secondaryInsuranceProvider: strOrNull(r.secondaryInsuranceProvider),
    secondaryInsurancePhone: strOrNull(r.secondaryInsurancePhone),
    secondarySubscriberName: strOrNull(r.secondarySubscriberName),
    secondaryPolicyNumber: strOrNull(r.secondaryPolicyNumber),
    secondarySubscriberDob: dateOrNull(r.secondarySubscriberDob),
    secondaryPlanType: strOrNull(r.secondaryPlanType),
    secondaryGroupNumber: strOrNull(r.secondaryGroupNumber),
    secondarySubscriberRelationship: strOrNull(
      r.secondarySubscriberRelationship,
    ),

    woundType: strOrNull(r.woundType),
    woundSizes: strOrNull(r.woundSizes),
    applicationCpts: strOrNull(r.applicationCpts),
    dateOfProcedure: dateOrNull(r.dateOfProcedure),
    icd10Codes: strOrNull(r.icd10Codes),
    productInformation: strOrNull(r.productInformation),
  };
}
