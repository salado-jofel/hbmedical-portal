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
  { value: "dfu" as const, label: "DFU" },
  { value: "vlu" as const, label: "VLU" },
];

// ── VLU: CEAP Classification (Comprehensive venous severity scale) ──
// C0..C6 plus symptomatic variants (C0s..C6s).
export const CEAP_CLASSIFICATIONS = [
  { value: "C0",  label: "C0 — No visible signs of venous disease" },
  { value: "C0s", label: "C0s — Symptomatic, no visible signs" },
  { value: "C1",  label: "C1 — Telangiectasias / reticular veins" },
  { value: "C1s", label: "C1s — C1 + symptoms" },
  { value: "C2",  label: "C2 — Varicose veins" },
  { value: "C2s", label: "C2s — C2 + symptoms" },
  { value: "C3",  label: "C3 — Edema" },
  { value: "C3s", label: "C3s — C3 + symptoms" },
  { value: "C4",  label: "C4 — Skin changes (pigmentation, eczema, lipodermatosclerosis)" },
  { value: "C4s", label: "C4s — C4 + symptoms" },
  { value: "C5",  label: "C5 — Healed venous ulcer" },
  { value: "C5s", label: "C5s — C5 + symptoms" },
  { value: "C6",  label: "C6 — Active venous ulcer" },
  { value: "C6s", label: "C6s — C6 + symptoms" },
];

// ── DFU: Wagner Grade (0..5) ──
export const WAGNER_GRADES = [
  { value: 0, label: "0 — Pre/post-ulcerative lesion or healed ulcer" },
  { value: 1, label: "1 — Superficial ulcer, no subcutaneous involvement" },
  { value: 2, label: "2 — Ulcer extending to ligament/tendon/joint capsule/fascia" },
  { value: 3, label: "3 — Deep ulcer with abscess or osteomyelitis" },
  { value: 4, label: "4 — Gangrene of forefoot or toe(s)" },
  { value: 5, label: "5 — Extensive gangrene involving the whole foot" },
];

export const DIABETES_TYPE_OPTIONS = [
  { value: "type_1" as const, label: "Type 1" },
  { value: "type_2" as const, label: "Type 2" },
];

export const OSTEOMYELITIS_STATUS_OPTIONS = [
  { value: "none" as const,       label: "Not present" },
  { value: "suspected" as const,  label: "Suspected" },
  { value: "confirmed" as const,  label: "Confirmed" },
];

export const INFECTION_STATUS_OPTIONS = [
  { value: "none" as const,      label: "No infection" },
  { value: "local" as const,     label: "Local" },
  { value: "deep" as const,      label: "Deep" },
  { value: "systemic" as const,  label: "Systemic" },
];

export const PROCEDURE_SETTING_OPTIONS = [
  { value: "or" as const,      label: "OR" },
  { value: "office" as const,  label: "Office" },
  { value: "asc" as const,     label: "ASC" },
  { value: "other" as const,   label: "Other" },
];

// ── DFU: preset procedure list with CPT codes ──
// The physician multi-selects from this list. The "Other" entries have
// no preset CPT — physician fills in via cptOverride.
export const DFU_PROCEDURES_TEMPLATE = [
  { key: "debridement_subq",       label: "Debridement, subcutaneous tissue",                  cpt: "11042" },
  { key: "debridement_muscle",     label: "Debridement, muscle and/or fascia",                  cpt: "11043" },
  { key: "debridement_bone",       label: "Debridement, bone",                                  cpt: "11044" },
  { key: "skin_sub_first_25",      label: "Skin substitute application, lower extremity (first 25 cm²)", cpt: "15275" },
  { key: "skin_sub_addl",          label: "Skin substitute application, lower extremity (each additional)", cpt: "15276" },
  { key: "achilles_lengthening",   label: "Achilles lengthening / gastrocnemius recession",     cpt: null },
  { key: "ostectomy",              label: "Ostectomy / exostectomy / partial calcanectomy",     cpt: null },
  { key: "toe_amputation",         label: "Toe or ray amputation (limb salvage)",               cpt: null },
  { key: "other",                  label: "Other (describe in narrative)",                       cpt: null },
];

