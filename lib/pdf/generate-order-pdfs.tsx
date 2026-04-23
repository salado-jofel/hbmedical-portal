/** @jsxImportSource react */
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderFormPDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/OrderFormPDF";
import { IVRFormPDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/IVRFormPDF";
import { DeliveryInvoicePDF } from "@/app/(dashboard)/dashboard/orders/(pdf)/DeliveryInvoicePDF";
import { generateFilledCMS1500 } from "@/lib/pdf/generate-cms1500";

export type OrderPdfFormType = "order_form" | "ivr" | "hcfa_1500" | "delivery_invoice";

export interface GenerateOrderPdfResult {
  success: boolean;
  formType: OrderPdfFormType;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export async function generateOrderPdf(
  orderId: string,
  formType: OrderPdfFormType,
  adminClient: SupabaseClient = createAdminClient(),
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
          order_items(id, product_sku, product_name, quantity, unit_price)
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

    if (formType === "order_form") {
      pdfBuffer = await renderToBuffer(<OrderFormPDF order={order} form={form} />);
      fileName = `order-form-${order.order_number}.pdf`;
      documentType = "order_form";
    } else if (formType === "ivr") {
      pdfBuffer = await renderToBuffer(
        <IVRFormPDF order={order} ivr={ivr} form={form} physicianName={pdfPhysicianName} />,
      );
      fileName = `ivr-form-${order.order_number}.pdf`;
      documentType = "additional_ivr";
    } else if (formType === "hcfa_1500") {
      const filled = await generateFilledCMS1500(hcfa ?? {});
      pdfBuffer = Buffer.from(filled);
      fileName = `hcfa-1500-${order.order_number}.pdf`;
      documentType = "form_1500";
    } else if (formType === "delivery_invoice") {
      pdfBuffer = await renderToBuffer(
        <DeliveryInvoicePDF order={order} invoice={deliveryInvoice} />,
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
      await adminClient
        .from("order_documents")
        .update({ file_size: pdfBuffer.length })
        .eq("id", existing.id);
    } else {
      await adminClient.from("order_documents").insert({
        order_id: orderId,
        document_type: documentType,
        bucket: "hbmedical-bucket-private",
        file_path: filePath,
        file_name: fileName,
        mime_type: "application/pdf",
        file_size: pdfBuffer.length,
      });
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
