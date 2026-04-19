"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import type { IOrderDocument } from "@/utils/interfaces/orders";
import {
  ORDERS_PATH,
  BUCKET,
  getDocumentLabel,
  insertOrderHistory,
  triggerAiExtraction,
  triggerCombinedExtraction,
  generateOrderPDFs,
} from "./_shared";

/* -------------------------------------------------------------------------- */
/* uploadOrderDocument                                                        */
/* -------------------------------------------------------------------------- */

export async function uploadOrderDocument(
  orderId: string,
  documentType: string,
  file: FormData,
): Promise<{ success: boolean; error?: string; document?: IOrderDocument }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const fileEntry = file.get("file") as File | null;
    if (!fileEntry) return { success: false, error: "No file provided." };

    const timestamp = Date.now();
    const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `order-documents/${orderId}/${documentType}/${timestamp}-${safeName}`;

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(filePath, fileEntry, {
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[uploadOrderDocument] storage:", JSON.stringify(uploadErr));
      return { success: false, error: "Failed to upload file." };
    }

    const { data: docRow, error: dbErr } = await adminClient
      .from("order_documents")
      .insert({
        order_id: orderId,
        document_type: documentType,
        bucket: BUCKET,
        file_path: filePath,
        file_name: fileEntry.name,
        mime_type: fileEntry.type || null,
        file_size: fileEntry.size || null,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (dbErr || !docRow) {
      console.error("[uploadOrderDocument] db:", JSON.stringify(dbErr));
      // Clean up storage
      await adminClient.storage.from(BUCKET).remove([filePath]);
      return { success: false, error: "Failed to save document record." };
    }

    await insertOrderHistory(
      adminClient,
      orderId,
      `Document uploaded: ${getDocumentLabel(documentType)}`,
      null,
      null,
      user.id,
      fileEntry.name,
    );
    revalidatePath(ORDERS_PATH);
    return {
      success: true,
      document: {
        id: docRow.id,
        orderId: docRow.order_id,
        documentType: docRow.document_type,
        bucket: docRow.bucket,
        filePath: docRow.file_path,
        fileName: docRow.file_name,
        mimeType: docRow.mime_type,
        fileSize: docRow.file_size,
        uploadedBy: docRow.uploaded_by,
        createdAt: docRow.created_at,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getDocumentSignedUrl                                                       */
/* -------------------------------------------------------------------------- */

export async function getDocumentSignedUrl(
  filePath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error("[getDocumentSignedUrl]", JSON.stringify(error));
      return { url: null, error: "Failed to generate signed URL." };
    }

    return { url: data.signedUrl };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteOrderDocument                                                        */
/* -------------------------------------------------------------------------- */

export async function deleteOrderDocument(
  docId: string,
  filePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    const { error: storageErr } = await adminClient.storage
      .from(BUCKET)
      .remove([filePath]);

    if (storageErr) {
      console.error("[deleteOrderDocument] storage:", JSON.stringify(storageErr));
      // Non-fatal
    }

    const { error } = await adminClient
      .from("order_documents")
      .delete()
      .eq("id", docId);

    if (error) {
      console.error("[deleteOrderDocument] db:", JSON.stringify(error));
      return { success: false, error: "Failed to delete document." };
    }

    revalidatePath(ORDERS_PATH);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* upsertForm1500                                                             */
/* -------------------------------------------------------------------------- */

export async function upsertForm1500(
  orderId: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("order_form_1500").upsert(
      {
        order_id: orderId,
        ...formData,
      },
      { onConflict: "order_id" },
    );

    if (error) {
      console.error("[upsertForm1500]", JSON.stringify(error));
      return { success: false, error: "Failed to save form." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

/* -------------------------------------------------------------------------- */
/* getForm1500                                                                */
/* -------------------------------------------------------------------------- */

export async function getForm1500(orderId: string) {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  // Fetch form row and order context (facility + enrollment + order_type) in parallel
  const [formRes, orderCtxRes] = await Promise.all([
    adminClient
      .from("order_form_1500")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle(),
    adminClient
      .from("orders")
      .select(`
        manual_input,
        facilities!orders_facility_id_fkey(
          name, phone, address_line_1,
          facility_enrollment(
            facility_npi, facility_tin, facility_ein,
            billing_address, billing_city, billing_state, billing_zip,
            billing_phone, billing_fax
          )
        )
      `)
      .eq("id", orderId)
      .maybeSingle(),
  ]);

  // Manual-input orders: return existing row only. No auto-init from enrollment
  // — every field stays blank until the user fills it. order_type no longer
  // affects form behavior; it's purely a product classification.
  const manualInput = Boolean((orderCtxRes.data as any)?.manual_input);
  if (manualInput) {
    return (formRes.data as Record<string, unknown>) ?? null;
  }

  // Resolve facility and enrollment from join
  const facilityRaw = orderCtxRes.data?.facilities as unknown;
  const facility = (Array.isArray(facilityRaw) ? facilityRaw[0] : facilityRaw) as {
    name: string;
    phone: string | null;
    address_line_1: string | null;
    facility_enrollment?: unknown[] | null;
  } | null | undefined;

  const enrollmentRaw = facility?.facility_enrollment;
  const enrollment = (Array.isArray(enrollmentRaw) ? enrollmentRaw[0] : enrollmentRaw) as {
    facility_npi:    string | null;
    facility_tin:    string | null;
    facility_ein:    string | null;
    billing_address: string | null;
    billing_city:    string | null;
    billing_state:   string | null;
    billing_zip:     string | null;
    billing_phone:   string | null;
    billing_fax:     string | null;
  } | null | undefined;

  // Build a formatted billing address string
  const billingAddress = enrollment
    ? [
        enrollment.billing_address,
        [enrollment.billing_city, enrollment.billing_state].filter(Boolean).join(", "),
        enrollment.billing_zip,
      ].filter(Boolean).join(" ") || null
    : null;

  // Auto-initialize when no row exists yet
  let row = formRes.data as Record<string, unknown> | null;
  if (!row && (facility || enrollment)) {
    const initPayload: Record<string, unknown> = {
      order_id: orderId,
      // Box 25 — Federal Tax ID
      federal_tax_id:          enrollment?.facility_tin ?? enrollment?.facility_ein ?? null,
      // Box 32 — Service Facility
      service_facility_name:   facility?.name ?? null,
      service_facility_address: billingAddress,
      service_facility_npi:    enrollment?.facility_npi ?? null,
      // Box 33 — Billing Provider
      billing_provider_name:   facility?.name ?? null,
      billing_provider_address: billingAddress,
      billing_provider_phone:  enrollment?.billing_phone ?? facility?.phone ?? null,
      billing_provider_npi:    enrollment?.facility_npi ?? null,
      billing_provider_tax_id: enrollment?.facility_tin ?? null,
    };
    const { data: created } = await adminClient
      .from("order_form_1500")
      .upsert(initPayload, { onConflict: "order_id" })
      .select("*")
      .single();
    row = created as Record<string, unknown> | null;
  }

  if (!row) return null;

  // Apply enrollment fallbacks for null billing/facility fields on existing rows
  if (!row.federal_tax_id)           row.federal_tax_id           = enrollment?.facility_tin ?? enrollment?.facility_ein ?? null;
  if (!row.service_facility_name)    row.service_facility_name    = facility?.name ?? null;
  if (!row.service_facility_address) row.service_facility_address = billingAddress;
  if (!row.service_facility_npi)     row.service_facility_npi     = enrollment?.facility_npi ?? null;
  if (!row.billing_provider_name)    row.billing_provider_name    = facility?.name ?? null;
  if (!row.billing_provider_address) row.billing_provider_address = billingAddress;
  if (!row.billing_provider_phone)   row.billing_provider_phone   = enrollment?.billing_phone ?? facility?.phone ?? null;
  if (!row.billing_provider_npi)     row.billing_provider_npi     = enrollment?.facility_npi ?? null;
  if (!row.billing_provider_tax_id)  row.billing_provider_tax_id  = enrollment?.facility_tin ?? null;

  return row;
}

/* -------------------------------------------------------------------------- */
/* AI extraction server action wrappers (callable from client components)     */
/* -------------------------------------------------------------------------- */

/**
 * Trigger single-document AI extraction (for re-uploads from the detail modal).
 * Fire-and-forget — returns immediately; extraction runs in the background.
 */
export async function triggerDocumentExtraction(
  orderId: string,
  documentType: string,
  filePath: string,
): Promise<{ success: boolean; error: string | null }> {
  // Defense-in-depth: never run AI extraction on manual-input orders.
  const adminClient = createAdminClient();
  const { data: order } = await adminClient
    .from("orders")
    .select("manual_input")
    .eq("id", orderId)
    .maybeSingle();
  if ((order as { manual_input?: boolean } | null)?.manual_input) {
    return { success: true, error: null };
  }

  triggerAiExtraction(orderId, documentType, filePath).catch((err) =>
    console.error("[triggerDocumentExtraction]", err),
  );
  return { success: true, error: null };
}

/**
 * Trigger combined AI extraction for a new order (facesheet + clinical_docs together).
 * Fire-and-forget — returns immediately; extraction runs in the background.
 */
export async function triggerOrderExtraction(
  orderId: string,
  documents: Array<{ documentType: string; filePath: string }>,
): Promise<{ success: boolean; error: string | null }> {
  // Defense-in-depth: never run AI extraction on orders flagged as manual input,
  // even if a client somewhere dispatches this after creation.
  const adminClient = createAdminClient();
  const { data: order } = await adminClient
    .from("orders")
    .select("manual_input")
    .eq("id", orderId)
    .maybeSingle();
  if ((order as { manual_input?: boolean } | null)?.manual_input) {
    return { success: true, error: null };
  }

  triggerCombinedExtraction(orderId, documents).catch((err) =>
    console.error("[triggerOrderExtraction]", err),
  );
  return { success: true, error: null };
}
