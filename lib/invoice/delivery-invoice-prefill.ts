import type {
  AcknowledgementMap,
  IDeliveryInvoiceLineItem,
} from "@/utils/interfaces/orders";

/**
 * Default acknowledgement set — every disclosure is marked as provided by
 * default ("Meridian reviewed the admission package and left a copy"). The
 * admin can toggle off a specific one on the Invoice form if a disclosure
 * was truly not provided.
 */
export const DEFAULT_ACKNOWLEDGEMENTS: AcknowledgementMap = {
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

// Derive the invoice number from the order number so admins can correlate
// the two at a glance: HBM-20260423-CX1K → MSS-20260423-CX1K.
export function buildInvoiceNumber(orderNumber: string | null | undefined): string {
  if (!orderNumber) return "MSS-DRAFT";
  return orderNumber.replace(/^HBM-/i, "MSS-");
}

/** Raw order data the composer needs (only the fields it reads). */
interface PrefillOrderInput {
  order_number?: string | null;
  date_of_service?: string | null;
  patient?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

interface PrefillIvrInput {
  patient_address?: string | null;
  insurance_provider?: string | null;
  member_id?: string | null;
  physician_name?: string | null;
}

interface PrefillOrderItemInput {
  product_name?: string | null;
  product_sku?: string | null;
  hcpcs_code?: string | null;
  unit_price?: number | string | null;
  quantity?: number | null;
  total_amount?: number | string | null;
}

/**
 * Shape returned matches a saved row from `order_delivery_invoices` — snake
 * case top-level columns, jsonb `line_items` with camelCase inner keys.
 * Both the DB row and this prefill object are accepted by DeliveryInvoicePDF.
 */
export interface DeliveryInvoicePrefill {
  invoice_number:      string;
  invoice_date:        string | null;
  customer_name:       string | null;
  address_line_1:      string | null;
  address_line_2:      string | null;
  city:                string | null;
  state:               string | null;
  postal_code:         string | null;
  insurance_name:      string | null;
  insurance_number:    string | null;
  doctor_name:         string | null;
  delivery_method:     null;
  line_items:          IDeliveryInvoiceLineItem[];
  rent_or_purchase:    null;
  due_copay:           null;
  total_received:      null;
  acknowledgements:    AcknowledgementMap;
  patient_signature_url: null;
  patient_signed_at:     null;
  relationship:          null;
  patient_signature_image:       null;
  patient_signature_captured_by: null;
  signer_name:                   null;
  signer_reason:                 null;
}

export function composeDeliveryInvoicePrefill(
  order: PrefillOrderInput | null,
  ivr: PrefillIvrInput | null,
  orderItems: PrefillOrderItemInput[],
): DeliveryInvoicePrefill {
  const patientName = order?.patient
    ? `${order.patient.first_name ?? ""} ${order.patient.last_name ?? ""}`.trim()
    : "";

  const lineItems: IDeliveryInvoiceLineItem[] = orderItems.map((it) => ({
    date: order?.date_of_service ?? null,
    qty: it.quantity != null ? Number(it.quantity) : null,
    hcpc: it.hcpcs_code ?? null,
    // Self-describing — include SKU after the name like the printed rows.
    description: it.product_sku
      ? `${it.product_name} (${it.product_sku})`
      : (it.product_name ?? null),
    perEach: it.unit_price != null ? Number(it.unit_price) : null,
    total:
      it.total_amount != null
        ? Number(it.total_amount)
        : it.unit_price != null && it.quantity != null
          ? Number(it.unit_price) * Number(it.quantity)
          : null,
  }));

  return {
    invoice_number:      buildInvoiceNumber(order?.order_number),
    invoice_date:        order?.date_of_service ?? new Date().toISOString().slice(0, 10),
    customer_name:       patientName || null,
    // order_ivr stores the full address in one field; admin can split into
    // structured fields (city/state/zip) when finalizing on the form.
    address_line_1:      ivr?.patient_address ?? null,
    address_line_2:      null,
    city:                null,
    state:               null,
    postal_code:         null,
    insurance_name:      ivr?.insurance_provider ?? null,
    insurance_number:    ivr?.member_id ?? null,
    doctor_name:         ivr?.physician_name ?? null,
    delivery_method:     null,
    line_items:          lineItems,
    rent_or_purchase:    null,
    due_copay:           null,
    total_received:      null,
    acknowledgements:    { ...DEFAULT_ACKNOWLEDGEMENTS },
    patient_signature_url: null,
    patient_signed_at:     null,
    relationship:          null,
    patient_signature_image:       null,
    patient_signature_captured_by: null,
    signer_name:                   null,
    signer_reason:                 null,
  };
}
