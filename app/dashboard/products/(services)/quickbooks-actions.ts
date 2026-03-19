"use server";

import { createClient } from "@/utils/supabase/server";
import { getValidQBClient } from "@/utils/quickbooks/client";
import { requireUser } from "@/utils/auth-guard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QBItem {
  Id?: string;
  SyncToken?: string;
  Name: string;
  Description?: string;
  UnitPrice: number;
  Type: string;
  IncomeAccountRef: { value: string; name?: string };
  Active: boolean;
}

interface QBItemResponse {
  Item: QBItem & { Id: string; SyncToken: string };
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function getQBBaseUrl() {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// ── Income account ref ────────────────────────────────────────────────────────

async function getIncomeAccountRef(): Promise<{
  value: string;
  name: string;
} | null> {
  const client = await getValidQBClient();
  const token = client.getToken();

  const query = `SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1`;
  const url = `${getQBBaseUrl()}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error("[QB Product] Account query failed:", response.status);
    return null;
  }

  const data = await response.json();
  const accounts = data?.QueryResponse?.Account;
  if (!accounts?.length) return null;

  return { value: accounts[0].Id, name: accounts[0].Name };
}

// ── QB fetch helpers ──────────────────────────────────────────────────────────

async function qbGet<T>(path: string): Promise<T> {
  const client = await getValidQBClient();
  const token = client.getToken();

  const response = await fetch(
    `${getQBBaseUrl()}/v3/company/${token.realmId}${path}?minorversion=65`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`QB GET ${path} failed (${response.status}): ${errText}`);
  }

  return response.json() as Promise<T>;
}

async function qbPost<T>(path: string, body: object): Promise<T> {
  const client = await getValidQBClient();
  const token = client.getToken();

  const response = await fetch(
    `${getQBBaseUrl()}/v3/company/${token.realmId}${path}?minorversion=65`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`QB POST ${path} failed (${response.status}): ${errText}`);
  }

  return response.json() as Promise<T>;
}

// ── Create QB Item ────────────────────────────────────────────────────────────

export async function createQBItem(
  name: string,
  price: number,
): Promise<string> {
  const incomeAccountRef = await getIncomeAccountRef();
  if (!incomeAccountRef) {
    throw new Error("[createQBItem] No income account found in QuickBooks.");
  }

  const res = await qbPost<QBItemResponse>("/item", {
    Name: name,
    Description: name,
    UnitPrice: price,
    Type: "Service",
    IncomeAccountRef: incomeAccountRef,
    Active: true,
  });

  if (!res?.Item?.Id) {
    throw new Error("[createQBItem] QB returned no Item ID.");
  }

  return res.Item.Id;
}

// ── Deactivate QB Item ────────────────────────────────────────────────────────

export async function deactivateQBItem(qbItemId: string): Promise<void> {
  const existing = await qbGet<QBItemResponse>(`/item/${qbItemId}`);

  await qbPost<QBItemResponse>("/item", {
    Id: qbItemId,
    SyncToken: existing.Item.SyncToken,
    Name: existing.Item.Name,
    UnitPrice: existing.Item.UnitPrice,
    Type: existing.Item.Type,
    IncomeAccountRef: existing.Item.IncomeAccountRef,
    Active: false,
  });
}

// ── Reactivate QB Item ────────────────────────────────────────────────────────

export async function reactivateQBItem(
  qbItemId: string,
  name: string,
  price: number,
): Promise<void> {
  const existing = await qbGet<QBItemResponse>(`/item/${qbItemId}`);

  const incomeAccountRef = await getIncomeAccountRef();
  if (!incomeAccountRef) {
    throw new Error("[reactivateQBItem] No income account found.");
  }

  await qbPost<QBItemResponse>("/item", {
    Id: qbItemId,
    SyncToken: existing.Item.SyncToken,
    Name: name,
    Description: name,
    UnitPrice: price,
    Type: "Service",
    IncomeAccountRef: incomeAccountRef,
    Active: true,
  });
}

// ── Sync single product to QB ─────────────────────────────────────────────────

export async function syncProductToQuickBooks(
  productId: string,
  override?: { name: string; price: number },
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, price, qb_item_id, qb_synced_at")
      .eq("id", productId)
      .single();

    if (error || !product) {
      return { success: false, message: "Product not found" };
    }

    const name = override?.name ?? product.name;
    const price = override?.price ?? parseFloat(product.price) ?? 0;

    const incomeAccountRef = await getIncomeAccountRef();
    if (!incomeAccountRef) {
      return {
        success: false,
        message: "No income account found in QuickBooks",
      };
    }

    const itemPayload = {
      Name: name,
      Description: name,
      UnitPrice: price,
      Type: "Service",
      IncomeAccountRef: incomeAccountRef,
      Active: true,
    };

    let qbItemId: string;

    if (product.qb_item_id) {
      // ── Update existing item ────────────────────────────────────────────
      const existing = await qbGet<QBItemResponse>(
        `/item/${product.qb_item_id}`,
      );

      if (!existing?.Item?.SyncToken) {
        return { success: false, message: "Failed to fetch existing QB item" };
      }

      const updated = await qbPost<QBItemResponse>("/item", {
        ...itemPayload,
        Id: product.qb_item_id,
        SyncToken: existing.Item.SyncToken,
      });

      if (!updated?.Item?.Id) {
        return { success: false, message: "Failed to update QB item" };
      }

      qbItemId = updated.Item.Id;
    } else {
      // ── Create new item ─────────────────────────────────────────────────
      const created = await qbPost<QBItemResponse>("/item", itemPayload);

      if (!created?.Item?.Id) {
        return { success: false, message: "Failed to create QB item" };
      }

      qbItemId = created.Item.Id;
    }

    // ── Save QB item ID back to DB ────────────────────────────────────────
    await supabase
      .from("products")
      .update({
        qb_item_id: qbItemId,
        qb_synced_at: new Date().toISOString(),
      })
      .eq("id", productId);

    return {
      success: true,
      message: `Synced to QuickBooks (Item ID: ${qbItemId})`,
    };
  } catch (err) {
    console.error("[syncProductToQuickBooks] Error:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}

// ── Sync ALL products to QB ───────────────────────────────────────────────────

export async function syncAllProductsToQuickBooks(): Promise<{
  success: number;
  failed: number;
  messages: string[];
}> {
  await requireUser();

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error || !products) {
    return { success: 0, failed: 0, messages: ["Failed to fetch products"] };
  }

  const settled = await Promise.allSettled(
    products.map((p) =>
      syncProductToQuickBooks(p.id).then((r) => ({ name: p.name, result: r })),
    ),
  );

  let success = 0;
  let failed = 0;
  const messages: string[] = [];

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      const { name, result } = outcome.value;
      result.success ? success++ : failed++;
      messages.push(`${name}: ${result.message}`);
    } else {
      failed++;
      messages.push(`Unknown: ${String(outcome.reason)}`);
    }
  }

  return { success, failed, messages };
}
