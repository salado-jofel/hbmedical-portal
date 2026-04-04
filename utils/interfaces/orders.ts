import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid UUID.");
export const timestampSchema = z.string().datetime({ offset: true });

const nullableStringSchema = z.string().trim().nullable();
const optionalNullableStringSchema = z.string().trim().nullable().optional();

/* -------------------------------------------------------------------------- */
/* DB enums — clinical order workflow                                         */
/* -------------------------------------------------------------------------- */

export const orderStatusSchema = z.enum([
  "draft",
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
  "canceled",
]);

export const orderPaymentMethodSchema = z.enum(["pay_now", "net_30"]);

export const orderPaymentStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "canceled",
]);

export const orderInvoiceStatusSchema = z.enum([
  "not_applicable",
  "draft",
  "issued",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const orderFulfillmentStatusSchema = z.enum([
  "pending",
  "processing",
  "fulfilled",
  "canceled",
]);

export const orderDeliveryStatusSchema = z.enum([
  "not_shipped",
  "label_created",
  "in_transit",
  "delivered",
  "returned",
  "exception",
  "canceled",
]);

export const woundTypeSchema = z.enum(["chronic", "post_surgical"]);
export const documentTypeSchema = z.enum([
  "facesheet",
  "clinical_docs",
  "wound_pictures",
  "order_form",
  "form_1500",
  "additional_ivr",
  "other",
]);

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;
export type OrderInvoiceStatus = z.infer<typeof orderInvoiceStatusSchema>;
export type OrderFulfillmentStatus = z.infer<typeof orderFulfillmentStatusSchema>;
export type OrderDeliveryStatus = z.infer<typeof orderDeliveryStatusSchema>;
export type WoundType = z.infer<typeof woundTypeSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;

/* -------------------------------------------------------------------------- */
/* Clinical Order interfaces (camelCase TypeScript)                          */
/* -------------------------------------------------------------------------- */

export interface IPatient {
  id: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  patientRef: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // computed
  fullName: string;
}

export interface IOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  shippingAmount: number;
  taxAmount: number;
  subtotal: number | null;
  totalAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderDocument {
  id: string;
  orderId: string;
  documentType: DocumentType;
  bucket: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface IOrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  // joined
  senderName: string | null;
  senderRole: string | null;
}

export interface IOrderHistory {
  id: string;
  orderId: string;
  performedBy: string | null;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  createdAt: string;
  // joined
  performedByName: string | null;
}

export interface IOrderIVR {
  id: string;
  orderId: string;
  insuranceProvider: string | null;
  insurancePhone: string | null;
  memberId: string | null;
  groupNumber: string | null;
  planName: string | null;
  planType: string | null;
  subscriberName: string | null;
  subscriberDob: string | null;
  subscriberRelationship: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  deductibleAmount: number | null;
  deductibleMet: number | null;
  outOfPocketMax: number | null;
  outOfPocketMet: number | null;
  copayAmount: number | null;
  coinsurancePercent: number | null;
  dmeCovered: boolean;
  woundCareCovered: boolean;
  priorAuthRequired: boolean;
  priorAuthNumber: string | null;
  priorAuthStartDate: string | null;
  priorAuthEndDate: string | null;
  unitsAuthorized: number | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  verificationReference: string | null;
  notes: string | null;
  aiExtracted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderForm1500 {
  id: string;
  orderId: string;
  insuranceType: string | null;
  insuredIdNumber: string | null;
  patientLastName: string | null;
  patientFirstName: string | null;
  patientMiddleInitial: string | null;
  patientDob: string | null;
  patientSex: string | null;
  insuredLastName: string | null;
  insuredFirstName: string | null;
  insuredMiddleInitial: string | null;
  patientAddress: string | null;
  patientCity: string | null;
  patientState: string | null;
  patientZip: string | null;
  patientPhone: string | null;
  patientRelationship: string | null;
  insuredAddress: string | null;
  insuredCity: string | null;
  insuredState: string | null;
  insuredZip: string | null;
  insuredPhone: string | null;
  otherInsuredName: string | null;
  otherInsuredPolicy: string | null;
  otherInsuredDob: string | null;
  otherInsuredSex: string | null;
  otherInsuredEmployer: string | null;
  otherInsuredPlan: string | null;
  conditionEmployment: boolean | null;
  conditionAutoAccident: boolean | null;
  conditionAutoState: string | null;
  conditionOtherAccident: boolean | null;
  insuredPolicyGroup: string | null;
  insuredDob: string | null;
  insuredSex: string | null;
  insuredEmployer: string | null;
  insuredPlanName: string | null;
  anotherHealthBenefit: boolean | null;
  patientSignature: string | null;
  patientSignatureDate: string | null;
  insuredSignature: string | null;
  illnessDate: string | null;
  illnessQualifier: string | null;
  otherDate: string | null;
  otherDateQualifier: string | null;
  unableWorkFrom: string | null;
  unableWorkTo: string | null;
  referringProviderName: string | null;
  referringProviderNpi: string | null;
  referringProviderQual: string | null;
  hospitalizationFrom: string | null;
  hospitalizationTo: string | null;
  additionalClaimInfo: string | null;
  outsideLab: boolean | null;
  outsideLabCharges: number | null;
  diagnosisA: string | null;
  diagnosisB: string | null;
  diagnosisC: string | null;
  diagnosisD: string | null;
  diagnosisE: string | null;
  diagnosisF: string | null;
  diagnosisG: string | null;
  diagnosisH: string | null;
  diagnosisI: string | null;
  diagnosisJ: string | null;
  diagnosisK: string | null;
  diagnosisL: string | null;
  resubmissionCode: string | null;
  originalRefNumber: string | null;
  priorAuthNumber: string | null;
  serviceLines: unknown;
  federalTaxId: string | null;
  taxIdSsn: boolean | null;
  patientAccountNumber: string | null;
  acceptAssignment: boolean | null;
  totalCharge: number | null;
  amountPaid: number | null;
  rsvdNucc: string | null;
  physicianSignature: string | null;
  physicianSignatureDate: string | null;
  serviceFacilityName: string | null;
  serviceFacilityAddress: string | null;
  serviceFacilityNpi: string | null;
  billingProviderName: string | null;
  billingProviderAddress: string | null;
  billingProviderPhone: string | null;
  billingProviderNpi: string | null;
  billingProviderTaxId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  facilityId: string;
  orderStatus: OrderStatus;
  paymentMethod: OrderPaymentMethod | null;
  paymentStatus: OrderPaymentStatus;
  invoiceStatus: OrderInvoiceStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  deliveryStatus: OrderDeliveryStatus;
  trackingNumber: string | null;
  notes: string | null;
  placedAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  // clinical fields
  createdBy: string | null;
  signedBy: string | null;
  signedAt: string | null;
  woundType: WoundType | null;
  dateOfService: string | null;
  patientId: string | null;
  assignedProviderId: string | null;
  // AI extraction fields
  aiExtracted: boolean;
  aiExtractedAt: string | null;
  orderFormLocked: boolean;
  woundVisitNumber: number | null;
  chiefComplaint: string | null;
  hasVasculitisOrBurns: boolean;
  isReceivingHomeHealth: boolean;
  isPatientAtSnf: boolean;
  icd10Code: string | null;
  followupDays: number | null;
  symptoms: string[];
  // joined relations
  patient: IPatient | null;
  items: IOrderItem[];
  documents: IOrderDocument[];
  history: IOrderHistory[];
  messages: IOrderMessage[];
  // facility info
  facilityName: string | null;
  // provider / creator names
  createdByName: string | null;
  signedByName: string | null;
  assignedProviderName: string | null;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

export interface IOrderFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<string, string>>;
  orderId?: string;
}

/* -------------------------------------------------------------------------- */
/* DB relation types (raw, for internal action use)                          */
/* -------------------------------------------------------------------------- */

export type MaybeRelation<T> = T | T[] | null;

export type FacilityRecord = {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "inactive";
  contact: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PaymentRecord = {
  id: string;
  order_id: string;
  provider: string;
  payment_type: string;
  status: OrderPaymentStatus;
  amount: number | string;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  provider_payment_id: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceRecord = {
  id: string;
  order_id: string;
  invoice_number: string | null;
  provider: string;
  provider_invoice_id: string | null;
  status: string;
  amount_due: number | string;
  amount_paid: number | string;
  currency: string | null;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  updated_at: string;
};

export type RawOrderRecord = {
  id: string;
  order_number: string;
  facility_id: string;
  order_status: string;
  payment_method: string | null;
  payment_status: string;
  invoice_status: string;
  fulfillment_status: string;
  delivery_status: string;
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  // clinical
  created_by: string | null;
  signed_by: string | null;
  signed_at: string | null;
  wound_type: string | null;
  date_of_service: string | null;
  patient_id: string | null;
  assigned_provider_id: string | null;
  // AI extraction
  wound_visit_number: number | null;
  chief_complaint: string | null;
  has_vasculitis_or_burns: boolean | null;
  is_receiving_home_health: boolean | null;
  is_patient_at_snf: boolean | null;
  icd10_code: string | null;
  followup_days: number | null;
  symptoms: string[] | null;
  ai_extracted: boolean | null;
  ai_extracted_at: string | null;
  order_form_locked: boolean | null;
  // joined
  patients: MaybeRelation<{
    id: string;
    facility_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    patient_ref: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  order_items: MaybeRelation<{
    id: string;
    order_id: string;
    product_id: string | null;
    product_name: string;
    product_sku: string;
    unit_price: number;
    quantity: number;
    shipping_amount: number;
    tax_amount: number;
    subtotal: number | null;
    total_amount: number | null;
    created_at: string;
    updated_at: string;
  }>;
  facilities: MaybeRelation<{ id: string; name: string }>;
  payments: MaybeRelation<PaymentRecord>;
  invoices: MaybeRelation<InvoiceRecord>;
};

export type ExistingOrderRecord = {
  id: string;
  facility_id: string;
  order_status: OrderStatus;
  payment_method: OrderPaymentMethod | null;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  paid_at: string | null;
  delivered_at: string | null;
};

/* -------------------------------------------------------------------------- */
/* Writable payload types                                                     */
/* -------------------------------------------------------------------------- */

export type InsertOrderPayload = {
  order_number: string;
  facility_id: string;
  order_status: OrderStatus;
  payment_method: OrderPaymentMethod | null;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
  wound_type: string | null;
  date_of_service: string | null;
  patient_id: string | null;
  assigned_provider_id: string | null;
};

export type InsertOrderItemPayload = {
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_price: number;
  quantity: number;
  shipping_amount: number;
  tax_amount: number;
};

export type EditOrderPayload = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  shipping_amount: number;
  tax_amount: number;
};

export type SubmitOrderPaymentChoicePayload = {
  order_status: "approved";
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
};

export type UpdateOrderStatusPayload = Partial<{
  order_status: OrderStatus;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
  assigned_provider_id: string | null;
}>;

export type CancelOrderPayload = {
  order_status: "canceled";
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: "canceled";
  delivery_status: "canceled";
  delivered_at: null;
  notes?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                         */
/* -------------------------------------------------------------------------- */

export const createOrderSchema = z.object({
  patient_id: uuidSchema,
  wound_type: woundTypeSchema,
  date_of_service: z.string().min(1, "Date of service is required."),
  notes: optionalNullableStringSchema,
  assigned_provider_id: uuidSchema.optional().nullable(),
  items: z.array(
    z.object({
      product_id: uuidSchema,
      quantity: z.coerce.number().int().min(1),
    })
  ).min(1, "At least one product is required."),
});

export const cancelOrderSchema = z.object({
  id: uuidSchema,
  notes: optionalNullableStringSchema,
});

export const updateOrderStatusSchema = z.object({
  id: uuidSchema,
  payment_status: orderPaymentStatusSchema.optional(),
  invoice_status: orderInvoiceStatusSchema.optional(),
  fulfillment_status: orderFulfillmentStatusSchema.optional(),
  delivery_status: orderDeliveryStatusSchema.optional(),
  tracking_number: optionalNullableStringSchema,
  notes: optionalNullableStringSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/* -------------------------------------------------------------------------- */
/* DashboardOrder — flat shape used by Redux + UI                            */
/* -------------------------------------------------------------------------- */

// Keep a compatible DashboardOrder shape to avoid breaking Redux slice & UI
// We extend it with the clinical columns
export type DashboardOrder = {
  id: string;
  order_number: string;
  facility_id: string;
  order_status: OrderStatus;
  payment_method: OrderPaymentMethod | null;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  // clinical
  created_by: string | null;
  signed_by: string | null;
  signed_at: string | null;
  wound_type: WoundType | null;
  date_of_service: string | null;
  patient_id: string | null;
  assigned_provider_id: string | null;
  // AI extraction
  ai_extracted: boolean;
  ai_extracted_at: string | null;
  order_form_locked: boolean;
  wound_visit_number: number | null;
  chief_complaint: string | null;
  has_vasculitis_or_burns: boolean;
  is_receiving_home_health: boolean;
  is_patient_at_snf: boolean;
  icd10_code: string | null;
  followup_days: number | null;
  symptoms: string[];
  // from order_items (first item, for backwards compat)
  product_id: string | null;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  shipping_amount: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  // from facilities
  facility_name: string;
  // patient
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_full_name: string | null;
  // provider names
  created_by_name: string | null;
  signed_by_name: string | null;
  assigned_provider_name: string | null;
  // full relations for detail view
  all_items: IOrderItem[];
  documents: IOrderDocument[];
  // board status (backwards compat with old kanban)
  board_status: "New Orders" | "Delivered";
  // legacy stripe fields (may be null)
  receipt_url?: string | null;
  stripe_receipt_url?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  hosted_invoice_url?: string | null;
  provider_invoice_id?: string | null;
  invoice_number?: string | null;
  invoice_due_at?: string | null;
  invoice_paid_at?: string | null;
  product_category?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Map functions                                                              */
/* -------------------------------------------------------------------------- */

function getSingle<T>(val: MaybeRelation<T>): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

function getArray<T>(val: MaybeRelation<T>): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export function mapOrder(raw: RawOrderRecord): DashboardOrder {
  const facility = getSingle(raw.facilities);
  const patient = getSingle(raw.patients);
  const items = getArray(raw.order_items);
  const firstItem = items[0];

  return {
    id: raw.id,
    order_number: raw.order_number,
    facility_id: raw.facility_id,
    order_status: raw.order_status as OrderStatus,
    payment_method: (raw.payment_method as OrderPaymentMethod) ?? null,
    payment_status: raw.payment_status as OrderPaymentStatus,
    invoice_status: raw.invoice_status as OrderInvoiceStatus,
    fulfillment_status: raw.fulfillment_status as OrderFulfillmentStatus,
    delivery_status: raw.delivery_status as OrderDeliveryStatus,
    tracking_number: raw.tracking_number,
    notes: raw.notes,
    placed_at: raw.placed_at,
    paid_at: raw.paid_at,
    delivered_at: raw.delivered_at,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    // clinical
    created_by: raw.created_by,
    signed_by: raw.signed_by,
    signed_at: raw.signed_at,
    wound_type: (raw.wound_type as WoundType) ?? null,
    date_of_service: raw.date_of_service,
    patient_id: raw.patient_id,
    assigned_provider_id: raw.assigned_provider_id,
    // AI extraction
    ai_extracted: raw.ai_extracted ?? false,
    ai_extracted_at: raw.ai_extracted_at ?? null,
    order_form_locked: raw.order_form_locked ?? false,
    wound_visit_number: raw.wound_visit_number ?? null,
    chief_complaint: raw.chief_complaint ?? null,
    has_vasculitis_or_burns: raw.has_vasculitis_or_burns ?? false,
    is_receiving_home_health: raw.is_receiving_home_health ?? false,
    is_patient_at_snf: raw.is_patient_at_snf ?? false,
    icd10_code: raw.icd10_code ?? null,
    followup_days: raw.followup_days ?? null,
    symptoms: raw.symptoms ?? [],
    // item fields
    product_id: firstItem?.product_id ?? null,
    product_name: firstItem?.product_name ?? "",
    product_sku: firstItem?.product_sku ?? "",
    quantity: Number(firstItem?.quantity ?? 0),
    unit_price: Number(firstItem?.unit_price ?? 0),
    shipping_amount: Number(firstItem?.shipping_amount ?? 0),
    tax_amount: Number(firstItem?.tax_amount ?? 0),
    subtotal: Number(firstItem?.subtotal ?? 0),
    total_amount: Number(firstItem?.total_amount ?? 0),
    // facility
    facility_name: facility?.name ?? "",
    // patient
    patient_first_name: patient?.first_name ?? null,
    patient_last_name: patient?.last_name ?? null,
    patient_full_name: patient ? `${patient.first_name} ${patient.last_name}` : null,
    // provider names (populated separately)
    created_by_name: null,
    signed_by_name: null,
    assigned_provider_name: null,
    // all items
    all_items: items.map((i) => ({
      id: i.id,
      orderId: i.order_id,
      productId: i.product_id,
      productName: i.product_name,
      productSku: i.product_sku,
      unitPrice: Number(i.unit_price),
      quantity: Number(i.quantity),
      shippingAmount: Number(i.shipping_amount),
      taxAmount: Number(i.tax_amount),
      subtotal: i.subtotal != null ? Number(i.subtotal) : null,
      totalAmount: i.total_amount != null ? Number(i.total_amount) : null,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    })),
    documents: [],
    // board_status for backwards compat
    board_status: raw.delivery_status === "delivered" ? "Delivered" : "New Orders",
    // legacy fields
    receipt_url: null,
    stripe_receipt_url: null,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    hosted_invoice_url: null,
    provider_invoice_id: null,
    invoice_number: null,
    invoice_due_at: null,
    invoice_paid_at: null,
    product_category: null,
  };
}

export function mapOrders(rows: RawOrderRecord[]): DashboardOrder[] {
  return rows.map(mapOrder);
}

// Legacy alias kept for backwards compat
export type OrderBoardStatus = "New Orders" | "Delivered";

// OrderRow alias — used by stripe.ts and other legacy files
export type OrderRow = {
  id: string;
  order_number: string;
  facility_id: string;
  order_status: OrderStatus;
  payment_method: OrderPaymentMethod | null;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  signed_by: string | null;
  signed_at: string | null;
  wound_type: WoundType | null;
  date_of_service: string | null;
  patient_id: string | null;
  assigned_provider_id: string | null;
};

export function getOrderBoardStatus(deliveryStatus: OrderDeliveryStatus): OrderBoardStatus {
  return deliveryStatus === "delivered" ? "Delivered" : "New Orders";
}
