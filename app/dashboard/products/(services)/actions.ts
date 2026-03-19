"use server";

import { revalidatePath } from "next/cache";
import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type { Product, UpdateProductPayload } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";
import {
  createQBItem,
  syncProductToQuickBooks,
  deactivateQBItem,
  reactivateQBItem,
} from "./quickbooks-actions";

const PRODUCT_TABLE = "products";
const PRODUCT_COLUMNS = "id, created_at, name, price, qb_item_id, qb_synced_at";
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

  // Step 1: QB first — throws on failure, DB never touched
  const qbItemId = await createQBItem(name, price);

  // Step 2: DB insert
  const supabase = await getSupabaseClient();
  const { data, error: insertError } = await supabase
    .from(PRODUCT_TABLE)
    .insert({
      name,
      price,
      qb_item_id: qbItemId,
      qb_synced_at: new Date().toISOString(),
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (insertError || !data) {
    console.error("[addProduct] DB insert error:", insertError?.message);
    // Compensate — deactivate the QB item we just created
    try {
      await deactivateQBItem(qbItemId);
    } catch (e) {
      console.error("[addProduct] QB compensation failed:", e);
    }
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

  // Fetch current for QB revert if DB fails
  const { data: current, error: fetchErr } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .single();

  if (fetchErr || !current) throw new Error("Product not found.");

  // Step 1: QB sync first — blocking
  const qbResult = await syncProductToQuickBooks(productId, { name, price });
  if (!qbResult.success) {
    throw new Error(`QB sync failed: ${qbResult.message}`);
  }

  // Step 2: DB update
  const { error: updateErr } = await supabase
    .from(PRODUCT_TABLE)
    .update({
      name,
      price,
      qb_synced_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateErr) {
    console.error("[editProduct] DB error:", updateErr.message);
    // Revert QB back to old values
    try {
      await syncProductToQuickBooks(productId, {
        name: current.name,
        price: current.price,
      });
    } catch (e) {
      console.error("[editProduct] QB revert failed:", e);
    }
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
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .single();

  if (fetchErr || !current) throw new Error("Product not found.");
  if (!current.qb_item_id) throw new Error("Product has no QB item ID.");

  // Step 1: Deactivate in QB first
  await deactivateQBItem(current.qb_item_id);

  // Step 2: Delete from DB
  const { error: deleteErr } = await supabase
    .from(PRODUCT_TABLE)
    .delete()
    .eq("id", productId);

  if (deleteErr) {
    console.error("[deleteProduct] DB error:", deleteErr.message);
    // Reactivate QB item since DB delete failed
    try {
      await reactivateQBItem(current.qb_item_id, current.name, current.price);
    } catch (e) {
      console.error("[deleteProduct] QB reactivation failed:", e);
    }
    throw new Error("Failed to delete product from database.");
  }

  revalidatePath(PRODUCTS_PATH);
}