// ── DFU: narrative justification statements ──
// 4 sections, each with ~4 pre-written statements. Physician selects which
// statements apply; case_specific captures wound-specific addendum. Stored
// as JSONB on order_form for forward-compatible options without migrations.
export const DFU_NARRATIVE_TEMPLATES = {
  progression: {
    title: "Why the procedure is required now / expected benefit",
    statements: [
      { key: "ulcer_progressed",     label: "The ulcer has progressed in depth and/or size despite ongoing care; surgical intervention is required to remove nonviable tissue and establish a healthy, healable wound bed." },
      { key: "nonviable_impeding",   label: "Nonviable tissue, eschar, and/or biofilm at the wound base are impeding granulation; debridement is necessary to convert a chronic wound to an acute, healing phenotype." },
      { key: "deep_structures",      label: "Exposed deep structures (tendon, capsule, or bone) require operative management that cannot be accomplished with bedside care alone." },
      { key: "expected_benefit",     label: "Expected benefit: a clean, granulating wound bed capable of healing, with restoration of protective function and preservation of a functional, weight-bearing foot." },
    ],
  },
  lessIntensive: {
    title: "Why less-intensive measures are insufficient",
    statements: [
      { key: "conservative_failed",  label: "Documented conservative care (offloading, serial bedside debridement, moist wound management, glycemic and infection control) has failed to achieve the expected healing trajectory." },
      { key: "less_than_50pct",      label: "The wound has shown less than 50% area reduction over four or more weeks of standard care — the threshold at which advanced intervention is indicated." },
      { key: "extent_exceeds",       label: "The extent of nonviable tissue and/or depth of involvement exceeds what selective bedside debridement can adequately address." },
    ],
  },
  limbLoss: {
    title: "How the procedure prevents progression / limb loss",
    statements: [
      { key: "progression_risk",     label: "Without timely intervention, this wound carries a high risk of progression to deep-space infection, osteomyelitis, sepsis, and/or higher-level amputation." },
      { key: "limb_salvage_intent",  label: "The procedure is intended as limb salvage — removing the source of infection or pressure to prevent a more proximal amputation and preserve functional length." },
      { key: "reduce_hospitalization", label: "Early surgical management is expected to reduce the likelihood of hospitalization, IV antibiotics, and the morbidity associated with delayed care." },
      { key: "offload_recurrence",   label: "Offloading the deformity surgically addresses the underlying biomechanical cause and reduces the risk of recurrence at the same site." },
    ],
  },
  perfusion: {
    title: "Perfusion adequacy / revascularization plan",
    statements: [
      { key: "perfusion_adequate",   label: "Vascular assessment confirms perfusion adequate to support healing of the planned surgical wound." },
      { key: "vascular_referred",    label: "Perfusion is borderline; patient has been referred to vascular surgery and revascularization will precede or accompany the planned procedure." },
      { key: "pulses_support",       label: "Pedal pulses and noninvasive studies support a reasonable expectation of healing following intervention." },
    ],
  },
};

export const REQUIRED_DOC_TYPES = [
  { type: "facesheet",        label: "Facesheet" },
  { type: "additional_ivr",   label: "IVR Form" },
  { type: "clinical_docs",    label: "Clinical Docs" },
  { type: "valid_id",         label: "Valid ID" },
  { type: "form_1500",        label: "1500 Form" },
  { type: "order_form",       label: "Order Form" },
  { type: "delivery_invoice", label: "Invoice" },
] as const;

export const ALL_DOC_TYPES: Array<{ type: string; label: string }> = [
  { type: "facesheet",        label: "Facesheet" },
  { type: "clinical_docs",    label: "Clinical Docs" },
  { type: "valid_id",         label: "Valid ID" },
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
