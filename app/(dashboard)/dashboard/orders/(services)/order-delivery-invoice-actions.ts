"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import type {
  AcknowledgementMap,
  DeliveryMethod,
  IDeliveryInvoice,
  IDeliveryInvoiceLineItem,
  RentOrPurchase,
  SignerRelationship,
} from "@/utils/interfaces/orders";
import { ORDERS_PATH, generateOrderPDFs } from "./_shared";

const DEFAULT_ACKNOWLEDGEMENTS: AcknowledgementMap = {
  medicare_supplier_standards:    true,
  training_safe_use:              true,
  complaint_grievance:            true,
  warranty_information:           true,
  rights_responsibilities:        true,
  hipaa_privacy:                  true,
  safety_packet:                  true,
  maintenance_cleaning:           true,
  medical_info_authorization:     true,
  written_instructions:           true,
  repair_return_policy:           true,
  return_demo:                    true,
  capped_rental_info:             true,
  emergency_preparedness:         true,
  mission_statement:              true,
  financial_responsibility:       true,
  acceptance_of_services:         true,
  participation_plan_of_care:     true,
  patient_rental_purchase_option: true,
};

// Invoice number is derived from the order number so admins can correlate at
// a glance: HBM-20260423-CX1K → MSS-20260423-CX1K.
function buildInvoiceNumber(orderNumber: string | null | undefined): string {
  if (!orderNumber) return "MSS-DRAFT";
  return orderNumber.replace(/^HBM-/i, "MSS-");
}

function rowToInterface(row: any): IDeliveryInvoice {
  return {
    id:               row.id,
    orderId:          row.order_id,
    invoiceNumber:    row.invoice_number,
    invoiceDate:      row.invoice_date,
    customerName:     row.customer_name,
    addressLine1:     row.address_line_1,
    addressLine2:     row.address_line_2,
    city:             row.city,
    state:            row.state,
    postalCode:       row.postal_code,
    insuranceName:    row.insurance_name,
    insuranceNumber:  row.insurance_number,
    doctorName:       row.doctor_name,
    deliveryMethod:   (row.delivery_method ?? null) as DeliveryMethod | null,
    lineItems:        Array.isArray(row.line_items) ? (row.line_items as IDeliveryInvoiceLineItem[]) : [],
    rentOrPurchase:   (row.rent_or_purchase ?? null) as RentOrPurchase | null,
    dueCopay:         row.due_copay !== null && row.due_copay !== undefined ? Number(row.due_copay) : null,
    totalReceived:    row.total_received !== null && row.total_received !== undefined ? Number(row.total_received) : null,
    acknowledgements: (row.acknowledgements ?? DEFAULT_ACKNOWLEDGEMENTS) as AcknowledgementMap,
    patientSignatureUrl: row.patient_signature_url ?? null,
    patientSignedAt:     row.patient_signed_at ?? null,
    relationship:        (row.relationship ?? null) as SignerRelationship | null,
    createdAt:           row.created_at ?? null,
    updatedAt:           row.updated_at ?? null,
  };
}

/**
 * Returns the saved delivery invoice for the order, OR a prefilled draft
 * composed from order_ivr / order_form / order data when no row exists yet.
 *
 * Pure read — never inserts. The first save is what creates the row.
 */
