"use server";

import { createClient } from "@/utils/supabase/server";
import { createQBClient, getValidQBClient } from "@/utils/quickbooks/client";
import { redirect } from "next/navigation";
import OAuthClient from "intuit-oauth";

// ── Public result type ────────────────────────────────────────────────────────
interface SyncResult {
  success: number;
  failed: number;
  messages: string[];
}

// ── Internal shape after normalisation ───────────────────────────────────────
interface OrderItem {
  quantity: number;
  unit_price: number;
  products: { name: string; qb_item_id: string | null } | null;
}

interface Order {
  id: string;
  facilities: { name: string; qb_customer_id: string | null } | null;
  order_items: OrderItem[];
}

// ── What Supabase actually returns (joined rows come back as arrays) ───────────
interface RawOrderItem {
  quantity: number;
  unit_price: number;
  products: { name: string; qb_item_id: string | null }[] | null;
}

interface RawOrder {
  id: string;
  facilities: { name: string; qb_customer_id: string | null }[] | null;
  order_items: RawOrderItem[];
}

// ── Flatten Supabase array-joins → single objects ─────────────────────────────
function normaliseOrders(raw: RawOrder[]): Order[] {
  return raw.map((o) => ({
    id: o.id,
    // Supabase returns the FK-joined row as a one-element array
    facilities: Array.isArray(o.facilities)
      ? (o.facilities[0] ?? null)
      : o.facilities,
    order_items: o.order_items.map((item) => ({
      quantity: item.quantity,
      unit_price: item.unit_price,
      products: Array.isArray(item.products)
        ? (item.products[0] ?? null)
        : item.products,
    })),
  }));
}

// ── QB base URL (mirrors exchangeCodeForTokens) ───────────────────────────────
function getQBBaseUrl() {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// ── Create a single QB Invoice via REST ───────────────────────────────────────
async function createQBInvoice(
  accessToken: string,
  realmId: string,
  order: Order,
): Promise<string> {
  const lines = order.order_items.map((item, idx) => ({
    LineNum: idx + 1,
    DetailType: "SalesItemLineDetail",
    Amount: item.quantity * item.unit_price,
    SalesItemLineDetail: {
      ItemRef: { value: item.products?.qb_item_id ?? "1" },
      Qty: item.quantity,
      UnitPrice: item.unit_price,
    },
  }));

  const payload = {
    Line: lines,
    CustomerRef: { value: order.facilities!.qb_customer_id }, // guarded before call
  };

  const res = await fetch(
    `${getQBBaseUrl()}/v3/company/${realmId}/invoice?minorversion=65`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`QB ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.Invoice.Id as string;
}

// ── Main server action ────────────────────────────────────────────────────────
export async function syncAllOrdersToQuickBooks(): Promise<SyncResult> {
  const supabase = await createClient();

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated");

  // ── 2. Valid QB client — token is fresh (auto-refreshed if needed) ────────
  const client = await getValidQBClient();
  const token = client.getToken();

  // Error 2 fix: guard undefined before passing to typed params
  const accessToken = token.access_token;
  const realmId = token.realmId;
  if (!accessToken || !realmId) throw new Error("QB_TOKEN_INVALID");

  // ── 3. Fetch unsynced delivered orders ────────────────────────────────────
  const { data: rawOrders, error: ordersError } = await supabase
    .from("orders")
    .select(
      `
      id,
      facilities ( name, qb_customer_id ),
      order_items (
        quantity,
        unit_price,
        products ( name, qb_item_id )
      )
    `,
    )
    .is("qb_invoice_id", null)
    .eq("status", "delivered");

  if (ordersError) throw new Error(ordersError.message);
  if (!rawOrders || rawOrders.length === 0) {
    return { success: 0, failed: 0, messages: ["No unsynced orders found."] };
  }

  // Error 1 fix: cast through unknown → RawOrder[], then normalise to Order[]
  const orders = normaliseOrders(rawOrders as unknown as RawOrder[]);

  const messages: string[] = [];
  let success = 0;
  let failed = 0;

  // ── 4. Sync each order ────────────────────────────────────────────────────
  for (const order of orders) {
    const label = order.facilities?.name ?? `Order ${order.id}`;

    if (!order.facilities?.qb_customer_id) {
      failed++;
      messages.push(`${label} — skipped: facility not synced to QB yet`);
      continue;
    }

    const missingItem = order.order_items.find((i) => !i.products?.qb_item_id);
    if (missingItem) {
      failed++;
      messages.push(
        `Order ${order.id} (${label}) — skipped: product "${missingItem.products?.name ?? "unknown"}" not synced to QB yet`,
      );
      continue;
    }

    try {
      const invoiceId = await createQBInvoice(accessToken, realmId, order);

      await supabase
        .from("orders")
        .update({ qb_invoice_id: invoiceId })
        .eq("id", order.id);

      success++;
      messages.push(`Order ${order.id} (${label}) → Invoice #${invoiceId}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      messages.push(`Order ${order.id} (${label}) — failed: ${msg}`);
    }
  }

  return { success, failed, messages };
}

