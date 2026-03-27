import { z } from "zod";
import {
  currencyCodeSchema,
  invoiceStatusSchema,
  nonNegativeNumberSchema,
  nullableStringSchema,
  nullableTimestampSchema,
  timestampSchema,
  uuidSchema,
} from "./commerce";

export interface InvoiceRow {
  id: string;
  order_id: string;
  invoice_number: string;
  provider: string;
  provider_invoice_id: string | null;
  status:
    | "draft"
    | "issued"
    | "sent"
    | "partially_paid"
    | "paid"
    | "overdue"
    | "void";
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice extends InvoiceRow {}

export const invoiceSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  invoice_number: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  provider_invoice_id: nullableStringSchema,
  status: invoiceStatusSchema,
  amount_due: nonNegativeNumberSchema,
  amount_paid: nonNegativeNumberSchema,
  currency: currencyCodeSchema,
  due_at: nullableTimestampSchema,
  issued_at: nullableTimestampSchema,
  paid_at: nullableTimestampSchema,
  hosted_invoice_url: nullableStringSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createInvoiceSchema = z.object({
  order_id: uuidSchema,
  invoice_number: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  provider_invoice_id: nullableStringSchema.optional(),
  status: invoiceStatusSchema.optional(),
  amount_due: nonNegativeNumberSchema,
  amount_paid: nonNegativeNumberSchema.optional(),
  currency: currencyCodeSchema.optional(),
  due_at: nullableTimestampSchema.optional(),
  issued_at: nullableTimestampSchema.optional(),
  paid_at: nullableTimestampSchema.optional(),
  hosted_invoice_url: nullableStringSchema.optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type InvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceUpdateInput = z.infer<typeof updateInvoiceSchema>;
