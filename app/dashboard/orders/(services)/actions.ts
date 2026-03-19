"use server";

import { revalidatePath } from "next/cache";
import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";
import {
  createQBInvoiceFromData,
  voidQuickBooksInvoice,
} from "./quickbooks-actions";

const ORDER_TABLE = "orders";

const ORDER_COLUMNS =
  "id, created_at, order_id, facility_id, product_id, amount, status, qb_invoice_id, qb_invoice_status, qb_synced_at, facilities(name, qb_customer_id), products(name, qb_item_id)";

const ORDERS_PATH = "/dashboard/orders";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawOrder = {
  id: string;
  created_at: string;
  order_id: string;
  facility_id: string;
  product_id: string;
  amount: number;
  status: string;
  qb_invoice_id: string | null;
  qb_invoice_status: string | null;
  qb_synced_at: string | null;
  facilities: { name: string; qb_customer_id: string | null } | null;
  products: { name: string; qb_item_id: string | null } | null;
};

function flattenOrder(row: RawOrder): Order {
  return {
    id: row.id,
    created_at: row.created_at,
    order_id: row.order_id,
    facility_id: row.facility_id,
    product_id: row.product_id,
    amount: row.amount,
    status: row.status as Order["status"],
    facility_name: row.facilities?.name ?? "—",
    product_name: row.products?.name ?? "—",
    facility_qb_customer_id: row.facilities?.qb_customer_id ?? null,
    product_qb_item_id: row.products?.qb_item_id ?? null,
    qb_invoice_id: row.qb_invoice_id ?? null,
    qb_invoice_status: row.qb_invoice_status ?? null,
    qb_synced_at: row.qb_synced_at ?? null,
  };
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  try {
    const { data, error } = await dbSelect<RawOrder>({
      table: ORDER_TABLE,
      columns: ORDER_COLUMNS,
      order: { column: "created_at", ascending: false },
    });

    if (error) {
      console.error("[getAllOrders] Supabase error:", error.message);
      return [];
    }

    return (data ?? []).map(flattenOrder);
  } catch (err) {
    console.error("[getAllOrders] Unexpected error:", err);
    return [];
  }
}

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addOrder(formData: FormData): Promise<Order> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const order_id = formData.get("order_id") as string;
  const facility_id = formData.get("facility_id") as string;
  const product_id = formData.get("product_id") as string;
  const amount = parseFloat(formData.get("amount") as string) || 0;

  // ── Step 1: Fetch facility + product for QB ───────────────────────────────
  const [{ data: facility }, { data: product }] = await Promise.all([
    supabase
      .from("facilities")
      .select("name, qb_customer_id")
      .eq("id", facility_id)
      .single(),
    supabase
      .from("products")
      .select("name, qb_item_id")
      .eq("id", product_id)
      .single(),
  ]);

  if (!facility?.qb_customer_id || !product?.qb_item_id) {
    throw new Error(
      "Facility or product is not synced to QuickBooks. Please sync them first.",
    );
  }

  // ── Step 2: QB first — create invoice, throws on failure ──────────────────
  const qbInvoiceId = await createQBInvoiceFromData({
    orderDocNumber: order_id,
    qbCustomerId: facility.qb_customer_id,
    facilityName: facility.name,
    qbItemId: product.qb_item_id,
    productName: product.name,
    amount,
  });

  // ── Step 3: DB insert ─────────────────────────────────────────────────────
  const { data: insertedRow, error: insertError } = await supabase
    .from(ORDER_TABLE)
    .insert({
      order_id,
      facility_id,
      product_id,
      amount,
      status: "Processing",
      qb_invoice_id: qbInvoiceId,
      qb_invoice_status: "draft",
      qb_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !insertedRow) {
    console.error("[addOrder] DB insert error:", insertError?.message);
    try {
      await voidQuickBooksInvoice(qbInvoiceId);
    } catch (e) {
      console.error("[addOrder] QB void compensation failed:", e);
    }
    throw new Error("Failed to save order to database.");
  }

  // ── Step 4: Fetch full order with joins ───────────────────────────────────
  const { data: row, error: fetchError } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_COLUMNS)
    .eq("id", insertedRow.id)
    .single();

  if (fetchError || !row) {
    console.error("[addOrder] Fetch after insert failed:", fetchError?.message);
    throw new Error("Order saved but could not be retrieved.");
  }

  revalidatePath(ORDERS_PATH);
  return flattenOrder(row as unknown as RawOrder);
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();
  const status = formData.get("status") as Order["status"];

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, status, qb_invoice_id, qb_invoice_status")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  const { error: updateErr } = await supabase
    .from(ORDER_TABLE)
    .update({ status })
    .eq("id", orderId);

  if (updateErr) {
    console.error("[updateOrderStatus] DB error:", updateErr.message);
    throw new Error("Failed to update order status.");
  }

  revalidatePath(ORDERS_PATH);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteOrder(orderId: string): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, order_id, qb_invoice_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  // ── Step 1: Void QB invoice first if one exists ───────────────────────────
  if (current.qb_invoice_id) {
    const voidResult = await voidQuickBooksInvoice(current.qb_invoice_id);
    if (!voidResult.success) {
      throw new Error(`Failed to void QB invoice: ${voidResult.message}`);
    }
  }

  // ── Step 2: Delete from DB ────────────────────────────────────────────────
  const { error: deleteErr } = await supabase
    .from(ORDER_TABLE)
    .delete()
    .eq("id", orderId);

  if (deleteErr) {
    console.error("[deleteOrder] DB error:", deleteErr.message);
    throw new Error("Failed to delete order from database.");
  }

  revalidatePath(ORDERS_PATH);
}

// ── Dropdown helpers ──────────────────────────────────────────────────────────

export async function getUserFacility(): Promise<Facility | null> {
  try {
    const supabase = await getSupabaseClient();

    // ── Get current user explicitly ───────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getUserFacility] Auth error:", authError?.message);
      return null;
    }

    // ── Filter by user_id — don't rely on RLS alone ───────────────────────
    const { data, error } = await supabase
      .from("facilities")
      .select("id, name, location, status")
      .eq("user_id", user.id) // ✅ explicit filter
      .maybeSingle(); // ✅ won't throw if 0 or multiple rows

    if (error) {
      console.error("[getUserFacility] Supabase error:", error.message);
      return null;
    }

    if (!data) {
      console.warn("[getUserFacility] No facility found for user:", user.id);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[getUserFacility] Unexpected error:", err);
    return null;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await dbSelect<Product>({
    table: "products",
    columns: "id, name, price",
    order: { column: "name", ascending: true },
  });

  if (error) {
    console.error("[getAllProducts] Supabase error:", error.message);
    return [];
  }

  return data ?? [];
}
