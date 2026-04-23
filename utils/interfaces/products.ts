import { z } from "zod";
import { uuidString } from "@/utils/validators/shared";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  hcpcs_code: string | null;
  unit_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;

  /**
   * Temporary backward-compatibility alias
   * Keep until ProductCard.tsx is updated to use unit_price.
   */
  price?: number;
}

export const productSchema = z.object({
  id: uuidString(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  hcpcs_code: z.string().trim().nullable(),
  unit_price: z.coerce.number().finite().nonnegative(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().nonnegative(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  hcpcs_code: z.string().trim().nullable().optional(),
  unit_price: z.coerce.number().finite().nonnegative(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().nonnegative().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type RowEdit = {
  sku: string;
  name: string;
  category: string;
  hcpcs_code: string;
  unit_price: string;
  is_active: boolean;
};
