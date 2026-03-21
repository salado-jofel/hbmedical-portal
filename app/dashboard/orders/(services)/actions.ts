"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, dbSelect } from "@/utils/supabase/db";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import { requireUser } from "@/utils/auth-guard";

const ORDER_TABLE = "orders";

const ORDER_COLUMNS =
  "id, created_at, order_id, facility_id, product_id, amount, status, facilities(name), products(name)";

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
  facilities: { name: string } | null;
  products: { name: string } | null;
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

    // QB fields removed from app flow.
    // Keep these as null temporarily if your existing Order interface still expects them.
    facility_qb_customer_id: null,
    product_qb_item_id: null,
    qb_invoice_id: null,
    qb_invoice_status: null,
    qb_synced_at: null,
  };
}

// ── Shared helper: get the current user's facility IDs ────────────────────────

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[getAllOrders] Auth error:", authError?.message);
      return [];
    }

    const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

    if (facilityIds.length === 0) return [];

    const { data, error } = await supabase
      .from(ORDER_TABLE)
      .select(ORDER_COLUMNS)
      .in("facility_id", facilityIds)
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

  // Confirm facility belongs to current user
  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(facility_id)) {
    throw new Error(
      "You do not have permission to create orders for this facility.",
    );
  }

  // Optional: verify product exists
  const { data: productExists, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", product_id)
    .maybeSingle();

  if (productError) {
    console.error("[addOrder] Product lookup error:", productError.message);
    throw new Error("Failed to validate selected product.");
  }

  if (!productExists) {
    throw new Error("Selected product not found.");
  }

  // Insert local order only (no QuickBooks sync)
  const { data: insertedRow, error: insertError } = await supabase
    .from(ORDER_TABLE)
    .insert({
      order_id,
      facility_id,
      product_id,
      amount,
      status: "Processing",
    })
    .select("id")
    .single();

  if (insertError || !insertedRow) {
    console.error("[addOrder] DB insert error:", insertError?.message);
    throw new Error("Failed to save order to database.");
  }

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

  const { data: current, error: fetchErr } = await supabase
    .from(ORDER_TABLE)
    .select("id, status, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

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
    .select("id, order_id, facility_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !current) throw new Error("Order not found.");

  const facilityIds = await getCurrentUserFacilityIds(supabase, user.id);

  if (!facilityIds.includes(current.facility_id)) {
    throw new Error("You do not have permission to delete this order.");
  }

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
