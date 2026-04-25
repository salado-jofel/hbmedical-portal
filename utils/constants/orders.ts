import type {
  OrderBoardStatus,
  OrderDeliveryStatus,
  OrderFulfillmentStatus,
  OrderInvoiceStatus,
  OrderPaymentStatus,
} from "../interfaces/orders";

type OrderStatus = "draft" | "pending_signature" | "manufacturer_review" | "additional_info_needed" | "approved" | "shipped" | "canceled";

export const ORDER_TABLE = "orders";
export const ORDER_ITEMS_TABLE = "order_items";
export const FACILITY_TABLE = "facilities";
export const PRODUCT_TABLE = "products";

export const ORDERS_PATH = "/dashboard/orders";

export const DEFAULT_SHIPPING_AMOUNT = 0;
export const DEFAULT_TAX_AMOUNT = 0;

export const DEFAULT_ORDER_STATUS: OrderStatus = "draft";
export const DEFAULT_PAYMENT_STATUS: OrderPaymentStatus = "pending";
export const DEFAULT_INVOICE_STATUS: OrderInvoiceStatus = "not_applicable";
export const DEFAULT_FULFILLMENT_STATUS: OrderFulfillmentStatus = "pending";
export const DEFAULT_DELIVERY_STATUS: OrderDeliveryStatus = "not_shipped";

export const BOARD_STATUS_NEW_ORDERS: OrderBoardStatus = "New Orders";
export const BOARD_STATUS_DELIVERED: OrderBoardStatus = "Delivered";

export const FACILITY_SELECT = `
  id,
  user_id,
  name,
  status,
  contact,
  phone,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country,
  stripe_customer_id,
  created_at,
  updated_at
`;

export const PRODUCT_SELECT = `
  id,
  sku,
  name,
  category,
  unit_price,
  is_active,
  sort_order,
  created_at,
  updated_at
`;

export const ORDER_BASE_SELECT = `
  id,
  order_number,
  facility_id,
  order_status,
  payment_method,
  payment_status,
  invoice_status,
  fulfillment_status,
  delivery_status,
  tracking_number,
  notes,
  admin_notes,
  placed_at,
  paid_at,
  delivered_at,
  created_at,
  updated_at
`;

export const ORDER_ITEMS_SELECT = `
  id,
  order_id,
  product_id,
  product_name,
  product_sku,
  hcpcs_code,
  unit_price,
  quantity,
  shipping_amount,
  tax_amount,
  subtotal,
  total_amount,
  created_at,
  updated_at
`;

export const PAYMENTS_SELECT = `
    id,
    order_id,
    provider,
    payment_type,
    status,
    amount,
    currency,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    provider_payment_id,
    receipt_url,
    paid_at,
    created_at,
    updated_at
`;

export const INVOICES_SELECT = `
  id,
  order_id,
  invoice_number,
  provider,
  provider_invoice_id,
  status,
  amount_due,
  amount_paid,
  currency,
  due_at,
  issued_at,
  paid_at,
  hosted_invoice_url,
  created_at,
  updated_at
`;

export const ORDER_WITH_RELATIONS_SELECT = `
  ${ORDER_BASE_SELECT},
  facilities (${FACILITY_SELECT}),
  order_items (${ORDER_ITEMS_SELECT}),
  payments (${PAYMENTS_SELECT}),
  invoices (${INVOICES_SELECT})
`;

export const WOUND_TYPES = [
  { value: "chronic" as const, label: "Chronic" },
  { value: "post_surgical" as const, label: "Post-Surgical" },
];

export const REQUIRED_DOC_TYPES = [
  { type: "facesheet",        label: "Facesheet" },
  { type: "additional_ivr",   label: "IVR Form" },
  { type: "clinical_docs",    label: "Clinical Docs" },
  { type: "form_1500",        label: "1500 Form" },
  { type: "order_form",       label: "Order Form" },
  { type: "delivery_invoice", label: "Invoice" },
] as const;

export const ALL_DOC_TYPES: Array<{ type: string; label: string }> = [
  { type: "facesheet",        label: "Facesheet" },
  { type: "clinical_docs",    label: "Clinical Docs" },
  { type: "order_form",       label: "Order Form" },
  { type: "additional_ivr",   label: "IVR Form" },
  { type: "form_1500",        label: "1500 Form" },
  { type: "delivery_invoice", label: "Invoice" },
  { type: "wound_pictures",   label: "Wound Pictures" },
  { type: "other",            label: "Other" },
];

