"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, dbSelect } from "@/utils/supabase/db";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";
import {
  createQBInvoiceFromData,
  voidQuickBooksInvoice,
  deleteQuickBooksInvoice,
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

// ── Shared helper: get the current user's facility IDs ────────────────────────
//
// All mutations and reads go through this to ensure cross-user access is
// impossible regardless of what values the client sends.

async function getCurrentUserFacilityIds(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("facilities")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getCurrentUserFacilityIds] Supabase error:", error.message);
    return [];
  }

  return (data ?? []).map((f) => f.id);
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  try {
    const supabase = await getSupabaseClient();

    // 1. Resolve the current user (throws / returns null when not signed in)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getAllOrders] Auth error:", authError?.message);
      return [];
    }

    // 2. Find every facility that belongs to this user
    const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

    // No facilities → no orders to show
    if (facilityIds.length === 0) return [];

    // 3. Fetch only orders whose facility_id is in the user's facilities
    const { data, error } = await supabase
      .from(ORDER_TABLE)
      .select(ORDER_COLUMNS)
      .in("facility_id", facilityIds) // ← ownership filter
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getAllOrders] Supabase error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => flattenOrder(row as unknown as RawOrder));
  } catch (err) {
    console.error("[getAllOrders] Unexpected error:", err);
    return [];
  }
}

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addOrder(formData: FormData): Promise<Order> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const order_id = formData.get("order_id") as string;
  const facility_id = formData.get("facility_id") as string;
  const product_id = formData.get("product_id") as string;
  const amount = parseFloat(formData.get("amount") as string) || 0;

  // ── Step 1: Confirm the submitted facility belongs to this user ───────────
  //
  // Without this check a user could craft a request with someone else's
  // facility_id and attach an order to their account.
  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(facility_id)) {
    throw new Error(
      "You do not have permission to create orders for this facility.",
    );
  }

  // ── Step 2: Fetch facility + product for QB ───────────────────────────────
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

  // ── Step 3: QB first — create invoice, throws on failure ──────────────────
  const qbInvoiceId = await createQBInvoiceFromData({
    orderDocNumber: order_id,
    qbCustomerId: facility.qb_customer_id,
    facilityName: facility.name,
    qbItemId: product.qb_item_id,
    productName: product.name,
    amount,
  });

  // ── Step 4: DB insert ─────────────────────────────────────────────────────
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

  // ── Step 5: Fetch full order with joins ───────────────────────────────────
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const status = formData.get("status") as Order["status"];

  // Fetch the order and confirm ownership in one query
  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, status, qb_invoice_id, qb_invoice_status, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  // ── Ownership check ───────────────────────────────────────────────────────
  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to update this order.");
  }

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, order_id, qb_invoice_id, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  // ── Ownership check ───────────────────────────────────────────────────────
  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to delete this order.");
  }

  // ── Step 1: Delete QB invoice first if one exists ─────────────────────────
  if (current.qb_invoice_id) {
    const deleteResult = await deleteQuickBooksInvoice(current.qb_invoice_id);
    if (!deleteResult.success) {
      throw new Error(`Failed to delete QB invoice: ${deleteResult.message}`);
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getUserFacility] Auth error:", authError?.message);
      return null;
    }

    const { data, error } = await supabase
      .from("facilities")
      .select("id, name, location, status")
      .eq("user_id", user.id)
      .maybeSingle();

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
