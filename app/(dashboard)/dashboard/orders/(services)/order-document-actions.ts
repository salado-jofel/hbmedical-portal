"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireOrderAccess,
  OrderAccessError,
} from "@/lib/supabase/order-access";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
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
import { safeLogError } from "@/lib/logging/safe-log";

/* -------------------------------------------------------------------------- */
/* uploadOrderDocument                                                        */
/* -------------------------------------------------------------------------- */

export async function uploadOrderDocument(
  orderId: string,
  documentType: string,
  file: FormData,
): Promise<{ success: boolean; error?: string; document?: IOrderDocument }> {
  try {
    const { userId } = await requireOrderAccess(orderId);
    const adminClient = createAdminClient();
    const user = { id: userId };

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
      safeLogError("uploadOrderDocument", uploadErr, { phase: "storage", orderId, documentType });
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
      safeLogError("uploadOrderDocument", dbErr, { phase: "db", orderId, documentType });
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

/**
 * Issues a signed URL for a private order document. PHI-bearing — every
 * document type the orders flow stores (facesheet, clinical docs, IVR,
 * order form, 1500, delivery invoice, wound photos) contains patient
 * information. The 10-minute TTL keeps the window short enough that an
 * accidentally-shared URL (Slack, email, browser history) doesn't remain
 * useful for long. Long enough that a normal user click → download flow
 * works without flake.
 */
const ORDER_DOCUMENT_SIGNED_URL_TTL_SECONDS = 600;

export async function getDocumentSignedUrl(
  filePath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    // Authorization gate. The path always starts with
    // `order-documents/{orderId}/...`. Parse the order id and run the per-
    // order access check before issuing a signed URL — service role bypasses
    // RLS, so without this check any signed-in user could read another
    // facility's PHI documents.
    const orderIdMatch = filePath.match(/^order-documents\/([0-9a-f-]{36})\//i);
    if (!orderIdMatch) {
      return { url: null, error: "Invalid document path." };
    }
    const orderId = orderIdMatch[1];

    try {
      await requireOrderAccess(orderId);
    } catch (err) {
      if (err instanceof OrderAccessError) {
        return { url: null, error: err.message };
      }
      throw err;
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, ORDER_DOCUMENT_SIGNED_URL_TTL_SECONDS);

    void logPhiAccess({
      action: "document.signed_url",
      resource: "order_documents",
      orderId,
      metadata: { filePath, ttlSeconds: ORDER_DOCUMENT_SIGNED_URL_TTL_SECONDS },
    });

    if (error) {
      safeLogError("getDocumentSignedUrl", error, { filePath });
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
    // Authorization gate via the order id parsed from the storage path.
    const orderIdMatch = filePath.match(/^order-documents\/([0-9a-f-]{36})\//i);
    if (!orderIdMatch) {
      return { success: false, error: "Invalid document path." };
    }
    try {
      await requireOrderAccess(orderIdMatch[1]);
    } catch (err) {
      if (err instanceof OrderAccessError) {
        return { success: false, error: err.message };
      }
      throw err;
    }

    const adminClient = createAdminClient();

    const { error: storageErr } = await adminClient.storage
      .from(BUCKET)
      .remove([filePath]);

    if (storageErr) {
      safeLogError("deleteOrderDocument", storageErr, { phase: "storage", docId });
      // Non-fatal
    }

    const { error } = await adminClient
      .from("order_documents")
      .delete()
      .eq("id", docId);

    if (error) {
      safeLogError("deleteOrderDocument", error, { phase: "db", docId });
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
    await requireOrderAccess(orderId);
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("order_form_1500").upsert(
      {
        order_id: orderId,
        ...formData,
      },
      { onConflict: "order_id" },
    );

    if (error) {
      safeLogError("upsertForm1500", error, { orderId });
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
  await requireOrderAccess(orderId);
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
  try {
    await requireOrderAccess(orderId);
  } catch (err) {
    if (err instanceof OrderAccessError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
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
    safeLogError("triggerDocumentExtraction", err, { orderId, documentType }),
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
  try {
    await requireOrderAccess(orderId);
  } catch (err) {
    if (err instanceof OrderAccessError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
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
    safeLogError("triggerOrderExtraction", err, { orderId }),
  );
  return { success: true, error: null };
}
