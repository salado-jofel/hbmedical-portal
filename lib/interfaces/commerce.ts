import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().min(1);
export const nullableTimestampSchema = timestampSchema.nullable();

export const nonNegativeNumberSchema = z.coerce.number().finite().nonnegative();
export const nonNegativeIntegerSchema = z.coerce.number().int().nonnegative();
export const positiveIntegerSchema = z.coerce.number().int().positive();

export const nullableTrimmedStringSchema = z.string().trim().min(1).nullable();
export const nullableStringSchema = z.string().nullable();

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a valid ISO-3 currency code");

export const orderPaymentMethodValues = ["pay_now", "net_30"] as const;
export const orderPaymentStatusValues = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "canceled",
] as const;
export const orderInvoiceStatusValues = [
  "not_applicable",
  "draft",
  "issued",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;
export const orderFulfillmentStatusValues = [
  "pending",
  "processing",
  "fulfilled",
  "canceled",
] as const;
export const orderDeliveryStatusValues = [
  "not_shipped",
  "label_created",
  "in_transit",
  "delivered",
  "returned",
  "exception",
  "canceled",
] as const;

export const invoiceStatusValues = [
  "draft",
  "issued",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

export const paymentTypeValues = ["checkout", "invoice", "manual"] as const;
export const paymentStatusValues = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "canceled",
] as const;

export const shipmentStatusValues = [
  "pending",
  "label_created",
  "in_transit",
  "delivered",
  "returned",
  "exception",
  "canceled",
] as const;

export const orderPaymentMethodSchema = z.enum(orderPaymentMethodValues);
export const orderPaymentStatusSchema = z.enum(orderPaymentStatusValues);
export const orderInvoiceStatusSchema = z.enum(orderInvoiceStatusValues);
export const orderFulfillmentStatusSchema = z.enum(
  orderFulfillmentStatusValues,
);
export const orderDeliveryStatusSchema = z.enum(orderDeliveryStatusValues);

export const invoiceStatusSchema = z.enum(invoiceStatusValues);

export const paymentTypeSchema = z.enum(paymentTypeValues);
export const paymentStatusSchema = z.enum(paymentStatusValues);

export const shipmentStatusSchema = z.enum(shipmentStatusValues);

export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;
export type OrderInvoiceStatus = z.infer<typeof orderInvoiceStatusSchema>;
export type OrderFulfillmentStatus = z.infer<
  typeof orderFulfillmentStatusSchema
>;
export type OrderDeliveryStatus = z.infer<typeof orderDeliveryStatusSchema>;

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;
