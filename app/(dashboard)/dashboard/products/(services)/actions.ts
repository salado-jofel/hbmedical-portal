"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrThrow, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import {
  createProductSchema,
  updateProductSchema,
  type Product,
} from "@/utils/interfaces/products";
import { PRODUCT_TABLE } from "@/utils/constants/orders";
const PRODUCTS_SELECT = `
  id,
  sku,
  name,
  description,
  category,
  unit_price,
  is_active,
  sort_order,
  created_at,
  updated_at
`;

function normalizeText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseBoolean(
  value: FormDataEntryValue | null,
  fallback?: boolean,
): boolean | undefined {
  if (value === null) return fallback;
  if (typeof value !== "string") return fallback;

  const normalized = value.toLowerCase().trim();

  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;

  return fallback;
}

function mapProduct(row: any): Product {
  const unitPrice = Number(row.unit_price ?? 0);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    unit_price: unitPrice,
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,

    // Temporary compatibility alias for ProductCard.tsx
    price: unitPrice,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCTS_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[getAllProducts] Error:", error);
    throw new Error("Failed to fetch products.");
  }

  return (data ?? []).map(mapProduct);
}

export async function addProduct(formData: FormData): Promise<Product> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const parsed = createProductSchema.parse({
    sku: normalizeText(formData.get("sku")) ?? "",
    name: normalizeText(formData.get("name")) ?? "",
    description: normalizeText(formData.get("description")),
    category: normalizeText(formData.get("category")),
    unit_price: formData.get("unit_price") ?? 0,
    is_active: parseBoolean(formData.get("is_active"), true),
    sort_order: formData.get("sort_order") ?? 0,
  });

  const payload = {
    sku: parsed.sku,
    name: parsed.name,
    description: parsed.description ?? null,
    category: parsed.category ?? null,
    unit_price: parsed.unit_price,
    is_active: parsed.is_active ?? true,
    sort_order: parsed.sort_order ?? 0,
  };

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .insert(payload)
    .select(PRODUCTS_SELECT)
    .single();

  if (error) {
    console.error("[addProduct] Error:", error);
    throw new Error(error.message || "Failed to add product.");
  }

  revalidatePath("/dashboard/products");
  return mapProduct(data);
}

export async function editProduct(
  id: string,
  formData: FormData,
): Promise<Product> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const parsed = updateProductSchema.parse({
    sku: formData.has("sku")
      ? (normalizeText(formData.get("sku")) ?? "")
      : undefined,
    name: formData.has("name")
      ? (normalizeText(formData.get("name")) ?? "")
      : undefined,
    description: formData.has("description")
      ? normalizeText(formData.get("description"))
      : undefined,
    category: formData.has("category")
      ? normalizeText(formData.get("category"))
      : undefined,
    unit_price: formData.has("unit_price")
      ? formData.get("unit_price")
      : undefined,
    is_active: formData.has("is_active")
      ? parseBoolean(formData.get("is_active"), false)
      : undefined,
    sort_order: formData.has("sort_order")
      ? formData.get("sort_order")
      : undefined,
  });

  const payload: Record<string, unknown> = {};

  if (parsed.sku !== undefined) payload.sku = parsed.sku;
  if (parsed.name !== undefined) payload.name = parsed.name;
  if (parsed.description !== undefined)
    payload.description = parsed.description;
  if (parsed.category !== undefined) payload.category = parsed.category;
  if (parsed.unit_price !== undefined) payload.unit_price = parsed.unit_price;
  if (parsed.is_active !== undefined) payload.is_active = parsed.is_active;
  if (parsed.sort_order !== undefined) payload.sort_order = parsed.sort_order;

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .update(payload)
    .eq("id", id)
    .select(PRODUCTS_SELECT)
    .single();

  if (error) {
    console.error("[editProduct] Error:", error);
    throw new Error(error.message || "Failed to update product.");
  }

  revalidatePath("/dashboard/products");
  return mapProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  await requireAdminOrThrow(supabase);

  const { error } = await supabase.from(PRODUCT_TABLE).delete().eq("id", id);

  if (error) {
    console.error("[deleteProduct] Error:", error);
    throw new Error(error.message || "Failed to delete product.");
  }

  revalidatePath("/dashboard/products");
}
