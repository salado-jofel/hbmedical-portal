import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid UUID.");
export const timestampSchema = z.string().datetime({ offset: true });

const nullableStringSchema = z.string().trim().nullable();
const optionalNullableStringSchema = z.string().trim().nullable().optional();

/* -------------------------------------------------------------------------- */
/* Exact DB enums                                                             */
/* -------------------------------------------------------------------------- */

export const orderStatusSchema = z.enum(["draft", "submitted", "canceled"]);

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

export const orderBoardStatusSchema = z.enum(["New Orders", "Delivered"]);

/* -------------------------------------------------------------------------- */
/* Row + dashboard schemas                                                    */
/* -------------------------------------------------------------------------- */

export const orderRowSchema = z.object({
  id: uuidSchema,

  order_number: z.string().trim().min(1, "Order number is required."),
  facility_id: uuidSchema,
  product_id: uuidSchema,

  product_name: z.string().trim().min(1, "Product name is required."),
  product_sku: z.string().trim().min(1, "Product SKU is required."),

  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unit_price: z.coerce.number().min(0, "Unit price must be 0 or more."),
  shipping_amount: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
  subtotal: z.coerce.number().min(0),
  total_amount: z.coerce.number().min(0),

  order_status: orderStatusSchema,
  payment_method: orderPaymentMethodSchema.nullable(),
  payment_status: orderPaymentStatusSchema,
  invoice_status: orderInvoiceStatusSchema,
  fulfillment_status: orderFulfillmentStatusSchema,
  delivery_status: orderDeliveryStatusSchema,

  tracking_number: nullableStringSchema,
  notes: nullableStringSchema,

  placed_at: timestampSchema,
  paid_at: timestampSchema.nullable(),
  delivered_at: timestampSchema.nullable(),

  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const dashboardOrderSchema = orderRowSchema.extend({
  facility_name: z.string().trim().min(1, "Facility name is required."),
  facility_contact_name: nullableStringSchema,
  facility_email: nullableStringSchema,
  facility_phone: nullableStringSchema,

  product_category: nullableStringSchema,

  board_status: orderBoardStatusSchema,
});

/* -------------------------------------------------------------------------- */
/* Input schemas                                                              */
/* -------------------------------------------------------------------------- */

export const createOrderSchema = z.object({
  product_id: uuidSchema,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  notes: optionalNullableStringSchema,
});

export const editOrderSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
});

export const submitOrderPaymentChoiceSchema = z.object({
  id: uuidSchema,
  payment_method: orderPaymentMethodSchema,
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

export const cancelOrderSchema = z.object({
  id: uuidSchema,
  notes: optionalNullableStringSchema,
});

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;
export type OrderInvoiceStatus = z.infer<typeof orderInvoiceStatusSchema>;
export type OrderFulfillmentStatus = z.infer<
  typeof orderFulfillmentStatusSchema
>;
export type OrderDeliveryStatus = z.infer<typeof orderDeliveryStatusSchema>;
export type OrderBoardStatus = z.infer<typeof orderBoardStatusSchema>;

export type OrderRow = z.infer<typeof orderRowSchema>;
export type DashboardOrder = z.infer<typeof dashboardOrderSchema>;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type EditOrderInput = z.infer<typeof editOrderSchema>;
export type SubmitOrderPaymentChoiceInput = z.infer<
  typeof submitOrderPaymentChoiceSchema
>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/* -------------------------------------------------------------------------- */
/* DB relation types                                                          */
/* -------------------------------------------------------------------------- */

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

export type MaybeRelation<T> = T | T[] | null;

export type RawOrderRecord = OrderRow & {
  facilities: MaybeRelation<FacilityRecord>;
  products: MaybeRelation<ProductRecord>;
};

export type ExistingOrderRecord = {
  id: string;
  facility_id: string;
  order_status: OrderStatus;
  product_id: string;
  quantity: number;
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
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  shipping_amount: number;
  tax_amount: number;
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
  order_status: "submitted";
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
};

export type UpdateOrderStatusPayload = Partial<{
  payment_status: OrderPaymentStatus;
  invoice_status: OrderInvoiceStatus;
  fulfillment_status: OrderFulfillmentStatus;
  delivery_status: OrderDeliveryStatus;
  tracking_number: string | null;
  notes: string | null;
  paid_at: string | null;
  delivered_at: string | null;
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
/* UI utility                                                                 */
/* -------------------------------------------------------------------------- */

export function getOrderBoardStatus(
  deliveryStatus: OrderDeliveryStatus,
): OrderBoardStatus {
  return deliveryStatus === "delivered" ? "Delivered" : "New Orders";
}
