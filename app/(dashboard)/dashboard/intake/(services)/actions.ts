"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import type {
  IIntakeDocument,
  IntakeStatus,
  IntakeClassification,
  IntakeConvertedType,
} from "@/utils/interfaces/intake";

const INTAKE_PATH = "/dashboard/intake";
const BUCKET = process.env.SUPABASE_BUCKET ?? "hbmedical-bucket-private";

const INTAKE_SELECT = `
  id,
  source,
  provider,
  external_id,
  from_number,
  to_number,
  received_at,
  page_count,
  bucket,
  file_path,
  file_name,
  mime_type,
  file_size,
  status,
  classified_as,
  converted_to_type,
  converted_to_id,
  converted_at,
  converted_by,
  dismissed_at,
  dismissed_by,
  dismiss_reason,
  created_at,
  updated_at
`;

function mapIntake(row: Record<string, unknown>): IIntakeDocument {
  return {
    id: row.id as string,
    source: row.source as IIntakeDocument["source"],
    provider: row.provider as string,
    externalId: (row.external_id as string | null) ?? null,
    fromNumber: (row.from_number as string | null) ?? null,
    toNumber: (row.to_number as string | null) ?? null,
    receivedAt: row.received_at as string,
    pageCount: (row.page_count as number | null) ?? null,
    bucket: row.bucket as string,
    filePath: row.file_path as string,
    fileName: (row.file_name as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    status: row.status as IntakeStatus,
    classifiedAs: (row.classified_as as IntakeClassification | null) ?? null,
    convertedToType: (row.converted_to_type as IntakeConvertedType | null) ?? null,
    convertedToId: (row.converted_to_id as string | null) ?? null,
    convertedAt: (row.converted_at as string | null) ?? null,
    convertedBy: (row.converted_by as string | null) ?? null,
    dismissedAt: (row.dismissed_at as string | null) ?? null,
    dismissedBy: (row.dismissed_by as string | null) ?? null,
    dismissReason: (row.dismiss_reason as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getIntakeDocuments(): Promise<IIntakeDocument[]> {
  const supabase = await createClient();
  try {
    await getCurrentUserOrThrow(supabase);
  } catch {
    return [];
  }
  // RLS on intake_documents restricts to admin + support_staff, so this
  // returns [] silently for any other caller — the page also gates
  // rendering to those roles.
  const { data, error } = await supabase
    .from("intake_documents")
    .select(INTAKE_SELECT)
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[getIntakeDocuments]", error);
    return [];
  }
  return (data ?? []).map((r) => mapIntake(r as Record<string, unknown>));
}

export async function getIntakeSignedUrl(filePath: string): Promise<{
  url: string | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    // Verify caller can see at least ONE intake row (RLS gate = admin +
    // support). Simpler than re-checking the row by path since we're
    // already fenced by role at the table level.
    const { data: probe } = await supabase
      .from("intake_documents")
      .select("id")
      .eq("file_path", filePath)
      .maybeSingle();
    if (!probe) return { url: null, error: "Access denied." };

    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 15);
    if (error || !signed?.signedUrl) {
      return { url: null, error: "Failed to sign URL." };
    }
    return { url: signed.signedUrl };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function dismissIntake(input: {
  intakeId: string;
  reason: string;
}): Promise<{ success: boolean; intake?: IIntakeDocument; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // RLS on intake_documents keeps this admin+support-only, so no
    // additional role check here — a non-admin caller's UPDATE returns
    // 0 rows and we surface a friendly error.
    const { data, error } = await supabase
      .from("intake_documents")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
        dismissed_by: user.id,
        dismiss_reason: input.reason.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.intakeId)
      .select(INTAKE_SELECT)
      .maybeSingle();
    if (error || !data) {
      console.error("[dismissIntake]", error);
      return { success: false, error: "Failed to dismiss intake." };
    }
    revalidatePath(INTAKE_PATH);
    return {
      success: true,
      intake: mapIntake(data as Record<string, unknown>),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/**
 * Mark an intake as converted. Called by the Build IVR / Build Order
 * handoff flows once the downstream row (standalone_ivrs or orders)
 * exists. Bookkeeping only — the caller's already created the record.
 */
export async function markIntakeConverted(input: {
  intakeId: string;
  toType: IntakeConvertedType;
  toId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const nextStatus: IntakeStatus =
      input.toType === "standalone_ivr" ? "converted_ivr" : "converted_order";

    const { error } = await supabase
      .from("intake_documents")
      .update({
        status: nextStatus,
        converted_to_type: input.toType,
        converted_to_id: input.toId,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.intakeId);
    if (error) {
      console.error("[markIntakeConverted]", error);
      return { success: false, error: "Failed to mark intake converted." };
    }
    revalidatePath(INTAKE_PATH);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Attach an intake fax as an order document + mark the intake converted.     */
/*                                                                            */
/* Called from the CreateOrderModal after it has finished its normal          */
/* create-order + user-upload flow. The intake fax's storage bytes stay put   */
/* (metadata-only insert), which is cheaper and keeps a single canonical      */
/* copy of the PDF that both the intake row and the order can reference.      */
/* -------------------------------------------------------------------------- */

export async function attachIntakeToOrder(input: {
  intakeId: string;
  orderId: string;
  documentType?: string; // defaults to 'facesheet'
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const admin = createAdminClient();

    const { data: intake } = await supabase
      .from("intake_documents")
      .select(
        "id, status, bucket, file_path, file_name, mime_type, file_size",
      )
      .eq("id", input.intakeId)
      .maybeSingle();
    if (!intake) {
      return { success: false, error: "Intake not found or access denied." };
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("id", input.orderId)
      .maybeSingle();
    if (!order) {
      return { success: false, error: "Order not found or access denied." };
    }

    const docType = input.documentType ?? "uploaded_ivr";
    const { error: docErr } = await admin.from("order_documents").insert({
      order_id: input.orderId,
      document_type: docType,
      bucket: intake.bucket,
      file_path: intake.file_path,
      file_name: intake.file_name,
      mime_type: intake.mime_type,
      file_size: intake.file_size,
      uploaded_by: user.id,
    });
    if (docErr) {
      console.error("[attachIntakeToOrder] doc insert", docErr);
      return { success: false, error: "Failed to attach fax to order." };
    }

    // When the fax IS the IVR (default for the fromIntake flow), also
    // flip order_ivr.ivr_mode → 'uploaded' so the IVR Form tab shows the
    // uploaded doc as the source of truth and hides the empty in-portal
    // built form below it. Fresh orders don't have an order_ivr row yet,
    // so we upsert on order_id. Non-IVR doctypes (facesheet, etc.) skip
    // this step — they don't own the IVR surface.
    if (docType === "uploaded_ivr") {
      const { error: ivrErr } = await admin
        .from("order_ivr")
        .upsert(
          { order_id: input.orderId, ivr_mode: "uploaded" },
          { onConflict: "order_id" },
        );
      if (ivrErr) {
        // Non-fatal — the doc is attached and visible in the tab.
        // Worst case the built form still shows below and the user
        // switches modes manually. Log so we notice if it becomes noisy.
        console.error("[attachIntakeToOrder] ivr_mode upsert", ivrErr);
      }
    }

    const { error: updErr } = await admin
      .from("intake_documents")
      .update({
        status: "converted_order",
        converted_to_type: "order",
        converted_to_id: input.orderId,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.intakeId);
    if (updErr) {
      console.error("[attachIntakeToOrder] intake update", updErr);
    }

    revalidatePath(INTAKE_PATH);
    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
