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

    // Non-blocking AI extraction for facesheet and clinical_docs
    if (["facesheet", "clinical_docs"].includes(documentType)) {
      triggerAiExtraction(orderId, documentType, filePath).catch((err) =>
        console.error("[uploadOrderDocument] AI trigger:", err),
      );
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

    generateOrderPDFs(orderId, ["hcfa_1500"]).catch(
      err => console.error("[HCFA PDF]", err),
    );

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
  const { data } = await supabase
    .from("order_form_1500")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  return data ?? null;
}
