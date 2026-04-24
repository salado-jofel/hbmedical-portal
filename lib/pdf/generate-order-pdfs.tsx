/** @jsxImportSource react */
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderFormPDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/OrderFormPDF";
import { IVRFormPDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/IVRFormPDF";
import { DeliveryInvoicePDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/DeliveryInvoicePDF";
import { generateFilledCMS1500 } from "@/lib/pdf/generate-cms1500";
import { composeDeliveryInvoicePrefill } from "@/lib/invoice/delivery-invoice-prefill";

export type OrderPdfFormType = "order_form" | "ivr" | "hcfa_1500" | "delivery_invoice";

export interface GenerateOrderPdfResult {
  success: boolean;
  formType: OrderPdfFormType;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface GenerateOrderPdfOptions {
  /**
   * In-memory specimen signature (PNG data URL). Embedded at the physician
   * signature spot on Order Form / IVR PDFs when present. Not persisted —
   * provided by the sign action so this one-shot render captures the
   * signature before it's discarded.
   */
  signatureImage?: string;
  /**
   * Bypass the is_locked guard. Used by the sign action itself so it can
   * produce the signed PDF in the same transaction as the lock flip.
   * All other callers leave this false — signed forms keep their frozen PDF.
   */
  ignoreLock?: boolean;
}

export async function generateOrderPdf(
  orderId: string,
  formType: OrderPdfFormType,
  adminClient: SupabaseClient = createAdminClient(),
  options: GenerateOrderPdfOptions = {},
): Promise<GenerateOrderPdfResult> {
  try {
    const [orderRes, formRes, ivrRes, hcfaRes, deliveryInvoiceRes] = await Promise.all([
      adminClient
        .from("orders")
        .select(`
          id, order_number, wound_type, date_of_service,
          created_by, assigned_provider_id, signed_by, signed_at,
          facility:facilities!orders_facility_id_fkey(name),
          patient:patients!orders_patient_id_fkey(
            first_name, last_name, date_of_birth
          ),
          order_items(id, product_sku, product_name, hcpcs_code, quantity, unit_price, total_amount)
        `)
        .eq("id", orderId)
        .single(),
      adminClient.from("order_form").select("*").eq("order_id", orderId).maybeSingle(),
      adminClient.from("order_ivr").select("*").eq("order_id", orderId).maybeSingle(),
      adminClient.from("order_form_1500").select("*").eq("order_id", orderId).maybeSingle(),
      adminClient.from("order_delivery_invoices").select("*").eq("order_id", orderId).maybeSingle(),
    ]);

    const order = orderRes.data;
    const form = formRes.data;
    const ivr = ivrRes.data;
    const hcfa = hcfaRes.data;
    const deliveryInvoice = deliveryInvoiceRes.data;

    if (!order) {
      return { success: false, formType, error: "Order not found" };
    }

    // No lock guard — saves always produce a fresh PDF, signed or not.
    // The sign action still passes a signatureImage in-memory for its
    // one-shot render; subsequent saves rebuild the PDF without it
    // (because we don't persist the signature), which is the intended
    // behavior: editing after signing invalidates the signed visual, and
    // the provider re-signs to get a new stamped PDF.

    let pdfPhysicianName: string | null = null;
    if (formType === "ivr") {
      const providerId = order.assigned_provider_id || order.created_by;
      if (providerId) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", providerId)
          .maybeSingle();
        if (profile) {
          pdfPhysicianName =
            `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;
        }
      }
    }

    let pdfBuffer: Buffer;
    let fileName: string;
    let documentType: string;

    // Prefer the in-memory override (sign action's one-shot render) over
    // the persisted column; fall back to the persisted column so ordinary
    // saves / regens also embed the signature once it's been committed.
    const persistedOrderFormSig =
      ((form as any)?.physician_signature_image as string | null | undefined) ?? undefined;
    const persistedIvrSig =
      ((ivr as any)?.physician_signature_image as string | null | undefined) ?? undefined;

    if (formType === "order_form") {
      pdfBuffer = await renderToBuffer(
        <OrderFormPDF
          order={order}
          form={form}
          signatureImage={options.signatureImage ?? persistedOrderFormSig}
        />,
      );
      fileName = `order-form-${order.order_number}.pdf`;
      documentType = "order_form";
    } else if (formType === "ivr") {
      pdfBuffer = await renderToBuffer(
        <IVRFormPDF
          order={order}
          ivr={ivr}
          form={form}
          physicianName={pdfPhysicianName}
          signatureImage={options.signatureImage ?? persistedIvrSig}
        />,
      );
      fileName = `ivr-form-${order.order_number}.pdf`;
      documentType = "additional_ivr";
    } else if (formType === "hcfa_1500") {
      const filled = await generateFilledCMS1500(hcfa ?? {});
      pdfBuffer = Buffer.from(filled);
      fileName = `hcfa-1500-${order.order_number}.pdf`;
      documentType = "form_1500";
    } else if (formType === "delivery_invoice") {
      // Always re-derive line items from order_items so the PDF matches the
      // current order. Saved row provides user edits (addresses, acks) when
      // it exists; falls back to full prefill when it doesn't.
      const prefill = composeDeliveryInvoicePrefill(
        order as any,
        ivr as any,
        ((order as any).order_items ?? []) as any[],
      );
      const invoicePayload = deliveryInvoice
        ? { ...deliveryInvoice, line_items: prefill.line_items }
        : prefill;
      pdfBuffer = await renderToBuffer(
        <DeliveryInvoicePDF order={order} invoice={invoicePayload} />,
      );
      fileName = `invoice-${order.order_number}.pdf`;
      documentType = "delivery_invoice";
    } else {
      return { success: false, formType, error: "Invalid formType" };
    }

    const filePath = `order-documents/${orderId}/generated/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from("hbmedical-bucket-private")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, formType, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: existing } = await adminClient
      .from("order_documents")
      .select("id")
      .eq("order_id", orderId)
      .eq("file_path", filePath)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await adminClient
        .from("order_documents")
        .update({ file_size: pdfBuffer.length })
        .eq("id", existing.id);
      if (updateErr) {
        // Don't fail the request — PDF is in storage — but surface so we
        // don't repeat the old bug where a CHECK constraint silently
        // blocked inserts and the card stayed yellow forever.
        console.error(`[generateOrderPdf:${formType}] order_documents update:`, updateErr);
      }
    } else {
      const { error: insertErr } = await adminClient.from("order_documents").insert({
        order_id: orderId,
        document_type: documentType,
        bucket: "hbmedical-bucket-private",
        file_path: filePath,
        file_name: fileName,
        mime_type: "application/pdf",
        file_size: pdfBuffer.length,
      });
      if (insertErr) {
        console.error(`[generateOrderPdf:${formType}] order_documents insert:`, insertErr);
        return { success: false, formType, error: `order_documents insert failed: ${insertErr.message}` };
      }
    }

    return { success: true, formType, filePath, fileName };
  } catch (err) {
    return {
      success: false,
      formType,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
