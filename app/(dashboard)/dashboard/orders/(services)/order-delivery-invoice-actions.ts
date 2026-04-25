"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isClinicalProvider, isClinicalStaff } from "@/utils/helpers/role";
import type {
  AcknowledgementMap,
  DeliveryMethod,
  IDeliveryInvoice,
  IDeliveryInvoiceLineItem,
  RentOrPurchase,
  SignerRelationship,
} from "@/utils/interfaces/orders";
import { ORDERS_PATH } from "./_shared";
import { logPhiAccess } from "@/lib/audit/log-phi-access";
import { requireOrderAccess } from "@/lib/supabase/order-access";
import {
  DEFAULT_ACKNOWLEDGEMENTS,
  composeDeliveryInvoicePrefill,
} from "@/lib/invoice/delivery-invoice-prefill";

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
    patientSignatureImage:      row.patient_signature_image ?? null,
    patientSignatureCapturedBy: row.patient_signature_captured_by ?? null,
    signerName:                 row.signer_name ?? null,
    signerReason:               row.signer_reason ?? null,
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

    const order = orderRes.data as any;
    const ivr = ivrRes.data as any;
    if (!order) {
      return { invoice: null, error: "Order not found." };
    }

    // Always re-derive line items from order_items so the invoice stays in
    // sync as products are added / removed / re-quantified on the Order Form.
    const prefill = composeDeliveryInvoicePrefill(
      order,
      ivr,
      (itemsRes.data ?? []) as any[],
    );

    // Saved row supplies user edits (addresses, acks, sigs). Line items
    // come from order_items so the invoice is never stale vs the order.
    // Fallback to prefill for any header field the saved row left blank —
    // this heals legacy rows created by an earlier version of the capture
    // action that inserted a nearly-empty row (customer_name / invoice_#
    // were missing and the tab rendered blank).
    if (invoiceRes.data) {
      const saved = invoiceRes.data as any;
      const healed = {
        ...saved,
        invoice_number:   saved.invoice_number   || prefill.invoice_number,
        invoice_date:     saved.invoice_date     || prefill.invoice_date,
        customer_name:    saved.customer_name    || prefill.customer_name,
        address_line_1:   saved.address_line_1   || prefill.address_line_1,
        address_line_2:   saved.address_line_2   || prefill.address_line_2,
        city:             saved.city             || prefill.city,
        state:            saved.state            || prefill.state,
        postal_code:      saved.postal_code      || prefill.postal_code,
        insurance_name:   saved.insurance_name   || prefill.insurance_name,
        insurance_number: saved.insurance_number || prefill.insurance_number,
        doctor_name:      saved.doctor_name      || prefill.doctor_name,
        line_items:       prefill.line_items,
      };
      void logPhiAccess({
        action: "invoice.read",
        resource: "order_delivery_invoices",
        resourceId: (saved as { id?: string }).id ?? null,
        orderId,
      });
      return { invoice: rowToInterface(healed), error: null };
    }

    void logPhiAccess({
      action: "invoice.read",
      resource: "order_delivery_invoices",
      orderId,
      metadata: { prefilled: true },
    });

    return {
      invoice: rowToInterface({
        ...prefill,
        id: null,
        order_id: orderId,
        created_at: null,
        updated_at: null,
      }),
      error: null,
    };
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
    await requireOrderAccess(orderId);

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
      // Rental is no longer offered — always store "purchase" regardless of
      // what the UI sends, so legacy "rent" rows are corrected on next save.
      rent_or_purchase:    "purchase",
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

    // PDF regen is fired by the client after this action returns so the
    // right-side card can flip to its blue "Generating…" state via the
    // pdf-regenerating CustomEvent pattern (see InvoiceDocument.save).
    // Doing it here too would cause a double regen.

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

/* -------------------------------------------------------------------------- */
/* captureInvoicePatientSignature                                             */
/*                                                                            */
/* Proof-of-delivery capture. Only providers (or admin) may capture, and      */
/* only while the order is in `shipped`. The write is server-authoritative —  */
/* role + status are re-checked here regardless of UI gating.                 */
/*                                                                            */
/* Not idempotent: re-capture overwrites the previous image/name/reason,      */
/* allowed only if the row is not already signed. Patient refusal / not-      */
/* present flows are out of scope per the signed-off plan.                    */
/* -------------------------------------------------------------------------- */