export async function getOrderDeliveryInvoice(
  orderId: string,
): Promise<{ invoice: IDeliveryInvoice | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const [invoiceRes, orderRes, ivrRes, itemsRes] = await Promise.all([
      supabase
        .from("order_delivery_invoices")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select(`
          order_number, date_of_service, assigned_provider_id, created_by,
          patient:patients!orders_patient_id_fkey(first_name, last_name)
        `)
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("order_ivr")
        .select(`
          patient_address,
          insurance_provider, member_id,
          physician_name
        `)
        .eq("order_id", orderId)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("product_name, product_sku, hcpcs_code, unit_price, quantity, total_amount")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

    if (invoiceRes.data) {
      return { invoice: rowToInterface(invoiceRes.data), error: null };
    }

    const order = orderRes.data as any;
    const ivr = ivrRes.data as any;
    if (!order) {
      return { invoice: null, error: "Order not found." };
    }

    const patientName = order.patient
      ? `${order.patient.first_name ?? ""} ${order.patient.last_name ?? ""}`.trim()
      : "";

    // Pre-fill line items from order_items snapshot. HCPCS comes from the
    // denormalized column we copy at order-add time (so a product edit later
    // doesn't change historical invoices).
    const orderItems = (itemsRes.data ?? []) as Array<{
      product_name: string;
      product_sku: string;
      hcpcs_code: string | null;
      unit_price: number | string;
      quantity: number;
      total_amount: number | string | null;
    }>;
    const prefillLineItems: IDeliveryInvoiceLineItem[] = orderItems.map((it) => ({
      date: order.date_of_service ?? null,
      qty: Number(it.quantity ?? 0),
      hcpc: it.hcpcs_code ?? null,
      // Mirror what's printed: include SKU if present so the row is self-describing.
      description: it.product_sku
        ? `${it.product_name} (${it.product_sku})`
        : it.product_name,
      perEach: it.unit_price != null ? Number(it.unit_price) : null,
      total: it.total_amount != null ? Number(it.total_amount) : Number(it.unit_price ?? 0) * Number(it.quantity ?? 0),
    }));

    const draft: IDeliveryInvoice = {
      id:               null,
      orderId,
      invoiceNumber:    buildInvoiceNumber(order.order_number),
      invoiceDate:      order.date_of_service ?? new Date().toISOString().slice(0, 10),
      customerName:     patientName || null,
      // order_ivr stores the full address in one field; admin can split it
      // into the invoice's structured fields when finalizing.
      addressLine1:     ivr?.patient_address ?? null,
      addressLine2:     null,
      city:             null,
      state:            null,
      postalCode:       null,
      insuranceName:    ivr?.insurance_provider ?? null,
      insuranceNumber:  ivr?.member_id ?? null,
      doctorName:       ivr?.physician_name ?? null,
      deliveryMethod:   null,
      lineItems:        prefillLineItems,
      rentOrPurchase:   null,
      dueCopay:         null,
      totalReceived:    null,
      acknowledgements: { ...DEFAULT_ACKNOWLEDGEMENTS },
      patientSignatureUrl: null,
      patientSignedAt:     null,
      relationship:        null,
      createdAt: null,
      updatedAt: null,
    };

    return { invoice: draft, error: null };
  } catch (err) {
    console.error("[getOrderDeliveryInvoice]", err);
    return { invoice: null, error: "Failed to load invoice." };
  }
}

export interface UpsertDeliveryInvoiceInput {
  invoiceNumber:    string;
  invoiceDate:      string | null;
  customerName:     string | null;
  addressLine1:     string | null;
  addressLine2:     string | null;
  city:             string | null;
  state:            string | null;
  postalCode:       string | null;
  insuranceName:    string | null;
  insuranceNumber:  string | null;
  doctorName:       string | null;
  deliveryMethod:   DeliveryMethod | null;
  lineItems:        IDeliveryInvoiceLineItem[];
  rentOrPurchase:   RentOrPurchase | null;
  dueCopay:         number | null;
  totalReceived:    number | null;
  acknowledgements: AcknowledgementMap;
}

export async function upsertOrderDeliveryInvoice(
  orderId: string,
  input: UpsertDeliveryInvoiceInput,
): Promise<{ success: boolean; invoice: IDeliveryInvoice | null; error: string | null }> {
  try {
    const supabase = await createClient();
    await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();

    const payload = {
      order_id:            orderId,
      invoice_number:      input.invoiceNumber,
      invoice_date:        input.invoiceDate,
      customer_name:       input.customerName,
      address_line_1:      input.addressLine1,
      address_line_2:      input.addressLine2,
      city:                input.city,
      state:               input.state,
      postal_code:         input.postalCode,
      insurance_name:      input.insuranceName,
      insurance_number:    input.insuranceNumber,
      doctor_name:         input.doctorName,
      delivery_method:     input.deliveryMethod,
      line_items:          input.lineItems ?? [],
      rent_or_purchase:    input.rentOrPurchase,
      due_copay:           input.dueCopay,
      total_received:      input.totalReceived,
      acknowledgements:    input.acknowledgements ?? DEFAULT_ACKNOWLEDGEMENTS,
    };

    const { data, error } = await adminClient
      .from("order_delivery_invoices")
      .upsert(payload, { onConflict: "order_id" })
      .select("*")
      .single();

    if (error) {
      console.error("[upsertOrderDeliveryInvoice] upsert:", error);
      return { success: false, invoice: null, error: error.message };
    }

    // Regenerate the invoice PDF in the background; intentionally not awaited
    // so the form save feels instant. PayoutsTab-style "regenerating" badge in
    // the modal is driven by the existing pdf-regenerating event mechanism.
    generateOrderPDFs(orderId, ["delivery_invoice"]).catch((err) =>
      console.error("[upsertOrderDeliveryInvoice] PDF regen:", err),
    );

    revalidatePath(ORDERS_PATH);

    return { success: true, invoice: rowToInterface(data), error: null };
  } catch (err) {
    console.error("[upsertOrderDeliveryInvoice]", err);
    return {
      success: false,
      invoice: null,
      error: err instanceof Error ? err.message : "Failed to save invoice.",
    };
  }
}
