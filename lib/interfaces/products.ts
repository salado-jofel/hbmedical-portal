import { z } from "zod";
import {
  uuidSchema,
  nonNegativeNumberSchema,
  nonNegativeIntegerSchema,
  timestampSchema,
} from "./commerce";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product extends ProductRow {}

export const productSchema = z.object({
  id: uuidSchema,
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  unit_price: nonNegativeNumberSchema,
  is_active: z.boolean(),
  sort_order: nonNegativeIntegerSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit_price: nonNegativeNumberSchema,
  is_active: z.boolean().optional(),
  sort_order: nonNegativeIntegerSchema.optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type ProductInput = z.infer<typeof createProductSchema>;
export type ProductUpdateInput = z.infer<typeof updateProductSchema>;