// ── Connect — redirects to QuickBooks OAuth ───────────────────────────────────
export async function redirectToQuickBooks(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");

  const state = crypto.randomUUID();
  await supabase.auth.updateUser({
    data: {
      qb_oauth_state: state,
      qb_oauth_state_exp: Date.now() + 10 * 60 * 1000,
    },
  });

  const authUri = createQBClient().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });

  redirect(authUri);
}


// ── Exchange code for tokens ──────────────────────────────────────────────────
export async function exchangeCodeForTokens(        // ← ADD THIS
  callbackUrl: string,
  realmId: string,
  returnedState: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated");

  const storedState = user.user_metadata?.qb_oauth_state as string | undefined;
  const stateExp = user.user_metadata?.qb_oauth_state_exp as number | undefined;

  await supabase.auth.updateUser({
    data: { qb_oauth_state: null, qb_oauth_state_exp: null },
  });

  if (!storedState || storedState !== returnedState)
    throw new Error("OAuth state mismatch — possible CSRF attack.");
  if (!stateExp || Date.now() > stateExp)
    throw new Error("OAuth state expired.");

  const client = createQBClient();
  await client.createToken(callbackUrl);
  const token = client.getToken();

  let companyName = "Unknown Company";
  try {
    const baseUrl =
      process.env.QB_ENVIRONMENT === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    const res = await fetch(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json",
        },
      },
    );
    if (res.ok) {
      const data = await res.json();
      companyName = data?.CompanyInfo?.CompanyName ?? "Unknown Company";
    }
  } catch (e) {
    console.warn("[QB] Company name fetch threw:", e);
  }

  const now = new Date();
  const { error: upsertError } = await supabase
    .from("quickbooks_connections")
    .upsert(
      {
        user_id: user.id,
        realm_id: realmId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        access_token_expires_at: new Date(now.getTime() + 3600 * 1000).toISOString(),
        refresh_token_expires_at: new Date(now.getTime() + 8726400 * 1000).toISOString(),
        company_name: companyName,
        environment: process.env.QB_ENVIRONMENT,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) throw new Error(`Failed to save QB connection: ${upsertError.message}`);
}

// ── Disconnect — deletes connection row and redirects ─────────────────────────
export async function disconnectQuickBooks(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("quickbooks_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) throw new Error("Failed to disconnect QuickBooks");
  redirect("/dashboard/quickbooks");
}

// app/dashboard/quickbooks/actions.ts  ← add this

export async function getQuickBooksConnection() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data, error } = await supabase
      .from("quickbooks_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[getQuickBooksConnection] Error:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[getQuickBooksConnection] Unexpected error:", err);
    return null;
  }
}



