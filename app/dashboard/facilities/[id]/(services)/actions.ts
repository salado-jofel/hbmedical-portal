"use server";

import { revalidatePath } from "next/cache";
import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type {
  Facility,
  UpdateFacilityPayload,
} from "@/app/(interfaces)/facility";
import { requireUser } from "@/utils/auth-guard";
import { requireEnum, requireString } from "@/utils/form";
import {
  updateQBCustomer,
  deactivateQBCustomer,
  reactivateQBCustomer,
} from "../../(services)/quickbook-actions";

const FACILITY_TABLE = "facilities";
const FACILITY_COLUMNS =
  "id, created_at, name, type, contact, phone, status, qb_customer_id, qb_synced_at, qb_sync_token";

const FACILITY_TYPES = [
  "Hospital",
  "Clinic",
  "Pharmacy",
  "Laboratory",
  "Rehabilitation Center",
  "Dental Clinic",
  "Birthing Center",
] as const;

const FACILITY_STATUSES = ["Active", "Inactive"] as const;

function getFacilityPath(id: string) {
  return `/dashboard/facilities/${id}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function getFacilityById(id: string): Promise<Facility | null> {
  const { data, error } = await dbSelect<Facility>({
    table: FACILITY_TABLE,
    columns: FACILITY_COLUMNS,
    filter: { column: "id", value: id },
  });

  if (error) {
    console.error("[getFacilityById] Supabase error:", error.message);
    return null;
  }

  return data?.[0] ?? null;
}

// ── EDIT ──────────────────────────────────────────────────────────────────────

export async function editFacility(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(FACILITY_TABLE)
    .select(FACILITY_COLUMNS)
    .eq("id", id)
    .single();

  if (fetchErr || !current) throw new Error("Facility not found.");
  if (!current.qb_customer_id)
    throw new Error("Facility has no QB customer ID.");

  const name = requireString(formData, "name");
  const type = requireEnum(formData, "type", FACILITY_TYPES);
  const contact = requireString(formData, "contact");
  const phone = requireString(formData, "phone");
  const status = requireEnum(formData, "status", FACILITY_STATUSES);

  // ── Sync name + phone to QB first ─────────────────────────────────────────
  const qb = await updateQBCustomer(
    current.qb_customer_id,
    current.qb_sync_token ?? null,
    { name, phone },
  );

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from(FACILITY_TABLE)
    .update({
      name,
      type,
      contact,
      phone,
      status,
      qb_sync_token: qb.qbSyncToken,
      qb_synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[editFacility] DB error:", updateErr.message);
    try {
      await updateQBCustomer(qb.qbCustomerId, qb.qbSyncToken, {
        name: current.name,
        phone: current.phone,
      });
    } catch (e) {
      console.error("[editFacility] QB revert failed:", e);
    }
    throw new Error("Failed to update facility in database.");
  }

  revalidatePath(getFacilityPath(id));
  revalidatePath("/dashboard/facilities");
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteFacility(id: string): Promise<void> {
  await requireUser();

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(FACILITY_TABLE)
    .select(FACILITY_COLUMNS)
    .eq("id", id)
    .single();

  if (fetchErr || !current) throw new Error("Facility not found.");
  if (!current.qb_customer_id)
    throw new Error("Facility has no QB customer ID.");

  const qbAfter = await deactivateQBCustomer(
    current.qb_customer_id,
    current.qb_sync_token ?? null,
  );

  const { error: deleteErr } = await supabase
    .from(FACILITY_TABLE)
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[deleteFacility] DB error:", deleteErr.message);
    try {
      await reactivateQBCustomer(
        qbAfter.qbCustomerId,
        qbAfter.qbSyncToken,
        current.name,
      );
    } catch (e) {
      console.error("[deleteFacility] QB reactivation failed:", e);
    }
    throw new Error("Failed to delete facility from database.");
  }

  revalidatePath(getFacilityPath(id));
  revalidatePath("/dashboard/facilities");
}
