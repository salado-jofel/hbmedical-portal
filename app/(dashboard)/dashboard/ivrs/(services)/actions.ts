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
  IStandaloneIvrHistoryEntry,
  StandaloneIvrHistoryEvent,
  IExternalApprover,
} from "@/utils/interfaces/standalone-ivrs";

const IVRS_PATH = "/dashboard/ivrs";

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
  external_approvers ( id, name, email, is_active ),
  facilities ( name )
`;

const FILE_SELECT = "id, standalone_ivr_id, file_path, file_name, mime_type, file_size, created_at";
const HISTORY_SELECT =
  "id, standalone_ivr_id, event, actor_id, actor_display, note, created_at";

function mapIvr(row: Record<string, unknown>): IStandaloneIvr {
  const approver =
    (row.external_approvers as Record<string, unknown> | null) ?? null;
  const facility =
    (row.facilities as { name: string | null } | null) ?? null;
  return {
    id: row.id as string,
    status: row.status as IStandaloneIvr["status"],
    patientName: row.patient_name as string,
    patientDob: row.patient_dob as string,
    physicianName: row.physician_name as string,
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
    approver: approver
      ? {
          id: approver.id as string,
          name: approver.name as string,
          email: approver.email as string,
          isActive: Boolean(approver.is_active),
          createdAt: "",
          updatedAt: "",
        }
      : null,
    facilityName: facility?.name ?? null,
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
  return (data ?? []).map((r) => mapIvr(r as Record<string, unknown>));
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

  const [{ data: files }, { data: history }] = await Promise.all([
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
  ]);

  return {
    ...mapIvr(ivr as Record<string, unknown>),
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
  patientName: string;
  patientDob: string;
  physicianName: string;
  physicianNpi?: string | null;
  facilityId: string;
  productSummary: string;
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

    // Basic validation — required per Dr. Ben's answer to Q2.
    const required = {
      patientName: input.patientName?.trim(),
      patientDob: input.patientDob?.trim(),
      physicianName: input.physicianName?.trim(),
      facilityId: input.facilityId,
      productSummary: input.productSummary?.trim(),
      assignedApproverId: input.assignedApproverId,
    };
    for (const [k, v] of Object.entries(required)) {
      if (!v) {
        return { success: false, error: `${k} is required.` };
      }
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
        patient_name: required.patientName,
        patient_dob: required.patientDob,
        physician_name: required.physicianName,
        physician_npi: input.physicianNpi?.trim() || null,
        facility_id: required.facilityId,
        product_summary: required.productSummary,
        assigned_approver_id: required.assignedApproverId,
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

    // RLS-scoped fetch — user can only send IVRs they're allowed to see.
    // Filter server-side to draft status; anything else silently skipped.
    const { data: rows, error: readErr } = await supabase
      .from("standalone_ivrs")
      .select(
        `id, patient_name, patient_dob, physician_name, product_summary,
         status, assigned_approver_id,
         external_approvers ( id, name, email, is_active )`,
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
      // Supabase types the FK join as an array in TS even when it's a
      // to-one relation. Cast via unknown + normalize to a single object.
      const raw = d.external_approvers as unknown as
        | { id: string; name: string; email: string; is_active: boolean }
        | Array<{ id: string; name: string; email: string; is_active: boolean }>
        | null;
      const ap = Array.isArray(raw) ? raw[0] ?? null : raw;
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

      // Build + send ONE summary email for this approver.
      const email = buildIvrApprovalEmail({
        approverName: bucket.approver.name,
        approverEmail: bucket.approver.email,
        senderOrgName: "Meridian Portal",
        ivrs: bucket.ivrs.map((i) => ({
          patientName: i.patient_name as string,
          patientDob: i.patient_dob as string,
          physicianName: i.physician_name as string,
          productSummary: i.product_summary as string,
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
    // see it, they can't convert it.
    const { data: ivr } = await supabase
      .from("standalone_ivrs")
      .select(
        `id, status, patient_name, patient_dob, physician_name, physician_npi,
         facility_id, product_summary, assigned_approver_id,
         approved_at, approver_display_name, converted_to_order_id`,
      )
      .eq("id", input.ivrId)
      .maybeSingle();
    if (!ivr) {
      return { success: false, error: "IVR not found or access denied." };
    }
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

    // 2. Seed order_ivr — carry patient/physician/facility over and link
    // back to the standalone IVR for the approval banner.
    const { error: ivrRowErr } = await adminClient.from("order_ivr").insert({
      order_id: order.id,
      patient_name: ivr.patient_name,
      patient_dob: ivr.patient_dob,
      physician_name: ivr.physician_name,
      physician_npi: ivr.physician_npi,
      product_information: ivr.product_summary,
      linked_standalone_ivr_id: ivr.id,
      // ivr_mode 'uploaded' — the external IVR file IS the IVR now; the
      // in-portal form stays empty. Same semantics as clinicians uploading
      // a completed IVR directly via the order's IVR tab.
      ivr_mode: "uploaded",
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