// The Invoice tab + doc card only show once an order is past the early
// drafting stages (the invoice is meaningful only when the order is being
// reviewed or fulfilled). Keep this in sync with the OrderDetailModal gate.
export const INVOICE_VISIBLE_STATUSES = new Set<string>([
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "delivered",
  "canceled",
]);

export function isInvoiceVisibleForStatus(status: string | null | undefined): boolean {
  return !!status && INVOICE_VISIBLE_STATUSES.has(status);
}

// Items (order_items) are editable only before the order has moved into
// manufacturer review. Once an admin/reviewer is looking at it, the product
// list is locked — any change requires the admin to bounce it back to
// `additional_info_needed`, which re-opens editing.
export const ITEMS_EDITABLE_STATUSES = new Set<string>([
  "draft",
  "pending_signature",
  "additional_info_needed",
]);

export function isItemsEditable(status: string | null | undefined): boolean {
  return !!status && ITEMS_EDITABLE_STATUSES.has(status);
}

// Non-admin roles lose all edit rights once the admin has accepted the
// order (manufacturer_review onwards). The single exception is `shipped`,
// where the provider still needs to capture the patient's proof-of-delivery
// signature on the Invoice tab. Once the patient has signed, everything
// locks — the signature IS the point-of-no-return.
const POST_APPROVAL_STATUSES = new Set<string>([
  "manufacturer_review",
  "approved",
  "shipped",
  "delivered",
  "canceled",
]);

/**
 * True when all fields + actions on the order must be read-only for
 * non-admin roles. Admin bypasses this entirely (they can always edit).
 *
 * Semantics:
 *   - Patient signed → fully locked regardless of status.
 *   - Status ≥ manufacturer_review → locked.
 *   - Otherwise editable.
 */
export function isOrderFullyLocked(
  status: string | null | undefined,
  patientSignedAt: string | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return false;
  if (patientSignedAt) return true;
  return !!status && POST_APPROVAL_STATUSES.has(status);
}

/**
 * Gates the "Capture Patient Signature" (and Recapture) affordance on the
 * Invoice tab. Patient signing is a clinic-side action — the clinical
 * provider hands the device to the patient at delivery, or the clinical
 * staff handles it on the provider's behalf. Admin / support / sales-rep
 * are explicitly NOT allowed to capture, even though admin bypasses other
 * lock rules: the signature is HIPAA-grade proof-of-delivery and must
 * originate from someone in the patient's care chain.
 *
 * Applies to both first-time capture and re-capture: clinic users can fix
 * a bad signature while the order is still in `shipped`. Once admin flips
 * to `delivered`, the status gate hides the affordance.
 */
export function canCapturePatientSignature(args: {
  status: string | null | undefined;
  role: string | null | undefined;
  /** Reserved for symmetry with other gate helpers — admin still cannot
   *  capture patient signatures, so this argument is intentionally ignored. */
  isAdmin: boolean;
}): boolean {
  void args.isAdmin;
  if (args.role !== "clinical_provider" && args.role !== "clinical_staff") {
    return false;
  }
  return args.status === "shipped";
}

// Allowlist for server-side order sort column. Exported from a non-"use
// server" module so both the client (as allowedSorts) and the server action
// (as a sanitize target) can import it. Keep in sync with the sortable
// columns in OrdersTable / ClinicOrdersTable.
export const ORDER_SORT_COLUMNS = [
  "updated_at",
  "placed_at",
  "created_at",
  "order_number",
  "order_status",
  "date_of_service",
  "payment_status",
] as const;
export type OrderSortColumn = (typeof ORDER_SORT_COLUMNS)[number];

export const ORDER_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all",                    label: "All Statuses" },
  { value: "draft",                  label: "Draft" },
  { value: "pending_signature",      label: "Pending Signature" },
  { value: "manufacturer_review",    label: "Under Review" },
  { value: "additional_info_needed", label: "Needs More Info" },
  { value: "approved",               label: "Approved" },
  { value: "shipped",                label: "Shipped" },
  { value: "delivered",              label: "Delivered" },
  { value: "canceled",               label: "Canceled" },
];
