import { z } from "zod";
import {
  uuidSchema,
  paymentTypeSchema,
  paymentStatusSchema,
  nonNegativeNumberSchema,
  currencyCodeSchema,
  nullableStringSchema,
  nullableTimestampSchema,
  timestampSchema,
} from "./commerce";

export interface PaymentRow {
  id: string;
  order_id: string;
  provider: string;
  payment_type: "checkout" | "invoice" | "manual";
  status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "canceled";
  amount: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  provider_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment extends PaymentRow {}

export const paymentSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  provider: z.string().trim().min(1),
  payment_type: paymentTypeSchema,
  status: paymentStatusSchema,
  amount: nonNegativeNumberSchema,
  currency: currencyCodeSchema,
  stripe_checkout_session_id: nullableStringSchema,
  stripe_payment_intent_id: nullableStringSchema,
  provider_payment_id: nullableStringSchema,
  paid_at: nullableTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createPaymentSchema = z.object({
  order_id: uuidSchema,
  provider: z.string().trim().min(1),
  payment_type: paymentTypeSchema,
  status: paymentStatusSchema.optional(),
  amount: nonNegativeNumberSchema,
  currency: currencyCodeSchema.optional(),
  stripe_checkout_session_id: nullableStringSchema.optional(),
  stripe_payment_intent_id: nullableStringSchema.optional(),
  provider_payment_id: nullableStringSchema.optional(),
  paid_at: nullableTimestampSchema.optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export type PaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentUpdateInput = z.infer<typeof updatePaymentSchema>;
