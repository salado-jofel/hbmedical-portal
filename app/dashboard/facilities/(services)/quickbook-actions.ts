// app/(your-path)/quickbook-actions.ts  ← UPDATE (full file replacement)
"use server";

import { createClient } from "@/utils/supabase/server";
import { qbRequest, qbRequestOrThrow } from "@/utils/quickbooks/client";
import { requireUser } from "@/utils/auth-guard";

// ── Shared types ──────────────────────────────────────────────────────────────

interface QBCustomerResponse {
  Customer: {
    Id: string;
    SyncToken: string;
    DisplayName: string;
    Active: boolean;
    PrimaryPhone?: { FreeFormNumber: string };
  };
}

export interface QBCustomerResult {
  qbCustomerId: string;
  qbSyncToken: string;
}

// ── Internal: resolve SyncToken ───────────────────────────────────────────────

async function resolveSyncToken(
  qbCustomerId: string,
  storedToken: string | null,
): Promise<string> {
  if (storedToken) return storedToken;

  const res = await qbRequestOrThrow<QBCustomerResponse>(
    "GET",
    `/customer/${qbCustomerId}`,
  );
  return res.Customer.SyncToken;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createQBCustomer(
  name: string,
  phone: string | null,
): Promise<QBCustomerResult> {
  const res = await qbRequestOrThrow<QBCustomerResponse>("POST", "/customer", {
    DisplayName: name,
    CompanyName: name,
    Active: true,
    ...(phone && { PrimaryPhone: { FreeFormNumber: phone } }),
  });

  return {
    qbCustomerId: res.Customer.Id,
    qbSyncToken: res.Customer.SyncToken,
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateQBCustomer(
  qbCustomerId: string,
  storedSyncToken: string | null,
  payload: { name: string; phone?: string | null },
): Promise<QBCustomerResult> {
  const syncToken = await resolveSyncToken(qbCustomerId, storedSyncToken);

  const res = await qbRequestOrThrow<QBCustomerResponse>("POST", "/customer", {
    Id: qbCustomerId,
    SyncToken: syncToken,
    DisplayName: payload.name,
    CompanyName: payload.name,
    Active: true,
    ...(payload.phone && { PrimaryPhone: { FreeFormNumber: payload.phone } }),
  });

  return {
    qbCustomerId: res.Customer.Id,
    qbSyncToken: res.Customer.SyncToken,
  };
}

// ── Deactivate ────────────────────────────────────────────────────────────────

export async function deactivateQBCustomer(
  qbCustomerId: string,
  storedSyncToken: string | null,
): Promise<QBCustomerResult> {
  const syncToken = await resolveSyncToken(qbCustomerId, storedSyncToken);

  const res = await qbRequestOrThrow<QBCustomerResponse>("POST", "/customer", {
    Id: qbCustomerId,
    SyncToken: syncToken,
    DisplayName: `_deactivated_${qbCustomerId}`,
    Active: false,
  });

  return {
    qbCustomerId: res.Customer.Id,
    qbSyncToken: res.Customer.SyncToken,
  };
}

// ── Reactivate ────────────────────────────────────────────────────────────────

export async function reactivateQBCustomer(
  qbCustomerId: string,
  syncToken: string,
  name: string,
): Promise<QBCustomerResult> {
  const res = await qbRequestOrThrow<QBCustomerResponse>("POST", "/customer", {
    Id: qbCustomerId,
    SyncToken: syncToken,
    DisplayName: name,
    Active: true,
  });

  return {
    qbCustomerId: res.Customer.Id,
    qbSyncToken: res.Customer.SyncToken,
  };
}

// quickbook-actions.ts — update these two functions only

export async function syncFacilityToQuickBooks(
  facilityId: string,
  options: { skipAuthCheck?: boolean } = {},   // ← allows syncAll to skip repeat check
): Promise<{ success: boolean; message: string }> {
  // Auth check runs OUTSIDE try/catch — throws hard on failure ✅
  if (!options.skipAuthCheck) {
    await requireUser();
  }

  try {
    const supabase = await createClient();
    const { data: facility, error } = await supabase
      .from("facilities")
      .select("id, name, phone, status, qb_customer_id, qb_sync_token")
      .eq("id", facilityId)
      .single();

    if (error || !facility)
      return { success: false, message: "Facility not found" };

    let result: QBCustomerResult;
    if (facility.qb_customer_id) {
      result = await updateQBCustomer(
        facility.qb_customer_id,
        facility.qb_sync_token ?? null,
        { name: facility.name, phone: facility.phone },
      );
    } else {
      result = await createQBCustomer(facility.name, facility.phone);
    }

    const { error: updateError } = await supabase
      .from("facilities")
      .update({
        qb_customer_id: result.qbCustomerId,
        qb_sync_token:  result.qbSyncToken,
        qb_synced_at:   new Date().toISOString(),
      })
      .eq("id", facilityId);

    if (updateError)
      return { success: false, message: "QB synced but failed to save to DB" };

    return {
      success: true,
      message: `Synced (QB Customer ID: ${result.qbCustomerId})`,
    };
  } catch (err) {
    console.error("[syncFacilityToQuickBooks] Unexpected error:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}

export async function syncAllFacilitiesToQuickBooks(): Promise<{
  success: number;
  failed: number;
  messages: string[];
}> {
  await requireUser(); // ← one auth check for the whole batch ✅

  const supabase = await createClient();
  const { data: facilities, error } = await supabase
    .from("facilities")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error || !facilities) {
    return { success: 0, failed: 0, messages: ["Failed to fetch facilities"] };
  }

  const settled = await Promise.allSettled(
    facilities.map((f) =>
      syncFacilityToQuickBooks(f.id, { skipAuthCheck: true })  // ← skip N repeat checks ✅
        .then((r) => ({ name: f.name, result: r })),
    ),
  );

  let success = 0;
  let failed  = 0;
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

