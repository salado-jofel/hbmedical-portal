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

/**
 * Upper bound for any uploaded order document. Set just below Anthropic's
 * Claude API hard limit (32MB per file) so AI-extractable docs never get
 * sent to the model only to be rejected. For non-AI document types the
 * limit also makes sense — files this large are almost always poorly-
 * compressed scans, and storing them eats Supabase quota fast.
 */
const MAX_DOCUMENT_SIZE_MB = 25;
const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

/** Document types that get fed into Claude for AI extraction. */
const AI_EXTRACTED_DOCUMENT_TYPES = new Set(["facesheet", "clinical_docs"]);

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

    // Size guard — for AI-extracted document types this prevents the
    // catastrophic "AI extraction timed out" failure mode that comes from
    // sending Claude a giant PDF it'll either reject (>32MB) or take 90+
    // seconds to process (which exceeds the Vercel function timeout).
    if (fileEntry.size > MAX_DOCUMENT_SIZE_BYTES) {
      const sizeMB = (fileEntry.size / 1024 / 1024).toFixed(1);
      const aiNote = AI_EXTRACTED_DOCUMENT_TYPES.has(documentType)
        ? " AI extraction can't process files this large reliably."
        : "";
      return {
        success: false,
        error: `This file is ${sizeMB}MB — too large (max ${MAX_DOCUMENT_SIZE_MB}MB).${aiNote} Please compress the PDF (try "reduce file size" in Preview/Adobe) or split it into smaller sections.`,
      };
    }

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
/* seedForm1500ForDelivery                                                    */
/*                                                                            */
/* Called from markOrderDelivered when an order transitions to "delivered".  */
/* Pre-populates the CMS-1500 with everything we already know so the biller  */
/* lands on a mostly-complete form.                                           */
/*                                                                            */
/* Sources:                                                                   */
/*   - patients (first/last name, DOB)                                        */
/*   - order_ivr (insurance, member_id, patient address/phone)                */
/*   - orders (icd10_code, date_of_service)                                   */
/*   - order_items (service lines: HCPCS, quantity, charges)                  */
/*   - facility + facility_enrollment (billing provider, NPI, TIN, address)   */
/*                                                                            */
/* Skips if a row already exists — never overwrites manual edits. Box 31     */
/* (physician_signature) is intentionally left blank per spec; billers handle */
/* signing in their billing software (signature-on-file or similar).          */
/* -------------------------------------------------------------------------- */

