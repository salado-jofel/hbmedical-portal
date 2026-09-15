"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { BUCKET, generateOrderNumber } from "../../orders/(services)/_shared";
import { paubox, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/paubox";
import { buildIvrApprovalEmail } from "@/lib/emails/build-ivr-approval-email";
import { randomUUID } from "crypto";
import type {
  IStandaloneIvr,
  IStandaloneIvrFile,
  IStandaloneIvrForm,
  IStandaloneIvrHistoryEntry,
  StandaloneIvrHistoryEvent,
  IExternalApprover,
} from "@/utils/interfaces/standalone-ivrs";

const IVRS_PATH = "/dashboard/ivrs";

// external_approvers is deliberately NOT joined here — its RLS policy
// only permits admin+support to SELECT, so a clinic-role caller would
// get back a null join even though assigned_approver_id is populated,
// which is what caused the "Approver: —" column on the IVRs list. The
// approver is hydrated in a second admin-client fetch (bypasses RLS)
// scoped to the exact IDs already returned by this RLS-scoped read.
const IVR_SELECT = `
  id,
  status,
  patient_name,
  patient_dob,
  physician_name,
  physician_npi,
  facility_id,
  product_summary,
  assigned_approver_id,
  approval_token,
  approval_expires_at,
  sent_at,
  approved_at,
  denied_at,
  denial_reason,
  approver_display_name,
  approver_ip,
  approver_user_agent,
  uploaded_by,
  converted_to_order_id,
  created_at,
  updated_at,
  facilities ( name ),
  ai_extracted,
  ai_extracted_at,
  sales_rep_name,
  place_of_service,
  specialty_site_name,
  medicare_admin_contractor,
  facility_name,
  facility_address,
  facility_contact,
  facility_phone,
  facility_fax,
  facility_npi,
  facility_tin,
  facility_ptan,
  physician_phone,
  physician_fax,
  physician_address,
  physician_tin,
  patient_phone,
  patient_address,
  ok_to_contact_patient,
  insurance_provider,
  insurance_phone,
  member_id,
  group_number,
  plan_name,
  plan_type,
  subscriber_name,
  subscriber_dob,
  subscriber_relationship,
  provider_participates_primary,
  coverage_start_date,
  coverage_end_date,
  deductible_amount,
  deductible_met,
  out_of_pocket_max,
  out_of_pocket_met,
  copay_amount,
  coinsurance_percent,
  dme_covered,
  wound_care_covered,
  prior_auth_required,
  prior_auth_number,
  prior_auth_start_date,
  prior_auth_end_date,
  units_authorized,
  verified_by,
  verified_date,
  verification_reference,
  secondary_insurance_provider,
  secondary_insurance_phone,
  secondary_subscriber_name,
  secondary_policy_number,
  secondary_subscriber_dob,
  secondary_plan_type,
  secondary_group_number,
  secondary_subscriber_relationship,
  provider_participates_secondary,
  wound_type,
  wound_sizes,
  application_cpts,
  date_of_procedure,
  icd10_codes,
  product_information,
  is_patient_at_snf,
  surgical_global_period,
  global_period_cpt,
  prior_auth_permission,
  form_notes
`;

async function fetchApproversByIds(
  ids: string[],
): Promise<Map<string, IExternalApprover>> {
  const out = new Map<string, IExternalApprover>();
  if (ids.length === 0) return out;
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("external_approvers")
    .select("id, name, email, is_active, created_at, updated_at")
    .in("id", Array.from(new Set(ids)));
  if (error || !data) {
    console.error("[fetchApproversByIds]", error);
    return out;
  }
  for (const a of data) {
    out.set(a.id as string, {
      id: a.id as string,
      name: a.name as string,
      email: a.email as string,
      isActive: Boolean(a.is_active),
      createdAt: (a.created_at as string) ?? "",
      updatedAt: (a.updated_at as string) ?? "",
    });
  }
  return out;
}

const FILE_SELECT = "id, standalone_ivr_id, file_path, file_name, mime_type, file_size, created_at";
const HISTORY_SELECT =
  "id, standalone_ivr_id, event, actor_id, actor_display, note, created_at";

function mapIvr(
  row: Record<string, unknown>,
  approver: IExternalApprover | null = null,
): IStandaloneIvr {
  // Supabase's PostgREST returns FK joins as EITHER a single object or a
  // single-element array depending on the client's type inference — same
  // row on the wire, different TS shape. Normalize before reading fields
  // so `facility.name` is never undefined by accident.
  const facilityRaw = row.facilities as unknown as
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  const facility = Array.isArray(facilityRaw)
    ? facilityRaw[0] ?? null
    : facilityRaw ?? null;
  return {
    id: row.id as string,
    status: row.status as IStandaloneIvr["status"],
    patientName: (row.patient_name as string | null) ?? null,
    patientDob: (row.patient_dob as string | null) ?? null,
    physicianName: (row.physician_name as string | null) ?? null,
    physicianNpi: (row.physician_npi as string | null) ?? null,
    facilityId: row.facility_id as string,
    productSummary: row.product_summary as string,
    assignedApproverId: (row.assigned_approver_id as string | null) ?? null,
    approvalToken: (row.approval_token as string | null) ?? null,
    approvalExpiresAt: (row.approval_expires_at as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    deniedAt: (row.denied_at as string | null) ?? null,
    denialReason: (row.denial_reason as string | null) ?? null,
    approverDisplayName: (row.approver_display_name as string | null) ?? null,
    approverIp: (row.approver_ip as string | null) ?? null,
    approverUserAgent: (row.approver_user_agent as string | null) ?? null,
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    convertedToOrderId: (row.converted_to_order_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    approver,
    facilityName: facility?.name ?? null,
    aiExtracted: Boolean(row.ai_extracted ?? false),
    aiExtractedAt: (row.ai_extracted_at as string | null) ?? null,
    form: mapIvrForm(row),
  };
}

/** Hydrates the nested `form` bag from a standalone_ivrs row. Every
 *  column is optional and defaults to null so we can return a full
 *  IStandaloneIvrForm even when nothing has been filled in yet. */
function mapIvrForm(row: Record<string, unknown>): IStandaloneIvrForm {
  const s = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const n = (v: unknown): number | null =>
    typeof v === "number"
      ? v
      : typeof v === "string" && v !== "" && !isNaN(Number(v))
        ? Number(v)
        : null;
  const b = (v: unknown): boolean | null =>
    typeof v === "boolean" ? v : null;
  return {
    salesRepName: s(row.sales_rep_name),
    placeOfService: s(row.place_of_service),
    specialtySiteName: s(row.specialty_site_name),
    medicareAdminContractor: s(row.medicare_admin_contractor),
    facilityName: s(row.facility_name),
    facilityAddress: s(row.facility_address),
    facilityContact: s(row.facility_contact),
    facilityPhone: s(row.facility_phone),
    facilityFax: s(row.facility_fax),
    facilityNpi: s(row.facility_npi),
    facilityTin: s(row.facility_tin),
    facilityPtan: s(row.facility_ptan),
    physicianPhone: s(row.physician_phone),
    physicianFax: s(row.physician_fax),
    physicianAddress: s(row.physician_address),
    physicianTin: s(row.physician_tin),
    patientPhone: s(row.patient_phone),
    patientAddress: s(row.patient_address),
    okToContactPatient: b(row.ok_to_contact_patient),
    insuranceProvider: s(row.insurance_provider),
    insurancePhone: s(row.insurance_phone),
    memberId: s(row.member_id),
    groupNumber: s(row.group_number),
    planName: s(row.plan_name),
    planType: s(row.plan_type),
    subscriberName: s(row.subscriber_name),
    subscriberDob: s(row.subscriber_dob),
    subscriberRelationship: s(row.subscriber_relationship),
    providerParticipatesPrimary: s(row.provider_participates_primary),
    coverageStartDate: s(row.coverage_start_date),
    coverageEndDate: s(row.coverage_end_date),
    deductibleAmount: n(row.deductible_amount),
    deductibleMet: n(row.deductible_met),
    outOfPocketMax: n(row.out_of_pocket_max),
    outOfPocketMet: n(row.out_of_pocket_met),
    copayAmount: n(row.copay_amount),
    coinsurancePercent: n(row.coinsurance_percent),
    dmeCovered: b(row.dme_covered),
    woundCareCovered: b(row.wound_care_covered),
    priorAuthRequired: b(row.prior_auth_required),
    priorAuthNumber: s(row.prior_auth_number),
    priorAuthStartDate: s(row.prior_auth_start_date),
    priorAuthEndDate: s(row.prior_auth_end_date),
    unitsAuthorized: n(row.units_authorized),
    verifiedBy: s(row.verified_by),
    verifiedDate: s(row.verified_date),
    verificationReference: s(row.verification_reference),
    secondaryInsuranceProvider: s(row.secondary_insurance_provider),
    secondaryInsurancePhone: s(row.secondary_insurance_phone),
    secondarySubscriberName: s(row.secondary_subscriber_name),
    secondaryPolicyNumber: s(row.secondary_policy_number),
    secondarySubscriberDob: s(row.secondary_subscriber_dob),
    secondaryPlanType: s(row.secondary_plan_type),
    secondaryGroupNumber: s(row.secondary_group_number),
    secondarySubscriberRelationship: s(
      row.secondary_subscriber_relationship,
    ),
    providerParticipatesSecondary: s(row.provider_participates_secondary),
    woundType: s(row.wound_type),
    woundSizes: s(row.wound_sizes),
    applicationCpts: s(row.application_cpts),
    dateOfProcedure: s(row.date_of_procedure),
    icd10Codes: s(row.icd10_codes),
    productInformation: s(row.product_information),
    isPatientAtSnf: b(row.is_patient_at_snf),
    surgicalGlobalPeriod: b(row.surgical_global_period),
    globalPeriodCpt: s(row.global_period_cpt),
    priorAuthPermission: b(row.prior_auth_permission),
    formNotes: s(row.form_notes),
  };
}

function mapFile(row: Record<string, unknown>): IStandaloneIvrFile {
  return {
    id: row.id as string,
    standaloneIvrId: row.standalone_ivr_id as string,
    filePath: row.file_path as string,
    fileName: row.file_name as string,
    mimeType: (row.mime_type as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapHistory(row: Record<string, unknown>): IStandaloneIvrHistoryEntry {
  return {
    id: row.id as string,
    standaloneIvrId: row.standalone_ivr_id as string,
    event: row.event as StandaloneIvrHistoryEvent,
    actorId: (row.actor_id as string | null) ?? null,
    actorDisplay: (row.actor_display as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getStandaloneIvrs(): Promise<IStandaloneIvr[]> {
  const supabase = await createClient();
  try {
    await getCurrentUserOrThrow(supabase);
  } catch {
    return [];
  }

  // RLS on the DB filters rows by role automatically. We don't need to
  // add role-specific WHERE clauses here — Postgres will return only
  // what the caller is allowed to see. Kept simple by design.
  void (await getUserRole(supabase));

  const { data, error } = await supabase
    .from("standalone_ivrs")
    .select(IVR_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getStandaloneIvrs]", error);
    return [];
  }
  const rows = data ?? [];
  const approverIds = rows
    .map((r) => (r as { assigned_approver_id: string | null }).assigned_approver_id)
    .filter((id): id is string => !!id);
  const approverMap = await fetchApproversByIds(approverIds);
  return rows.map((r) => {
    const raw = r as Record<string, unknown>;
    const approverId = raw.assigned_approver_id as string | null;
    return mapIvr(raw, approverId ? approverMap.get(approverId) ?? null : null);
  });
}

export async function getStandaloneIvrById(id: string): Promise<
  | (IStandaloneIvr & {
      files: IStandaloneIvrFile[];
      history: IStandaloneIvrHistoryEntry[];
    })
  | null
> {
  const supabase = await createClient();
  try {
    await getCurrentUserOrThrow(supabase);
  } catch {
    return null;
  }

  const { data: ivr, error } = await supabase
    .from("standalone_ivrs")
    .select(IVR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !ivr) return null;

  const [{ data: files }, { data: history }, approverMap] = await Promise.all([
    supabase
      .from("standalone_ivr_files")
      .select(FILE_SELECT)
      .eq("standalone_ivr_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("standalone_ivr_history")
      .select(HISTORY_SELECT)
      .eq("standalone_ivr_id", id)
      .order("created_at", { ascending: false }),
    // Approver hydration via admin client — same RLS bypass reason as
    // getStandaloneIvrs; the parent IVR row was already gated by this
    // caller's RLS so we can safely look up its one approver.
    (async () => {
      const approverId =
        (ivr as { assigned_approver_id: string | null }).assigned_approver_id;
      return approverId ? await fetchApproversByIds([approverId]) : new Map();
    })(),
  ]);

  const approverId =
    (ivr as { assigned_approver_id: string | null }).assigned_approver_id;
  return {
    ...mapIvr(
      ivr as Record<string, unknown>,
      approverId ? approverMap.get(approverId) ?? null : null,
    ),
    files: (files ?? []).map((f) => mapFile(f as Record<string, unknown>)),
    history: (history ?? []).map((h) =>
      mapHistory(h as Record<string, unknown>),
    ),
  };
}

/** Facilities the current user can create IVRs for. Admin/support see
 *  everything; clinic staff/providers see only theirs; reps see their
 *  covered facilities. Used to populate the Facility dropdown in the
 *  upload modal. */
export async function getUploadableFacilities(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!role) return [];

  // RLS on facilities table narrows the list per role — same pattern as
  // orders. We just fetch what the caller can see.
  const { data, error } = await supabase
    .from("facilities")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    console.error("[getUploadableFacilities]", error);
    return [];
  }
  return (data ?? []).map((f) => ({
    id: f.id as string,
    name: f.name as string,
  }));
}

export async function getActiveApprovers(): Promise<IExternalApprover[]> {
  const supabase = await createClient();
  try {
    await getCurrentUserOrThrow(supabase);
  } catch {
    return [];
  }

  // NOTE: the RLS policy on external_approvers restricts reads to
  // admin+support. Reps/clinic need to see the list to assign an IVR
  // to an approver, so we go through the admin client here — this is
  // read-only + strictly for the dropdown (only id/name/email exposed).
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("external_approvers")
    .select("id, name, email, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    console.error("[getActiveApprovers]", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

/* -------------------------------------------------------------------------- */
/* Signed uploads                                                             */
/*                                                                            */
/* Same 3-step client-side upload pattern as order-document-actions.ts:       */
/*  1. Server signs a one-time upload URL under our bucket path               */
/*  2. Browser uploads bytes directly to Storage using the signed token       */
/*  3. Server registers the file row on the standalone IVR                    */
/* Avoids Vercel's 4.5 MB Server Action body cap.                             */
/* -------------------------------------------------------------------------- */

const ALLOWED_IVR_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_IVR_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file, Q7 defaults

export async function prepareIvrFileUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<
  | { success: true; bucket: string; filePath: string; uploadToken: string }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    if (input.size > MAX_IVR_FILE_BYTES) {
      const mb = (input.size / 1024 / 1024).toFixed(1);
      return {
        success: false,
        error: `File is ${mb}MB — max 25MB per IVR file.`,
      };
    }
    if (!ALLOWED_IVR_MIMES.has(input.mimeType)) {
      return {
        success: false,
        error: "Unsupported file type. Use PDF, DOC, DOCX, JPG, PNG, or HEIC.",
      };
    }

    const adminClient = createAdminClient();
    const timestamp = Date.now();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    // Files land under a temp prefix keyed by uploader — moved into the
    // IVR's folder once the IVR row is created. Keeps orphaned uploads
    // easy to clean up if the user abandons the modal.
    const {
      data: { user },
    } = await adminClient.auth.admin.getUserById(
      (await supabase.auth.getUser()).data.user!.id,
    );
    const filePath = `standalone-ivrs/_upload/${user!.id}/${timestamp}-${safeName}`;

    const { data, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(filePath);
    if (error || !data) {
      console.error("[prepareIvrFileUpload]", error);
      return { success: false, error: "Failed to prepare upload." };
    }
    return {
      success: true,
      bucket: BUCKET,
      filePath,
      uploadToken: data.token,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Create / edit / delete                                                     */
/* -------------------------------------------------------------------------- */

interface CreateIvrInput {
  // Patient / physician / product metadata is now optional — all of it
  // lives inside the uploaded IVR PDF (Dr. Ben feedback 2026-07-07).
  // Kept in the interface as nullable so callers that used to pass real
  // values still compile; upgrade calls to pass null unless there's a
  // specific reason to keep it.
  patientName?: string | null;
  patientDob?: string | null;
  physicianName?: string | null;
  physicianNpi?: string | null;
  facilityId: string;
  productSummary?: string | null;
  assignedApproverId: string;
  files: Array<{
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
}

async function insertIvrHistory(
  adminClient: ReturnType<typeof createAdminClient>,
  ivrId: string,
  event: StandaloneIvrHistoryEvent,
  actorId: string | null,
  note?: string | null,
): Promise<void> {
  const { error } = await adminClient.from("standalone_ivr_history").insert({
    standalone_ivr_id: ivrId,
    event,
    actor_id: actorId,
    note: note ?? null,
  });
  if (error) console.error("[insertIvrHistory]", error);
}

export async function createStandaloneIvr(
  input: CreateIvrInput,
): Promise<
  | { success: true; ivr: IStandaloneIvr }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    // Only facility + approver + at least one file are required now —
    // patient/physician/product metadata is inside the PDF.
    if (!input.facilityId) {
      return { success: false, error: "Facility is required." };
    }
    if (!input.assignedApproverId) {
      return { success: false, error: "Assigned approver is required." };
    }
    if (!Array.isArray(input.files) || input.files.length === 0) {
      return { success: false, error: "At least one file is required." };
    }

    // Verify the facility is one the caller can access (RLS-scoped read).
    const { data: fac } = await supabase
      .from("facilities")
      .select("id")
      .eq("id", input.facilityId)
      .maybeSingle();
    if (!fac) {
      return {
        success: false,
        error: "You do not have access to that facility.",
      };
    }

    // Insert the IVR row via the user's client so RLS enforces authorship.
    const { data: ivr, error: insertErr } = await supabase
      .from("standalone_ivrs")
      .insert({
        status: "draft",
        patient_name: input.patientName?.trim() || null,
        patient_dob: input.patientDob?.trim() || null,
        physician_name: input.physicianName?.trim() || null,
        physician_npi: input.physicianNpi?.trim() || null,
        facility_id: input.facilityId,
        product_summary: input.productSummary?.trim() || null,
        assigned_approver_id: input.assignedApproverId,
        uploaded_by: user.id,
      })
      .select(IVR_SELECT)
      .single();
    if (insertErr || !ivr) {
      console.error("[createStandaloneIvr] insert", insertErr);
      return { success: false, error: "Failed to create IVR record." };
    }

    // Move each file from its temp _upload/ path into the IVR's folder,
    // then register in standalone_ivr_files. Admin client is fine here —
    // the parent IVR row was just created under the user's identity so
    // RLS on the file rows will still line up on subsequent reads.
    const finalizedFiles: Array<Record<string, unknown>> = [];
    for (const f of input.files) {
      const finalPath = f.filePath.startsWith("standalone-ivrs/_upload/")
        ? `standalone-ivrs/${ivr.id}/${f.filePath.split("/").slice(-1)[0]}`
        : f.filePath;

      if (finalPath !== f.filePath) {
        const { error: moveErr } = await adminClient.storage
          .from(BUCKET)
          .move(f.filePath, finalPath);
        if (moveErr) {
          console.error("[createStandaloneIvr] move", moveErr, {
            from: f.filePath,
            to: finalPath,
          });
          // Fall back to registering the file at its temp path so the
          // IVR isn't lost — worst case the file lives in a slightly
          // less tidy folder.
        }
      }
      finalizedFiles.push({
        standalone_ivr_id: ivr.id,
        file_path: finalPath,
        file_name: f.fileName,
        mime_type: f.mimeType,
        file_size: f.fileSize,
      });
    }
    if (finalizedFiles.length > 0) {
      const { error: filesErr } = await adminClient
        .from("standalone_ivr_files")
        .insert(finalizedFiles);
      if (filesErr) {
        console.error("[createStandaloneIvr] file rows", filesErr);
      }
    }

    await insertIvrHistory(
      adminClient,
      ivr.id as string,
      "created",
      user.id,
      `${finalizedFiles.length} file(s) uploaded`,
    );

    revalidatePath(IVRS_PATH);
    return { success: true, ivr: mapIvr(ivr as Record<string, unknown>) };
  } catch (err) {
    console.error("[createStandaloneIvr]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* createStandaloneIvrFromFax                                                 */
/*                                                                            */
/* Fax-intake → IVR handoff. Called from the intake surface's "Build IVR"     */
/* modal. Semantics differ from createStandaloneIvr in two ways:              */
/*                                                                            */
/*  1. No external approver. The faxed IVR IS the approved artifact from     */
/*     the client-side approver's office — the save action IS the approval   */
/*     step, so we insert status='approved' and stamp approver_display_name  */
/*     = 'Approved from fax intake' + approved_at = now(). The IVRs list     */
/*     detects the fax origin via that display-name prefix and shows a       */
/*     "From Fax" chip.                                                       */
/*                                                                            */
/*  2. Storage bytes are COPIED from the intake path                          */
/*     (intake/{intakeId}.pdf) to standalone-ivrs/{ivrId}/{name}.pdf so the   */
/*     existing getIvrFileSignedUrl path-authorization regex still works and  */
/*     dismissing the intake later doesn't break the IVR preview. The intake  */
/*     row is then flipped to converted_ivr with converted_to_id=ivrId so     */
/*     the fax stops appearing in the pending inbox.                          */
/* -------------------------------------------------------------------------- */

const FAX_INTAKE_APPROVAL_MARKER = "Approved from fax intake";

/**
 * Whitelist of standalone_ivrs columns the "rich IVR form" is allowed
 * to write. Keyed by the interface field name (camelCase); value is the
 * DB column name. Used by both createStandaloneIvrFromFax (initial
 * save) and saveStandaloneIvrForm (subsequent edits) so the two paths
 * can't drift on which fields are persistable.
 */
const FORM_COLUMN_MAP: Record<keyof IStandaloneIvrForm, string> = {
  salesRepName: "sales_rep_name",
  placeOfService: "place_of_service",
  specialtySiteName: "specialty_site_name",
  medicareAdminContractor: "medicare_admin_contractor",
  facilityName: "facility_name",
  facilityAddress: "facility_address",
  facilityContact: "facility_contact",
  facilityPhone: "facility_phone",
  facilityFax: "facility_fax",
  facilityNpi: "facility_npi",
  facilityTin: "facility_tin",
  facilityPtan: "facility_ptan",
  physicianPhone: "physician_phone",
  physicianFax: "physician_fax",
  physicianAddress: "physician_address",
  physicianTin: "physician_tin",
  patientPhone: "patient_phone",
  patientAddress: "patient_address",
  okToContactPatient: "ok_to_contact_patient",
  insuranceProvider: "insurance_provider",
  insurancePhone: "insurance_phone",
  memberId: "member_id",
  groupNumber: "group_number",
  planName: "plan_name",
  planType: "plan_type",
  subscriberName: "subscriber_name",
  subscriberDob: "subscriber_dob",
  subscriberRelationship: "subscriber_relationship",
  providerParticipatesPrimary: "provider_participates_primary",
  coverageStartDate: "coverage_start_date",
  coverageEndDate: "coverage_end_date",
  deductibleAmount: "deductible_amount",
  deductibleMet: "deductible_met",
  outOfPocketMax: "out_of_pocket_max",
  outOfPocketMet: "out_of_pocket_met",
  copayAmount: "copay_amount",
  coinsurancePercent: "coinsurance_percent",
  dmeCovered: "dme_covered",
  woundCareCovered: "wound_care_covered",
  priorAuthRequired: "prior_auth_required",
  priorAuthNumber: "prior_auth_number",
  priorAuthStartDate: "prior_auth_start_date",
  priorAuthEndDate: "prior_auth_end_date",
  unitsAuthorized: "units_authorized",
  verifiedBy: "verified_by",
  verifiedDate: "verified_date",
  verificationReference: "verification_reference",
  secondaryInsuranceProvider: "secondary_insurance_provider",
  secondaryInsurancePhone: "secondary_insurance_phone",
  secondarySubscriberName: "secondary_subscriber_name",
  secondaryPolicyNumber: "secondary_policy_number",
  secondarySubscriberDob: "secondary_subscriber_dob",
  secondaryPlanType: "secondary_plan_type",
  secondaryGroupNumber: "secondary_group_number",
  secondarySubscriberRelationship: "secondary_subscriber_relationship",
  providerParticipatesSecondary: "provider_participates_secondary",
  woundType: "wound_type",
  woundSizes: "wound_sizes",
  applicationCpts: "application_cpts",
  dateOfProcedure: "date_of_procedure",
  icd10Codes: "icd10_codes",
  productInformation: "product_information",
  isPatientAtSnf: "is_patient_at_snf",
  surgicalGlobalPeriod: "surgical_global_period",
  globalPeriodCpt: "global_period_cpt",
  priorAuthPermission: "prior_auth_permission",
  formNotes: "form_notes",
};

/**
 * Turn a partial rich-form patch (interface camelCase, whatever
 * subset the caller provided) into a DB row (snake_case). Unknown
 * keys are silently dropped — the whitelist is the boundary.
 * Empty strings collapse to null so the DB doesn't hold `""` values
 * that would break date parsing on the way back out.
 */
function formPatchToRow(
  patch: Partial<IStandaloneIvrForm>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, colName] of Object.entries(FORM_COLUMN_MAP)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.trim() === "") {
      row[colName] = null;
    } else {
      row[colName] = raw ?? null;
    }
  }
  return row;
}

export async function createStandaloneIvrFromFax(input: {
  intakeId: string;
  facilityId: string;
  patientName?: string | null;
  patientDob?: string | null;
  physicianName?: string | null;
  physicianNpi?: string | null;
  productSummary?: string | null;
  /** Every editable field on the rich IVR form. Optional — the modal
   *  can save early with just the top-level metadata and the user can
   *  fill the rest later via saveStandaloneIvrForm on /dashboard/ivrs. */
  form?: Partial<IStandaloneIvrForm>;
  /** Set true when the values came from AI pre-fill so we can stamp
   *  ai_extracted_at for observability. User edits after save don't
   *  reset this. */
  aiExtracted?: boolean;
}): Promise<
  | { success: true; ivr: IStandaloneIvr }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);
    if (role !== "admin" && role !== "support_staff") {
      return {
        success: false,
        error: "Only admin or support staff can build an IVR from a fax.",
      };
    }
    if (!input.intakeId) {
      return { success: false, error: "Missing intake reference." };
    }
    if (!input.facilityId) {
      return {
        success: false,
        error: "Pick which clinic this IVR belongs to.",
      };
    }

    const adminClient = createAdminClient();

    // Load the intake row (admin — RLS is already tight, and we need the
    // storage path either way). Fail early if it's not pending — a
    // double-submit shouldn't spawn two IVRs from the same fax.
    const { data: intake, error: intakeErr } = await adminClient
      .from("intake_documents")
      .select("id, status, bucket, file_path, file_name, mime_type, file_size")
      .eq("id", input.intakeId)
      .maybeSingle();
    if (intakeErr || !intake) {
      return { success: false, error: "Intake not found." };
    }
    if (intake.status !== "pending") {
      return {
        success: false,
        error: "This fax has already been triaged.",
      };
    }

    // Verify caller can access the target facility. Admin/support have
    // broad RLS on facilities, so this is really a "does it exist"
    // check — but running it through the user client keeps the auth
    // model consistent with createStandaloneIvr.
    const { data: fac } = await supabase
      .from("facilities")
      .select("id")
      .eq("id", input.facilityId)
      .maybeSingle();
    if (!fac) {
      return {
        success: false,
        error: "That facility isn't available to you.",
      };
    }

    // Insert the standalone_ivrs row (admin — we're setting fields the
    // user's INSERT policy wouldn't allow, namely status='approved').
    // The rich-form patch is spread on top of the top-level metadata
    // so single-source save covers both.
    const nowIso = new Date().toISOString();
    const formRow = input.form ? formPatchToRow(input.form) : {};
    const { data: ivr, error: insertErr } = await adminClient
      .from("standalone_ivrs")
      .insert({
        ...formRow,
        status: "approved",
        patient_name: input.patientName?.trim() || null,
        patient_dob: input.patientDob?.trim() || null,
        physician_name: input.physicianName?.trim() || null,
        physician_npi: input.physicianNpi?.trim() || null,
        facility_id: input.facilityId,
        product_summary: input.productSummary?.trim() || null,
        assigned_approver_id: null,
        approver_display_name: FAX_INTAKE_APPROVAL_MARKER,
        approved_at: nowIso,
        uploaded_by: user.id,
        ai_extracted: input.aiExtracted ?? false,
        ai_extracted_at: input.aiExtracted ? nowIso : null,
      })
      .select(IVR_SELECT)
      .single();
    if (insertErr || !ivr) {
      console.error("[createStandaloneIvrFromFax] insert", insertErr);
      return { success: false, error: "Failed to create IVR record." };
    }

    // Copy the fax bytes into the standalone-ivrs prefix so the IVR
    // preview goes through the standard getIvrFileSignedUrl regex and
    // survives the intake row being dismissed later. `.copy` is a
    // server-side S3 copy — no bytes traverse Vercel.
    const fileName =
      (intake.file_name as string | null) ?? `fax-${intake.id}.pdf`;
    const destPath = `standalone-ivrs/${ivr.id}/${fileName}`;
    const { error: copyErr } = await adminClient.storage
      .from(intake.bucket as string)
      .copy(intake.file_path as string, destPath);
    if (copyErr) {
      // Roll back the IVR row so the user can retry. Copy failures here
      // are usually a storage-permission drift — better to fail loud
      // than leave a dangling IVR with no attached file.
      console.error("[createStandaloneIvrFromFax] storage.copy", copyErr);
      await adminClient
        .from("standalone_ivrs")
        .delete()
        .eq("id", ivr.id as string);
      return {
        success: false,
        error: "Failed to copy the fax file into the IVR record.",
      };
    }

    const { error: fileInsertErr } = await adminClient
      .from("standalone_ivr_files")
      .insert({
        standalone_ivr_id: ivr.id,
        file_path: destPath,
        file_name: fileName,
        mime_type:
          (intake.mime_type as string | null) ?? "application/pdf",
        file_size: (intake.file_size as number | null) ?? null,
      });
    if (fileInsertErr) {
      console.error("[createStandaloneIvrFromFax] file row", fileInsertErr);
      // Non-fatal — the IVR row exists and the storage bytes exist; the
      // user can re-attach from the IVR detail modal if needed.
    }

    // Two history entries: creation + implicit approval. Notes carry the
    // origin so a future audit can trace back to the fax.
    await insertIvrHistory(
      adminClient,
      ivr.id as string,
      "created",
      user.id,
      `Built from fax intake ${input.intakeId}`,
    );
    await insertIvrHistory(
      adminClient,
      ivr.id as string,
      "approved",
      user.id,
      FAX_INTAKE_APPROVAL_MARKER,
    );

    // Flip the intake to converted_ivr so it drops off the pending list.
    const { error: intakeUpdErr } = await adminClient
      .from("intake_documents")
      .update({
        status: "converted_ivr",
        converted_to_type: "standalone_ivr",
        converted_to_id: ivr.id,
        converted_at: nowIso,
        converted_by: user.id,
        updated_at: nowIso,
      })
      .eq("id", input.intakeId);
    if (intakeUpdErr) {
      console.error(
        "[createStandaloneIvrFromFax] intake update",
        intakeUpdErr,
      );
      // Non-fatal — the IVR is real; worst case the fax lingers as pending
      // and the user manually dismisses it.
    }

    revalidatePath(IVRS_PATH);
    revalidatePath("/dashboard/intake");
    return { success: true, ivr: mapIvr(ivr as Record<string, unknown>) };
  } catch (err) {
    console.error("[createStandaloneIvrFromFax]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/**
 * Save (or re-save) the rich IVR form for a standalone IVR. Called
 * from the "Build IVR from fax" modal and from a future editable view
 * on /dashboard/ivrs.
 *
 * The write goes through the admin client so we can bypass the
 * "draft-only" status gate that updateStandaloneIvr enforces — a
 * fax-originated IVR lands as 'approved' immediately (save IS the
 * approval) and still needs to remain editable for typo fixes before
 * the user converts it to an order. RLS-scoped read up front is what
 * keeps this admin-write from being an authorization hole.
 */
export async function saveStandaloneIvrForm(
  id: string,
  patch: Partial<IStandaloneIvrForm> & {
    patientName?: string | null;
    patientDob?: string | null;
    physicianName?: string | null;
    physicianNpi?: string | null;
    productSummary?: string | null;
  },
): Promise<
  | { success: true; ivr: IStandaloneIvr }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // Confirm the caller can see the IVR via RLS. If they can't, they
    // can't edit it either — even though the actual write below uses
    // admin client to bypass the draft-only UPDATE policy.
    const { data: existing } = await supabase
      .from("standalone_ivrs")
      .select("id, status, converted_to_order_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return { success: false, error: "IVR not found or access denied." };
    }
    if (existing.converted_to_order_id) {
      // Once the IVR has become an order, edits should go through the
      // order's IVR tab so the same edit doesn't have to be replayed
      // on both records.
      return {
        success: false,
        error:
          "This IVR has already been converted to an order — edit the order's IVR tab instead.",
      };
    }

    const adminClient = createAdminClient();

    // Split the patch: top-level metadata columns are updated as-is,
    // form columns go through the map so the whitelist keeps us honest.
    const formOnly: Partial<IStandaloneIvrForm> = { ...patch };
    delete (formOnly as Record<string, unknown>).patientName;
    delete (formOnly as Record<string, unknown>).patientDob;
    delete (formOnly as Record<string, unknown>).physicianName;
    delete (formOnly as Record<string, unknown>).physicianNpi;
    delete (formOnly as Record<string, unknown>).productSummary;

    const row: Record<string, unknown> = {
      ...formPatchToRow(formOnly),
      updated_at: new Date().toISOString(),
    };
    if ("patientName" in patch)
      row.patient_name = patch.patientName?.trim() || null;
    if ("patientDob" in patch)
      row.patient_dob = patch.patientDob?.trim() || null;
    if ("physicianName" in patch)
      row.physician_name = patch.physicianName?.trim() || null;
    if ("physicianNpi" in patch)
      row.physician_npi = patch.physicianNpi?.trim() || null;
    if ("productSummary" in patch)
      row.product_summary = patch.productSummary?.trim() || null;

    const { data: updated, error: updErr } = await adminClient
      .from("standalone_ivrs")
      .update(row)
      .eq("id", id)
      .select(IVR_SELECT)
      .single();
    if (updErr || !updated) {
      console.error("[saveStandaloneIvrForm] update", updErr);
      return { success: false, error: "Failed to save IVR form." };
    }

    await insertIvrHistory(
      adminClient,
      id,
      "edited",
      user.id,
      "Rich IVR form updated",
    );

    revalidatePath(IVRS_PATH);
    return { success: true, ivr: mapIvr(updated as Record<string, unknown>) };
  } catch (err) {
    console.error("[saveStandaloneIvrForm]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function updateStandaloneIvr(
  id: string,
  patch: Partial<{
    patientName: string;
    patientDob: string;
    physicianName: string;
    physicianNpi: string | null;
    facilityId: string;
    productSummary: string;
    assignedApproverId: string;
  }>,
): Promise<
  | { success: true; ivr: IStandaloneIvr }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // Only draft IVRs can be edited — once sent, the record is immutable
    // metadata-wise (approver has to see what was actually sent).
    const { data: current } = await supabase
      .from("standalone_ivrs")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return { success: false, error: "IVR not found or access denied." };
    }
    if (current.status !== "draft") {
      return {
        success: false,
        error: "Only draft IVRs can be edited.",
      };
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.patientName !== undefined) payload.patient_name = patch.patientName.trim();
    if (patch.patientDob !== undefined) payload.patient_dob = patch.patientDob;
    if (patch.physicianName !== undefined) payload.physician_name = patch.physicianName.trim();
    if (patch.physicianNpi !== undefined) payload.physician_npi = patch.physicianNpi?.trim() || null;
    if (patch.facilityId !== undefined) payload.facility_id = patch.facilityId;
    if (patch.productSummary !== undefined) payload.product_summary = patch.productSummary.trim();
    if (patch.assignedApproverId !== undefined) payload.assigned_approver_id = patch.assignedApproverId;

    const { data, error } = await supabase
      .from("standalone_ivrs")
      .update(payload)
      .eq("id", id)
      .select(IVR_SELECT)
      .single();
    if (error || !data) {
      console.error("[updateStandaloneIvr]", error);
      return { success: false, error: "Failed to update IVR." };
    }

    await insertIvrHistory(
      createAdminClient(),
      id,
      "edited",
      user.id,
      Object.keys(payload).filter((k) => k !== "updated_at").join(", "),
    );

    revalidatePath(IVRS_PATH);
    return { success: true, ivr: mapIvr(data as Record<string, unknown>) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function deleteStandaloneIvr(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    // Draft only — once sent, deletion would orphan approval tokens
    // that may already be in flight.
    const { data: current } = await supabase
      .from("standalone_ivrs")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { success: false, error: "IVR not found." };
    if (current.status !== "draft") {
      return { success: false, error: "Only draft IVRs can be deleted." };
    }

    // Best-effort storage cleanup: pull file paths, delete rows, then
    // ask Storage to remove the objects. Storage errors don't block the
    // DB delete because the DB rows are the source of truth.
    const { data: files } = await supabase
      .from("standalone_ivr_files")
      .select("file_path")
      .eq("standalone_ivr_id", id);

    const { error: delErr } = await supabase
      .from("standalone_ivrs")
      .delete()
      .eq("id", id);
    if (delErr) {
      console.error("[deleteStandaloneIvr]", delErr);
      return { success: false, error: "Failed to delete IVR." };
    }

    if (files && files.length > 0) {
      const paths = files.map((f) => f.file_path as string);
      const adminClient = createAdminClient();
      await adminClient.storage
        .from(BUCKET)
        .remove(paths)
        .catch((e) => console.error("[deleteStandaloneIvr] storage", e));
    }

    revalidatePath(IVRS_PATH);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/** Signed URL for viewing/downloading a file. 15-min TTL — PHI-adjacent. */
export async function getIvrFileSignedUrl(
  filePath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    // Verify the current user can see the parent IVR before signing.
    // The path shape is standalone-ivrs/<ivrId>/... — pull the IVR id
    // and hit standalone_ivrs (RLS scoped) to confirm access.
    const match = filePath.match(/^standalone-ivrs\/([0-9a-f-]{36})\//i);
    if (!match) return { url: null, error: "Invalid file path." };
    const ivrId = match[1];
    const { data } = await supabase
      .from("standalone_ivrs")
      .select("id")
      .eq("id", ivrId)
      .maybeSingle();
    if (!data) return { url: null, error: "Access denied." };

    const adminClient = createAdminClient();
    const { data: signed, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 15);
    if (error || !signed?.signedUrl) {
      return { url: null, error: "Failed to create signed URL." };
    }
    return { url: signed.signedUrl };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Send drafts to their assigned approver                                     */
/*                                                                            */
/* Groups the requested draft IVRs by assigned_approver_id and sends ONE      */
/* summary email per approver (per Dr. Ben Q4). Each IVR gets its own         */
/* random approval token with a 30-day TTL (Q5), so approvers can still act   */
/* on them individually — the email is just a nicer delivery mechanism than   */
/* N separate emails per approver.                                            */
/* -------------------------------------------------------------------------- */

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days per Q5

function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function sendIvrsForApproval(
  ivrIds: string[],
): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    if (!Array.isArray(ivrIds) || ivrIds.length === 0) {
      return { success: false, error: "No IVRs selected." };
    }

    // Step 1: RLS-scoped fetch of just the IVR IDs the caller can see.
    // We DELIBERATELY don't select the joined external_approvers here —
    // that table's RLS is admin+support only, so a clinic-role caller
    // gets back a null join for the approver. That was the root cause
    // of the "No IVRs have an active approver assigned" toast when a
    // provider hit Send for Approval on a properly-approved-set IVR.
    const { data: rows, error: readErr } = await supabase
      .from("standalone_ivrs")
      .select(
        `id, patient_name, patient_dob, physician_name, product_summary,
         status, assigned_approver_id`,
      )
      .in("id", ivrIds);
    if (readErr) {
      console.error("[sendIvrsForApproval] fetch", readErr);
      return { success: false, error: "Failed to read IVRs." };
    }
    const drafts = (rows ?? []).filter((r) => r.status === "draft");
    if (drafts.length === 0) {
      return { success: false, error: "No draft IVRs to send." };
    }

    // Step 2: fetch the approver records via admin client (RLS bypass).
    // Only pull the ones actually referenced by the drafts and only
    // active ones. Same pattern as getActiveApprovers — the auth check
    // already happened in step 1 by requiring RLS access to each IVR.
    const adminForRead = createAdminClient();
    const approverIds = Array.from(
      new Set(
        drafts
          .map((d) => d.assigned_approver_id as string | null)
          .filter((id): id is string => !!id),
      ),
    );
    const approverById = new Map<
      string,
      { id: string; name: string; email: string; is_active: boolean }
    >();
    if (approverIds.length > 0) {
      const { data: approverRows } = await adminForRead
        .from("external_approvers")
        .select("id, name, email, is_active")
        .in("id", approverIds);
      for (const a of approverRows ?? []) {
        approverById.set(a.id as string, {
          id: a.id as string,
          name: a.name as string,
          email: a.email as string,
          is_active: Boolean(a.is_active),
        });
      }
    }

    // Group by approver — skip any IVR whose approver is missing or
    // deactivated. Those get flagged in the response as skipped.
    const buckets = new Map<
      string,
      {
        approver: { id: string; name: string; email: string };
        ivrs: typeof drafts;
      }
    >();
    for (const d of drafts) {
      const approverId = d.assigned_approver_id as string | null;
      const ap = approverId ? approverById.get(approverId) ?? null : null;
      if (!ap || !ap.is_active) continue;
      if (!buckets.has(ap.id)) {
        buckets.set(ap.id, {
          approver: { id: ap.id, name: ap.name, email: ap.email },
          ivrs: [],
        });
      }
      buckets.get(ap.id)!.ivrs.push(d);
    }
    if (buckets.size === 0) {
      return {
        success: false,
        error: "No IVRs have an active approver assigned.",
      };
    }

    // Stamp each IVR with a token + expiry BEFORE sending — this needs
    // the admin client because setting approval_token is a system-level
    // action, not one the caller directly authors.
    const adminClient = createAdminClient();
    const now = Date.now();
    const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();
    const nowIso = new Date(now).toISOString();

    let sentCount = 0;
    for (const [_, bucket] of buckets) {
      // Assign fresh tokens for each IVR going out.
      const tokenMap = new Map<string, string>();
      for (const ivr of bucket.ivrs) {
        const token = randomUUID();
        tokenMap.set(ivr.id, token);
        const { error: upErr } = await adminClient
          .from("standalone_ivrs")
          .update({
            approval_token: token,
            approval_expires_at: expiresAt,
            sent_at: nowIso,
            status: "sent",
            updated_at: nowIso,
          })
          .eq("id", ivr.id);
        if (upErr) {
          console.error("[sendIvrsForApproval] update", upErr, { ivrId: ivr.id });
          continue;
        }
        await adminClient.from("standalone_ivr_history").insert({
          standalone_ivr_id: ivr.id,
          event: "sent",
          actor_id: user.id,
          note: `Sent to ${bucket.approver.name}`,
        });
      }

      // Pull the first file name for each IVR in this bucket so the
      // email can fall back to it when patient_name is null (the new
      // default since 2026-07-07 — patient info stays in the PDF).
      // One admin query per bucket keeps this cheap.
      const bucketIvrIds = bucket.ivrs.map((i) => i.id as string);
      const { data: fileRows } = await adminForRead
        .from("standalone_ivr_files")
        .select("standalone_ivr_id, file_name, created_at")
        .in("standalone_ivr_id", bucketIvrIds)
        .order("created_at", { ascending: true });
      const firstFileByIvr = new Map<string, string>();
      for (const f of fileRows ?? []) {
        const iid = f.standalone_ivr_id as string;
        if (!firstFileByIvr.has(iid)) {
          firstFileByIvr.set(iid, f.file_name as string);
        }
      }

      // Build + send ONE summary email for this approver.
      const email = buildIvrApprovalEmail({
        approverName: bucket.approver.name,
        approverEmail: bucket.approver.email,
        senderOrgName: "Meridian Portal",
        ivrs: bucket.ivrs.map((i) => ({
          patientName: (i.patient_name as string | null) ?? null,
          patientDob: (i.patient_dob as string | null) ?? null,
          physicianName: (i.physician_name as string | null) ?? null,
          productSummary: (i.product_summary as string | null) ?? null,
          fileName: firstFileByIvr.get(i.id as string) ?? null,
          reviewUrl: absoluteUrl(`/ivr-decision/${tokenMap.get(i.id)}`),
        })),
        expiresLabel: "30 days",
      });

      try {
        await paubox.emails.send({
          from: ACCOUNTS_FROM_EMAIL,
          to: bucket.approver.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        sentCount += bucket.ivrs.length;
      } catch (err) {
        console.error("[sendIvrsForApproval] paubox", err);
        // Revert the IVRs in this bucket so they can be re-tried.
        for (const ivr of bucket.ivrs) {
          await adminClient
            .from("standalone_ivrs")
            .update({
              status: "draft",
              approval_token: null,
              approval_expires_at: null,
              sent_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", ivr.id);
        }
      }
    }

    revalidatePath(IVRS_PATH);
    return { success: true, sent: sentCount };
  } catch (err) {
    console.error("[sendIvrsForApproval]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Convert approved IVR → order                                               */
/*                                                                            */
/* Clinic staff (and every role that can see IVRs — Q6) uses this to spin an  */
/* approved IVR into a portal order. The order lands in DRAFT with:           */
/*   - facility + wound_type + order_type=skin_grafts                         */
/*   - order_ivr row seeded with the IVR's patient/physician/etc metadata,    */
/*     linked back to the source via linked_standalone_ivr_id                 */
/*   - the IVR's uploaded PDFs copied to order_documents as uploaded_ivr      */
/* The standalone IVR flips to `converted` and its converted_to_order_id      */
/* points at the new row. The clinic then adds products + completes the       */
/* order form.                                                                */
/* -------------------------------------------------------------------------- */

export async function convertIvrToOrder(input: {
  ivrId: string;
  woundType: "chronic" | "post_surgical" | "dfu" | "vlu";
  dateOfService?: string; // YYYY-MM-DD, defaults to today
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    // Load the IVR + files under the caller's RLS scope — if they can't
    // see it, they can't convert it. `select("*")` because we need
    // every rich-form column to copy over to order_ivr and enumerating
    // them again would drift from FORM_COLUMN_MAP over time. We cast
    // to Record<string, unknown> for the copy loop below — Supabase's
    // generic type inference can't type-check a splat select against
    // a dynamic column list anyway.
    const { data: ivrRow } = await supabase
      .from("standalone_ivrs")
      .select("*")
      .eq("id", input.ivrId)
      .maybeSingle();
    if (!ivrRow) {
      return { success: false, error: "IVR not found or access denied." };
    }
    const ivr = ivrRow as unknown as Record<string, unknown> & {
      id: string;
      status: string;
      patient_name: string | null;
      patient_dob: string | null;
      physician_name: string | null;
      physician_npi: string | null;
      facility_id: string;
      product_summary: string | null;
      converted_to_order_id: string | null;
    };
    if (ivr.status !== "approved") {
      return {
        success: false,
        error: `Only approved IVRs can be converted (this one is ${ivr.status}).`,
      };
    }
    if (ivr.converted_to_order_id) {
      return {
        success: true,
        orderId: ivr.converted_to_order_id as string,
        error: "IVR was already converted; opening existing order.",
      };
    }

    const { data: ivrFiles } = await supabase
      .from("standalone_ivr_files")
      .select("id, file_path, file_name, mime_type, file_size")
      .eq("standalone_ivr_id", input.ivrId);

    // 1. Create the order.
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        facility_id: ivr.facility_id,
        order_status: "draft",
        created_by: user.id,
        wound_type: input.woundType,
        date_of_service:
          input.dateOfService ?? new Date().toISOString().split("T")[0],
        order_type: "skin_grafts",
        notes: `Created from approved IVR ${orderNumber}. Original IVR products: ${ivr.product_summary}`,
      })
      .select("id, order_number")
      .single();
    if (orderErr || !order) {
      console.error("[convertIvrToOrder] order insert", orderErr);
      return { success: false, error: "Failed to create order." };
    }

    // 2. Seed order_ivr — carry every rich-form column over and link
    // back to the standalone IVR for the approval banner. Same column
    // names both sides, so this is a dumb 1:1 copy driven by
    // FORM_COLUMN_MAP.
    const formCopy: Record<string, unknown> = {};
    for (const col of Object.values(FORM_COLUMN_MAP)) {
      // order_ivr doesn't have form_notes — that's the standalone-only
      // back-office field. Skip it during the copy; if we ever add it
      // to order_ivr we can drop this exception.
      if (col === "form_notes") continue;
      const val = (ivr as Record<string, unknown>)[col];
      if (val !== undefined && val !== null) formCopy[col] = val;
    }
    const { error: ivrRowErr } = await adminClient.from("order_ivr").insert({
      ...formCopy,
      order_id: order.id,
      patient_name: ivr.patient_name,
      patient_dob: ivr.patient_dob,
      physician_name: ivr.physician_name,
      physician_npi: ivr.physician_npi,
      // product_information from the form takes precedence when filled;
      // otherwise fall back to the summary the uploader typed.
      product_information:
        (formCopy.product_information as string | undefined) ??
        ivr.product_summary,
      linked_standalone_ivr_id: ivr.id,
      // Default to 'built' now — the rich form on the standalone side
      // gave us real data to display in the order's IVR tab. The fax
      // PDF is ALSO attached as an uploaded_ivr doc below so it stays
      // one click away for reference, and the user can toggle to
      // 'uploaded' mode if they'd rather see the fax as source of
      // truth.
      ivr_mode: "built",
    });
    if (ivrRowErr) {
      console.error("[convertIvrToOrder] order_ivr insert", ivrRowErr);
      // Best-effort rollback: delete the order to avoid an orphaned row.
      await adminClient.from("orders").delete().eq("id", order.id);
      return { success: false, error: "Failed to seed IVR data on order." };
    }

    // 3. Copy the IVR files into order_documents. Storage objects stay put
    // (both surfaces reference the same path) — this is metadata-only so
    // the order's documents sidebar renders them under uploaded_ivr.
    if (ivrFiles && ivrFiles.length > 0) {
      const docRows = ivrFiles.map((f) => ({
        order_id: order.id,
        document_type: "uploaded_ivr",
        bucket: BUCKET,
        file_path: f.file_path,
        file_name: f.file_name,
        mime_type: f.mime_type,
        file_size: f.file_size,
        uploaded_by: user.id,
      }));
      const { error: docsErr } = await adminClient
        .from("order_documents")
        .insert(docRows);
      if (docsErr) {
        console.error("[convertIvrToOrder] docs insert", docsErr);
        // Not fatal — the order + IVR link exist; clinic can re-upload
        // if they need copies on the order side. Surface as a warning.
      }
    }

    // 4. Mark the standalone IVR converted + history entry.
    const nowIso = new Date().toISOString();
    await adminClient
      .from("standalone_ivrs")
      .update({
        status: "converted",
        converted_to_order_id: order.id,
        updated_at: nowIso,
      })
      .eq("id", ivr.id);
    await adminClient.from("standalone_ivr_history").insert({
      standalone_ivr_id: ivr.id,
      event: "converted",
      actor_id: user.id,
      note: `Converted to order ${order.order_number}`,
    });

    revalidatePath(IVRS_PATH);
    revalidatePath("/dashboard/orders");
    return { success: true, orderId: order.id as string };
  } catch (err) {
    console.error("[convertIvrToOrder]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Resubmit denied IVR                                                        */
/*                                                                            */
/* Flips the IVR back to draft so the user can edit + re-send. Clears the     */
/* denial fields + the old approval token (a new one gets minted when the     */
/* clinic clicks Send again). Writes a "resubmitted" history entry so the     */
/* audit trail shows the intent even before the actual re-send.               */
/* -------------------------------------------------------------------------- */

export async function resubmitDeniedIvr(
  ivrId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const { data: current } = await supabase
      .from("standalone_ivrs")
      .select("status")
      .eq("id", ivrId)
      .maybeSingle();
    if (!current) return { success: false, error: "IVR not found." };
    if (current.status !== "denied") {
      return {
        success: false,
        error: "Only denied IVRs can be resubmitted.",
      };
    }

    const nowIso = new Date().toISOString();
    const adminClient = createAdminClient();
    const { error: updErr } = await adminClient
      .from("standalone_ivrs")
      .update({
        status: "draft",
        approval_token: null,
        approval_expires_at: null,
        sent_at: null,
        approved_at: null,
        denied_at: null,
        denial_reason: null,
        approver_display_name: null,
        approver_ip: null,
        approver_user_agent: null,
        updated_at: nowIso,
      })
      .eq("id", ivrId);
    if (updErr) {
      console.error("[resubmitDeniedIvr]", updErr);
      return { success: false, error: "Failed to reset IVR." };
    }

    await adminClient.from("standalone_ivr_history").insert({
      standalone_ivr_id: ivrId,
      event: "resubmitted",
      actor_id: user.id,
      note: "Reset to draft after denial. Edit and re-send.",
    });

    revalidatePath(IVRS_PATH);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Per-file management on a draft IVR                                         */
/* -------------------------------------------------------------------------- */

export async function addFileToIvr(input: {
  ivrId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<{ success: boolean; file?: IStandaloneIvrFile; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // Draft-only — once sent, files are frozen for the approver.
    const { data: current } = await supabase
      .from("standalone_ivrs")
      .select("status")
      .eq("id", input.ivrId)
      .maybeSingle();
    if (!current) return { success: false, error: "IVR not found." };
    if (current.status !== "draft") {
      return {
        success: false,
        error: "Files can only be added while the IVR is in draft.",
      };
    }

    const adminClient = createAdminClient();
    // Move the just-uploaded temp object into the IVR's folder.
    const finalPath = input.filePath.startsWith("standalone-ivrs/_upload/")
      ? `standalone-ivrs/${input.ivrId}/${input.filePath.split("/").slice(-1)[0]}`
      : input.filePath;
    if (finalPath !== input.filePath) {
      const { error: moveErr } = await adminClient.storage
        .from(BUCKET)
        .move(input.filePath, finalPath);
      if (moveErr) {
        console.error("[addFileToIvr] move", moveErr);
      }
    }

    const { data, error } = await adminClient
      .from("standalone_ivr_files")
      .insert({
        standalone_ivr_id: input.ivrId,
        file_path: finalPath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_size: input.fileSize,
      })
      .select(FILE_SELECT)
      .single();
    if (error || !data) {
      console.error("[addFileToIvr]", error);
      return { success: false, error: "Failed to attach file." };
    }

    await adminClient.from("standalone_ivr_history").insert({
      standalone_ivr_id: input.ivrId,
      event: "edited",
      actor_id: user.id,
      note: `Added file: ${input.fileName}`,
    });

    revalidatePath(IVRS_PATH);
    return { success: true, file: mapFile(data as Record<string, unknown>) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function deleteIvrFile(
  ivrId: string,
  fileId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const { data: current } = await supabase
      .from("standalone_ivrs")
      .select("status")
      .eq("id", ivrId)
      .maybeSingle();
    if (!current) return { success: false, error: "IVR not found." };
    if (current.status !== "draft") {
      return {
        success: false,
        error: "Files can only be deleted while the IVR is in draft.",
      };
    }

    const { data: file } = await supabase
      .from("standalone_ivr_files")
      .select("file_path, file_name")
      .eq("id", fileId)
      .eq("standalone_ivr_id", ivrId)
      .maybeSingle();
    if (!file) return { success: false, error: "File not found." };

    const adminClient = createAdminClient();
    const { error: delErr } = await adminClient
      .from("standalone_ivr_files")
      .delete()
      .eq("id", fileId);
    if (delErr) {
      console.error("[deleteIvrFile]", delErr);
      return { success: false, error: "Failed to delete file." };
    }
    // Best-effort storage cleanup.
    await adminClient.storage
      .from(BUCKET)
      .remove([file.file_path as string])
      .catch((e) => console.error("[deleteIvrFile] storage", e));

    await adminClient.from("standalone_ivr_history").insert({
      standalone_ivr_id: ivrId,
      event: "edited",
      actor_id: user.id,
      note: `Removed file: ${file.file_name}`,
    });

    revalidatePath(IVRS_PATH);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Finalize IVR → order linkage after the order was created via the normal    */
/* CreateOrderModal flow.                                                     */
/*                                                                            */
/* This is the split-out "wire up the standalone IVR to an existing order"    */
/* step — used when the "Create Order from Approved IVR" button opens the     */
/* full CreateOrderModal instead of a stripped-down convert modal (Dr. Ben    */
/* feedback 2026-07-07: keep the full order-creation UX intact). The order    */
/* already exists at this point; we only need to:                             */
/*                                                                            */
/*   - Upsert order_ivr so linked_standalone_ivr_id points at the source,     */
/*     and ivr_mode is 'uploaded' (external IVR is the source of truth).      */
/*   - Register the standalone IVR's files as uploaded_ivr order documents    */
/*     (same storage paths, metadata-only rows).                              */
/*   - Flip standalone_ivrs → converted + write history.                      */
/* -------------------------------------------------------------------------- */

export async function finalizeIvrConversion(input: {
  ivrId: string;
  orderId: string;
}): Promise<{
  success: boolean;
  error?: string;
  /** Populated on the fax-origin path: the fax file(s) that were just
   *  attached as facesheet-typed order_documents and should have the
   *  AI extractor run against them. The CLIENT calls
   *  triggerOrderExtraction with these — trying to fire it from here
   *  inside a fire-and-forget produces intermittent 401s because the
   *  outer request context can be reaped before the extraction fetch's
   *  cookie read runs. */
  extractableDocs?: Array<{ documentType: string; filePath: string }>;
}> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    // Verify caller has access to the standalone IVR (RLS-scoped read).
    // `select("*")` because we're copying every rich-form column onto
    // order_ivr below — enumerating them would drift from
    // FORM_COLUMN_MAP over time. TS parser can't infer a dynamic list
    // anyway so we cast the row for the copy loop.
    const { data: ivrRow } = await supabase
      .from("standalone_ivrs")
      .select("*")
      .eq("id", input.ivrId)
      .maybeSingle();
    if (!ivrRow) return { success: false, error: "IVR not found or access denied." };
    const ivr = ivrRow as unknown as Record<string, unknown> & {
      id: string;
      status: string;
      patient_name: string | null;
      patient_dob: string | null;
      physician_name: string | null;
      physician_npi: string | null;
      product_summary: string | null;
      converted_to_order_id: string | null;
    };
    if (ivr.status !== "approved" && ivr.status !== "converted") {
      return { success: false, error: "Only approved IVRs can be linked." };
    }
    if (ivr.converted_to_order_id && ivr.converted_to_order_id !== input.orderId) {
      return {
        success: false,
        error: "This IVR has already been converted to a different order.",
      };
    }

    // Verify caller has access to the order too — RLS on orders.
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("id", input.orderId)
      .maybeSingle();
    if (!order) return { success: false, error: "Order not found or access denied." };

    const nowIso = new Date().toISOString();

    // 1. Upsert order_ivr — copy every rich-form column plus the
    // top-level metadata. Same column names both sides (FORM_COLUMN_MAP
    // drives this), so a dumb 1:1 copy is enough. ivr_mode='built' so
    // the order's IVR tab shows the paper form we filled in on the
    // fax-build stage instead of surfacing the raw fax PDF as an
    // "uploaded IVR" — the fax stays one click away via the
    // "IVR approved externally · View original IVR" banner already
    // rendered at the top of the tab.
    const formCopy: Record<string, unknown> = {};
    for (const col of Object.values(FORM_COLUMN_MAP)) {
      if (col === "form_notes") continue; // standalone-only
      const val = ivr[col];
      if (val !== undefined && val !== null) formCopy[col] = val;
    }

    const { data: existingIvr } = await adminClient
      .from("order_ivr")
      .select("id")
      .eq("order_id", input.orderId)
      .maybeSingle();
    if (existingIvr) {
      await adminClient
        .from("order_ivr")
        .update({
          ...formCopy,
          patient_name: ivr.patient_name,
          patient_dob: ivr.patient_dob,
          physician_name: ivr.physician_name,
          physician_npi: ivr.physician_npi,
          product_information:
            (formCopy.product_information as string | undefined) ??
            ivr.product_summary,
          linked_standalone_ivr_id: input.ivrId,
          ivr_mode: "built",
          updated_at: nowIso,
        })
        .eq("id", existingIvr.id);
    } else {
      await adminClient.from("order_ivr").insert({
        ...formCopy,
        order_id: input.orderId,
        patient_name: ivr.patient_name,
        patient_dob: ivr.patient_dob,
        physician_name: ivr.physician_name,
        physician_npi: ivr.physician_npi,
        product_information:
          (formCopy.product_information as string | undefined) ??
          ivr.product_summary,
        linked_standalone_ivr_id: input.ivrId,
        ivr_mode: "built",
      });
    }

    // 2. Intentionally NOT copying the standalone_ivr's files to
    // order_documents as uploaded_ivr — doing so would make the fax
    // PDF appear as the "uploaded IVR document" on the order's IVR
    // tab, competing with the built form we just seeded. The fax
    // stays accessible via the "View original IVR" banner up top.
    //
    // Fax-origin exception: the fax PDF IS a merged bundle of the
    // facesheet + clinical documentation (client's inbound fax
    // template), and the CreateOrderModal drops the facesheet /
    // clinical_docs upload zones on this path. Attach the fax as
    // document_type='facesheet' so the AI extraction pipeline has
    // something to read and pre-fills Order Form / HCFA / patient
    // data automatically. Metadata-only insert — the file bytes
    // stay at the standalone-ivrs storage path.
    const isFromFax = (ivr.approver_display_name as string | null)?.startsWith(
      "Approved from fax",
    );
    let extractableForAi: Array<{
      documentType: string;
      filePath: string;
      bucket: string;
    }> = [];
    if (isFromFax) {
      const { data: ivrFiles } = await adminClient
        .from("standalone_ivr_files")
        .select("file_path, file_name, mime_type, file_size")
        .eq("standalone_ivr_id", input.ivrId);
      if (ivrFiles && ivrFiles.length > 0) {
        // Skip files already registered on this order at any
        // (order_id, file_path) — makes the action re-runnable
        // (a second click on "Create Order from IVR" doesn't
        // duplicate rows or refire the AI).
        const paths = ivrFiles.map((f) => f.file_path as string);
        const { data: existingDocs } = await adminClient
          .from("order_documents")
          .select("file_path, document_type")
          .eq("order_id", input.orderId)
          .in("file_path", paths);
        const alreadyAsFacesheet = new Set(
          (existingDocs ?? [])
            .filter((d) => d.document_type === "facesheet")
            .map((d) => d.file_path as string),
        );

        const toInsert = ivrFiles
          .filter((f) => !alreadyAsFacesheet.has(f.file_path as string))
          .map((f) => ({
            order_id: input.orderId,
            document_type: "facesheet",
            bucket: BUCKET,
            file_path: f.file_path,
            file_name: f.file_name,
            mime_type: f.mime_type,
            file_size: f.file_size,
            uploaded_by: user.id,
          }));
        if (toInsert.length > 0) {
          const { error: docsErr } = await adminClient
            .from("order_documents")
            .insert(toInsert);
          if (docsErr) {
            console.error(
              "[finalizeIvrConversion] fax→facesheet insert",
              docsErr,
            );
            // Non-fatal — the order + linkage exist; the user can
            // still fill Order Form / HCFA manually. Only the AI
            // pre-fill is lost.
          }
        }
        // Collect every faxed file (including those we skipped as
        // duplicates) so the AI trigger still fires on the second
        // click if it errored the first time. The extractor is
        // idempotent as long as ai_extracted hasn't flipped.
        extractableForAi = ivrFiles.map((f) => ({
          documentType: "facesheet",
          filePath: f.file_path as string,
          bucket: BUCKET,
        }));
      }
    }

    // 3. Flip the IVR to converted (if not already) + history.
    if (ivr.status !== "converted") {
      await adminClient
        .from("standalone_ivrs")
        .update({
          status: "converted",
          converted_to_order_id: input.orderId,
          updated_at: nowIso,
        })
        .eq("id", input.ivrId);
      await adminClient.from("standalone_ivr_history").insert({
        standalone_ivr_id: input.ivrId,
        event: "converted",
        actor_id: user.id,
        note: `Converted to order`,
      });
    }

    revalidatePath(IVRS_PATH);
    revalidatePath("/dashboard/orders");
    // Return the extractable docs so the CLIENT can fire the AI
    // trigger (via triggerOrderExtraction) in its own live-session
    // context. Attempting the fire-and-forget here fails with 401
    // because Next.js reaps the request's cookie context by the
    // time the fetch's `await cookies()` runs — 30+ min of debugging
    // this went into the comment on 2026-08-31.
    return {
      success: true,
      extractableDocs: extractableForAi.map((d) => ({
        documentType: d.documentType,
        filePath: d.filePath,
      })),
    };
  } catch (err) {
    console.error("[finalizeIvrConversion]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