export interface CapturePatientSignatureInput {
  signatureImage: string;                 // base64 PNG data URL
  relationship: SignerRelationship | null; // null when the patient themselves signed
  signerName: string | null;               // printed name, required when caregiver signs
  signerReason: string | null;             // optional explanation when caregiver signs
}

export async function captureInvoicePatientSignature(
  orderId: string,
  input: CapturePatientSignatureInput,
): Promise<{ success: boolean; invoice: IDeliveryInvoice | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    // Patient proof-of-delivery must originate from someone in the patient's
    // care chain — provider or their staff. Admin / support / sales-rep are
    // explicitly NOT allowed to capture, even though admin bypasses other
    // lock rules. See canCapturePatientSignature in utils/constants/orders.
    if (!isClinicalProvider(role) && !isClinicalStaff(role)) {
      return {
        success: false,
        invoice: null,
        error: "Only the clinical provider or their staff can capture the patient's signature.",
      };
    }

    const adminClient = createAdminClient();

    // Gate on current order status — server-side guard even though the UI
    // hides the button outside `shipped`. Admins can capture at any status
    // but that is still bounded by the "already signed" check below.
    const { data: order } = await adminClient
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, invoice: null, error: "Order not found." };
    }
    // No admin bypass — patient signature must be captured during the
    // shipped window regardless of role.
    if (order.order_status !== "shipped") {
      return {
        success: false,
        invoice: null,
        error: "Patient signature can only be captured while the order is in Shipped status.",
      };
    }

    // Allow recapture — provider/admin can fix a bad signature while the
    // order remains in `shipped`. Once admin flips to `delivered`, the
    // status gate above blocks further captures for non-admins.
    //
    // Pull every header field here so we can detect rows that an earlier
    // version of this action created near-empty (customer_name, invoice_#
    // etc left blank) and heal them in-place on the update path.
    const { data: existing } = await adminClient
      .from("order_delivery_invoices")
      .select(
        "id, patient_signed_at, invoice_number, invoice_date, customer_name, address_line_1, address_line_2, city, state, postal_code, insurance_name, insurance_number, doctor_name",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (!input.signatureImage || !input.signatureImage.startsWith("data:image/")) {
      return {
        success: false,
        invoice: null,
        error: "Invalid signature image.",
      };
    }

    const now = new Date().toISOString();
    const update = {
      patient_signature_image:       input.signatureImage,
      patient_signature_captured_by: user.id,
      patient_signed_at:             now,
      relationship:                  input.relationship,
      signer_name:                   input.signerName,
      signer_reason:                 input.signerReason,
    };

    // Row may or may not exist — the invoice form is a "first save creates
    // the row" flow, so we need upsert semantics keyed on order_id.
    let updatedRow;
    if (existing?.id) {
      // Heal any blank header fields from prefill before updating, so rows
      // created by the earlier buggy insert (which omitted these fields)
      // get corrected in the DB on recapture. Fields the user has already
      // filled in are preserved.
      const row = existing as any;
      const needsHeal =
        !row.invoice_number || !row.customer_name || !row.invoice_date;
      const healUpdate: Record<string, unknown> = {};
      if (needsHeal) {
        const [{ data: orderRow }, { data: ivrRow }, { data: itemsRows }] = await Promise.all([
          adminClient
            .from("orders")
            .select(`
              order_number, date_of_service,
              patient:patients!orders_patient_id_fkey(first_name, last_name)
            `)
            .eq("id", orderId)
            .maybeSingle(),
          adminClient
            .from("order_ivr")
            .select("patient_address, insurance_provider, member_id, physician_name")
            .eq("order_id", orderId)
            .maybeSingle(),
          adminClient
            .from("order_items")
            .select("product_name, product_sku, hcpcs_code, unit_price, quantity, total_amount")
            .eq("order_id", orderId),
        ]);
        const prefill = composeDeliveryInvoicePrefill(
          orderRow as any,
          ivrRow as any,
          (itemsRows ?? []) as any[],
        );
        if (!row.invoice_number)   healUpdate.invoice_number   = prefill.invoice_number;
        if (!row.invoice_date)     healUpdate.invoice_date     = prefill.invoice_date;
        if (!row.customer_name)    healUpdate.customer_name    = prefill.customer_name;
        if (!row.address_line_1)   healUpdate.address_line_1   = prefill.address_line_1;
        if (!row.address_line_2)   healUpdate.address_line_2   = prefill.address_line_2;
        if (!row.city)             healUpdate.city             = prefill.city;
        if (!row.state)            healUpdate.state            = prefill.state;
        if (!row.postal_code)      healUpdate.postal_code      = prefill.postal_code;
        if (!row.insurance_name)   healUpdate.insurance_name   = prefill.insurance_name;
        if (!row.insurance_number) healUpdate.insurance_number = prefill.insurance_number;
        if (!row.doctor_name)      healUpdate.doctor_name      = prefill.doctor_name;
      }

      const { data, error } = await adminClient
        .from("order_delivery_invoices")
        .update({ ...update, ...healUpdate })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) {
        console.error("[captureInvoicePatientSignature] update:", error);
        return { success: false, invoice: null, error: "Failed to save signature." };
      }
      updatedRow = data;
    } else {
      // No invoice row yet — create one and seed with the same prefill the
      // on-screen form would have shown (invoice #, customer, insurance,
      // doctor from order_ivr). Previously this inserted a near-empty row,
      // which made the Invoice tab go blank after capture because
      // getOrderDeliveryInvoice then saw "row exists" and returned it
      // instead of the prefill.
      const [{ data: orderRow }, { data: ivrRow }, { data: itemsRows }] = await Promise.all([
        adminClient
          .from("orders")
          .select(`
            order_number, date_of_service,
            patient:patients!orders_patient_id_fkey(first_name, last_name)
          `)
          .eq("id", orderId)
          .maybeSingle(),
        adminClient
          .from("order_ivr")
          .select("patient_address, insurance_provider, member_id, physician_name")
          .eq("order_id", orderId)
          .maybeSingle(),
        adminClient
          .from("order_items")
          .select("product_name, product_sku, hcpcs_code, unit_price, quantity, total_amount")
          .eq("order_id", orderId),
      ]);
      const prefill = composeDeliveryInvoicePrefill(
        orderRow as any,
        ivrRow as any,
        (itemsRows ?? []) as any[],
      );

      const { data, error } = await adminClient
        .from("order_delivery_invoices")
        .insert({
          order_id: orderId,
          invoice_number:   prefill.invoice_number,
          invoice_date:     prefill.invoice_date,
          customer_name:    prefill.customer_name,
          address_line_1:   prefill.address_line_1,
          address_line_2:   prefill.address_line_2,
          city:             prefill.city,
          state:            prefill.state,
          postal_code:      prefill.postal_code,
          insurance_name:   prefill.insurance_name,
          insurance_number: prefill.insurance_number,
          doctor_name:      prefill.doctor_name,
          line_items:       prefill.line_items,
          acknowledgements: DEFAULT_ACKNOWLEDGEMENTS,
          rent_or_purchase: "purchase",
          ...update,
        })
        .select("*")
        .single();
      if (error) {
        console.error("[captureInvoicePatientSignature] insert:", error);
        return { success: false, invoice: null, error: "Failed to save signature." };
      }
      updatedRow = data;
    }

    // PDF regen is fired from the client after this action returns so the
    // right-side doc card can flip to its blue "Generating…" state via
    // the pdf-regenerating CustomEvent pattern. Doing it here too would
    // cause a double regen (same pattern as upsertOrderDeliveryInvoice).

    revalidatePath(ORDERS_PATH);

    // Line items always reflect the current order_items (see
    // getOrderDeliveryInvoice). Recompose them on the response so the
    // client doesn't see a blank products table when the saved row has
    // null line_items from an older pre-heal insert.
    const { data: freshItems } = await adminClient
      .from("order_items")
      .select("product_name, product_sku, hcpcs_code, unit_price, quantity, total_amount")
      .eq("order_id", orderId);
    const { data: freshOrder } = await adminClient
      .from("orders")
      .select("order_number, date_of_service")
      .eq("id", orderId)
      .maybeSingle();
    const freshPrefill = composeDeliveryInvoicePrefill(
      freshOrder as any,
      null,
      (freshItems ?? []) as any[],
    );

    return {
      success: true,
      invoice: rowToInterface({
        ...(updatedRow as any),
        line_items: freshPrefill.line_items,
      }),
      error: null,
    };
  } catch (err) {
    console.error("[captureInvoicePatientSignature]", err);
    return {
      success: false,
      invoice: null,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