export async function seedForm1500ForDelivery(
  orderId: string,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    await requireOrderAccess(orderId);
    const adminClient = createAdminClient();

    // Bail early if the row already exists. Don't overwrite manual edits or
    // a previously seeded snapshot.
    const { data: existing } = await adminClient
      .from("order_form_1500")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing) return { success: true, skipped: true };

    // Pull all source data in parallel.
    const [orderRes, ivrRes, itemsRes] = await Promise.all([
      adminClient
        .from("orders")
        .select(`
          id, icd10_code, date_of_service,
          patient:patients!orders_patient_id_fkey(
            first_name, last_name, date_of_birth
          ),
          facility:facilities!orders_facility_id_fkey(
            name, phone, address_line_1,
            facility_enrollment(
              facility_npi, facility_tin, facility_ein,
              billing_address, billing_city, billing_state, billing_zip,
              billing_phone
            )
          )
        `)
        .eq("id", orderId)
        .maybeSingle(),
      adminClient
        .from("order_ivr")
        .select(
          "insurance_provider, member_id, group_number, plan_name, " +
          "subscriber_name, subscriber_dob, subscriber_relationship, " +
          "patient_address, patient_phone",
        )
        .eq("order_id", orderId)
        .maybeSingle(),
      adminClient
        .from("order_items")
        .select("product_name, hcpcs_code, quantity, unit_price, total_amount")
        .eq("order_id", orderId),
    ]);

    const order = orderRes.data as {
      icd10_code: string | null;
      date_of_service: string | null;
      patient: { first_name: string | null; last_name: string | null; date_of_birth: string | null } | null;
      facility: {
        name: string | null;
        phone: string | null;
        address_line_1: string | null;
        facility_enrollment:
          | {
              facility_npi: string | null;
              facility_tin: string | null;
              facility_ein: string | null;
              billing_address: string | null;
              billing_city: string | null;
              billing_state: string | null;
              billing_zip: string | null;
              billing_phone: string | null;
            }[]
          | null;
      } | null;
    } | null;

    if (!order) return { success: false, error: "Order not found." };

    // Supabase joins return facility_enrollment as an array — take the first.
    const enrollmentRaw = order.facility?.facility_enrollment;
    const enrollment = Array.isArray(enrollmentRaw) ? enrollmentRaw[0] : enrollmentRaw;

    // Compose a single billing address line from the enrollment fields.
    const billingAddress = enrollment
      ? [
          enrollment.billing_address,
          [enrollment.billing_city, enrollment.billing_state]
            .filter(Boolean)
            .join(", "),
          enrollment.billing_zip,
        ]
          .filter(Boolean)
          .join(" ") || null
      : null;

    const ivr = ivrRes.data as {
      insurance_provider: string | null;
      member_id: string | null;
      group_number: string | null;
      plan_name: string | null;
      subscriber_name: string | null;
      subscriber_dob: string | null;
      subscriber_relationship: string | null;
      patient_address: string | null;
      patient_phone: string | null;
    } | null;
    const items = (itemsRes.data ?? []) as Array<{
      product_name: string | null;
      hcpcs_code: string | null;
      quantity: number | null;
      unit_price: number | null;
      total_amount: number | null;
    }>;

    // Build service lines (Box 24). One row per order_item. Place of
    // service "11" (office) is a sensible default — biller can change it.
    const serviceLines = items.map((item) => ({
      id: crypto.randomUUID(),
      dos_from: order.date_of_service ?? "",
      dos_to: order.date_of_service ?? "",
      place_of_service: "11",
      emg: false,
      cpt_code: item.hcpcs_code ?? "",
      modifier_1: "",
      modifier_2: "",
      modifier_3: "",
      modifier_4: "",
      diagnosis_pointer: "A",
      charges: item.total_amount != null ? String(item.total_amount) : "",
      days_units: item.quantity != null ? String(item.quantity) : "1",
      epsdt: "",
      id_qualifier: "",
      rendering_npi: "",
    }));

    // Total charge = sum of line items.
    const totalCharge = items.reduce(
      (sum, it) => sum + Number(it.total_amount ?? 0),
      0,
    );

    const payload = {
      order_id: orderId,
      // Box 1a / 11 — insurance
      insured_id_number: ivr?.member_id ?? null,
      insurance_name: ivr?.insurance_provider ?? null,
      insured_policy_group: ivr?.group_number ?? null,
      insured_plan_name: ivr?.plan_name ?? null,
      // Box 4 / 11 — insured (subscriber). If the patient IS the subscriber,
      // we'd need to set patient_relationship = "Self" — leaving for biller.
      insured_last_name:
        ivr?.subscriber_name?.split(/\s+/).slice(-1)[0] ?? null,
      insured_first_name:
        ivr?.subscriber_name?.split(/\s+/).slice(0, -1).join(" ") ?? null,
      insured_dob: ivr?.subscriber_dob ?? null,
      patient_relationship: ivr?.subscriber_relationship ?? null,
      // Box 2 / 3 — patient
      patient_first_name: order.patient?.first_name ?? null,
      patient_last_name: order.patient?.last_name ?? null,
      patient_dob: order.patient?.date_of_birth ?? null,
      // Box 5 — patient contact
      patient_address: ivr?.patient_address ?? null,
      patient_phone: ivr?.patient_phone ?? null,
      // Box 21 — diagnosis
      diagnosis_a: order.icd10_code ?? null,
      // Box 24 — service lines
      service_lines: serviceLines,
      // Box 25 — federal tax ID
      federal_tax_id: enrollment?.facility_tin ?? enrollment?.facility_ein ?? null,
      // Box 28 — total charge
      total_charge: totalCharge > 0 ? String(totalCharge.toFixed(2)) : null,
      // Box 32 — service facility
      service_facility_name: order.facility?.name ?? null,
      service_facility_address: billingAddress,
      service_facility_npi: enrollment?.facility_npi ?? null,
      // Box 33 — billing provider
      billing_provider_name: order.facility?.name ?? null,
      billing_provider_address: billingAddress,
      billing_provider_phone: enrollment?.billing_phone ?? order.facility?.phone ?? null,
      billing_provider_npi: enrollment?.facility_npi ?? null,
      billing_provider_tax_id: enrollment?.facility_tin ?? null,
      // Box 31 — physician signature: intentionally left blank per spec.
      // Biller handles signing in their billing software.
    };

    const { error } = await adminClient
      .from("order_form_1500")
      .insert(payload);

    if (error) {
      safeLogError("seedForm1500ForDelivery", error, { orderId });
      return { success: false, error: "Failed to seed CMS-1500 form." };
    }

    return { success: true };
  } catch (err) {
    safeLogError("seedForm1500ForDelivery", err, { orderId });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* upsertForm1500                                                             */
/*                                                                            */
/* Concurrency model — last-writer-wins with a conflict check.                */
/*   - The caller passes the `ifMatchUpdatedAt` it originally read.           */
/*   - We compare against the current row's `updated_at` before writing.      */
/*   - If someone else saved between read and write, we return `conflict`     */
/*     so the client can show "Reload" instead of silently overwriting.       */
/*   - First-time save (no row yet) skips the check.                          */
/*                                                                            */
/* The returned `updatedAt` becomes the new baseline for the client's next    */
/* save attempt.                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertForm1500(
  orderId: string,
  formData: Record<string, unknown>,
  ifMatchUpdatedAt?: string | null,
): Promise<{
  success: boolean;
  error?: string;
  conflict?: boolean;
  updatedAt?: string;
}> {
  try {
    await requireOrderAccess(orderId);
    const adminClient = createAdminClient();

    if (ifMatchUpdatedAt) {
      const { data: current } = await adminClient
        .from("order_form_1500")
        .select("updated_at")
        .eq("order_id", orderId)
        .maybeSingle();

      if (current && current.updated_at !== ifMatchUpdatedAt) {
        return {
          success: false,
          conflict: true,
          error:
            "Someone else saved this form while you were editing. Reload to see their changes.",
        };
      }
    }

    const nowIso = new Date().toISOString();
    const { data: saved, error } = await adminClient
      .from("order_form_1500")
      .upsert(
        {
          order_id: orderId,
          ...formData,
          updated_at: nowIso,
        },
        { onConflict: "order_id" },
      )
      .select("updated_at")
      .single();

    if (error) {
      safeLogError("upsertForm1500", error, { orderId });
      return { success: false, error: "Failed to save form." };
    }

    return { success: true, updatedAt: saved?.updated_at ?? nowIso };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
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
