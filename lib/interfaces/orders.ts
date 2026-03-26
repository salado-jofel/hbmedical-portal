import { z } from "zod";
import {
  uuidSchema,
  positiveIntegerSchema,
  nonNegativeNumberSchema,
  orderPaymentMethodSchema,
  orderPaymentStatusSchema,
  orderInvoiceStatusSchema,
  orderFulfillmentStatusSchema,
  orderDeliveryStatusSchema,
  nullableStringSchema,
  timestampSchema,
  nullableTimestampSchema,
} from "./commerce";

export interface OrderRow {
  id: string;
  order_number: string;
  facility_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  shipping_amount: number;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  payment_method: "pay_now" | "net_30";
  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "canceled";
  invoice_status:
    | "not_applicable"
    | "draft"
    | "issued"
    | "sent"
    | "partially_paid"
    | "paid"
    | "overdue"
    | "void";
  fulfillment_status: "pending" | "processing" | "fulfilled" | "canceled";
  delivery_status:
    | "not_shipped"
    | "label_created"
    | "in_transit"
    | "delivered"
    | "returned"
    | "exception"
    | "canceled";
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order extends OrderRow {}

export const orderSchema = z.object({
  id: uuidSchema,
  order_number: z.string().trim().min(1),
  facility_id: uuidSchema,
  product_id: uuidSchema,
  product_name: z.string().trim().min(1),
  product_sku: z.string().trim().min(1),
  quantity: positiveIntegerSchema,
  unit_price: nonNegativeNumberSchema,
  shipping_amount: nonNegativeNumberSchema,
  tax_amount: nonNegativeNumberSchema,
  subtotal: nonNegativeNumberSchema,
  total_amount: nonNegativeNumberSchema,
  payment_method: orderPaymentMethodSchema,
  payment_status: orderPaymentStatusSchema,
  invoice_status: orderInvoiceStatusSchema,
  fulfillment_status: orderFulfillmentStatusSchema,
  delivery_status: orderDeliveryStatusSchema,
  tracking_number: nullableStringSchema,
  notes: nullableStringSchema,
  placed_at: timestampSchema,
  paid_at: nullableTimestampSchema,
  delivered_at: nullableTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createOrderSchema = z.object({
  order_number: z.string().trim().min(1),
  facility_id: uuidSchema,
  product_id: uuidSchema,
  product_name: z.string().trim().min(1),
  product_sku: z.string().trim().min(1),
  quantity: positiveIntegerSchema,
  unit_price: nonNegativeNumberSchema,
  shipping_amount: nonNegativeNumberSchema.optional(),
  tax_amount: nonNegativeNumberSchema.optional(),
  payment_method: orderPaymentMethodSchema,
  payment_status: orderPaymentStatusSchema.optional(),
  invoice_status: orderInvoiceStatusSchema.optional(),
  fulfillment_status: orderFulfillmentStatusSchema.optional(),
  delivery_status: orderDeliveryStatusSchema.optional(),
  tracking_number: nullableStringSchema.optional(),
  notes: nullableStringSchema.optional(),
  placed_at: timestampSchema.optional(),
  paid_at: nullableTimestampSchema.optional(),
  delivered_at: nullableTimestampSchema.optional(),
});

export const updateOrderSchema = createOrderSchema.partial();

export type OrderInput = z.infer<typeof createOrderSchema>;
export type OrderUpdateInput = z.infer<typeof updateOrderSchema>;
