"use server";

import { revalidatePath } from "next/cache";
import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type { Product } from "@/lib/interfaces/product";
import { requireUser } from "@/utils/auth-guard";

const PRODUCT_TABLE = "products";
const PRODUCT_COLUMNS = "id, created_at, name, price";
const PRODUCTS_PATH = "/dashboard/products";

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await dbSelect<Product>({
    table: PRODUCT_TABLE,
    columns: PRODUCT_COLUMNS,
    order: { column: "created_at", ascending: false },
  });

  if (error) {
    console.error("[getAllProducts] Supabase error:", error.message);
    return [];
  }

  return data ?? [];
}

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addProduct(formData: FormData): Promise<Product> {
  await requireUser();

  const name = formData.get("name") as string;
  const price = parseFloat(formData.get("price") as string) || 0;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .insert({
      name,
      price,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[addProduct] DB insert error:", error?.message);
    throw new Error("Failed to save product to database.");
  }

  revalidatePath(PRODUCTS_PATH);
  return data as Product;
}

// ── EDIT ──────────────────────────────────────────────────────────────────────

export async function editProduct(
  productId: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const name = formData.get("name") as string;
  const price = parseFloat(formData.get("price") as string) || 0;

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(PRODUCT_TABLE)
    .select("id")
    .eq("id", productId)
    .single();

  if (fetchErr || !current) {
    throw new Error("Product not found.");
  }

  const { error: updateErr } = await supabase
    .from(PRODUCT_TABLE)
    .update({
      name,
      price,
    })
    .eq("id", productId);

  if (updateErr) {
    console.error("[editProduct] DB error:", updateErr.message);
    throw new Error("Failed to update product in database.");
  }

  revalidatePath(PRODUCTS_PATH);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(PRODUCT_TABLE)
    .select("id")
    .eq("id", productId)
    .single();

  if (fetchErr || !current) {
    throw new Error("Product not found.");
  }

  const { error: deleteErr } = await supabase
    .from(PRODUCT_TABLE)
    .delete()
    .eq("id", productId);

  if (deleteErr) {
    console.error("[deleteProduct] DB error:", deleteErr.message);
    throw new Error("Failed to delete product from database.");
  }

  revalidatePath(PRODUCTS_PATH);
}
