// app/(your-path)/facility-actions.ts  ← UPDATE (full file replacement)
"use server";

import { revalidatePath } from "next/cache";
import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type {
  Facility,
  UpdateFacilityPayload,
} from "@/app/(interfaces)/facility";
import {
  createQBCustomer,
  updateQBCustomer,
  deactivateQBCustomer,
  reactivateQBCustomer,
} from "./quickbook-actions";
import { requireUser } from "@/utils/auth-guard";
import { requireEnum, requireString } from "@/utils/form";

const FACILITY_TABLE = "facilities";
const FACILITY_COLUMNS =
  "id, created_at, name, type, contact, phone, status, qb_customer_id, qb_synced_at, qb_sync_token";
const FACILITY_PATH = "/dashboard/facilities";

// ── TODO: update these to match your actual DB enum values ───────────────────
// app/dashboard/facilities/actions.ts
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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function getFacilities(): Promise<Facility[]> {
  const { data, error } = await dbSelect<Facility>({
    table: FACILITY_TABLE,
    columns: FACILITY_COLUMNS,
    order: { column: "created_at", ascending: false },
  });
  if (error) {
    console.error("[getFacilities]", error.message);
    return [];
  }
  return data ?? [];
}

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addFacility(formData: FormData): Promise<Facility> {
  await requireUser(); // ← auth guard ✅

  // Validated extraction — throws on missing/invalid fields ✅
  const name = requireString(formData, "name");
  const type = requireEnum(formData, "type", FACILITY_TYPES);
  const contact = requireString(formData, "contact");
  const phone = requireString(formData, "phone");

  // Step 1: QB — throws on failure, DB never touched ✅
  const qb = await createQBCustomer(name, phone);

  // Step 2: DB insert — single client, no duplicate instantiation ✅
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(FACILITY_TABLE)
    .insert({
      name,
      type,
      contact,
      phone,
      status: "Active",
      qb_customer_id: qb.qbCustomerId,
      qb_sync_token: qb.qbSyncToken,
      qb_synced_at: new Date().toISOString(),
    })
    .select(FACILITY_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[addFacility] DB error:", error?.message);
    try {
      await deactivateQBCustomer(qb.qbCustomerId, qb.qbSyncToken);
    } catch (e) {
      console.error("[addFacility] QB compensation failed:", e);
    }
    throw new Error("Failed to save facility to database.");
  }

  revalidatePath(FACILITY_PATH);
  return data as Facility;
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateFacility(
  id: string,
  form: UpdateFacilityPayload,
): Promise<void> {
  await requireUser(); // ← auth guard ✅

  const supabase = await getSupabaseClient();

  const { data: current, error: fetchErr } = await supabase
    .from(FACILITY_TABLE)
    .select(FACILITY_COLUMNS)
    .eq("id", id)
    .single();

  if (fetchErr || !current) throw new Error("Facility not found.");
  if (!current.qb_customer_id)
    throw new Error("Facility has no QB customer ID.");

  const qbName = form.name ?? current.name;
  const qbPhone = form.phone ?? current.phone;

  const qb = await updateQBCustomer(
    current.qb_customer_id,
    current.qb_sync_token ?? null,
    { name: qbName, phone: qbPhone },
  );

  const { error: updateErr } = await supabase
    .from(FACILITY_TABLE)
    .update({
      ...form,
      qb_sync_token: qb.qbSyncToken,
      qb_synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[updateFacility] DB error:", updateErr.message);
    try {
      await updateQBCustomer(qb.qbCustomerId, qb.qbSyncToken, {
        name: current.name,
        phone: current.phone,
      });
    } catch (e) {
      console.error("[updateFacility] QB revert failed:", e);
    }
    throw new Error("Failed to update facility in database.");
  }

  revalidatePath(FACILITY_PATH);
  revalidatePath(`${FACILITY_PATH}/${id}`);
}

// ── EDIT (FormData wrapper) ───────────────────────────────────────────────────

export async function editFacility(
  id: string,
  formData: FormData,
): Promise<void> {
  // requireUser is called inside updateFacility — no need to duplicate here
  await updateFacility(id, {
    name: requireString(formData, "name"),
    type: requireEnum(formData, "type", FACILITY_TYPES),
    contact: requireString(formData, "contact"),
    phone: requireString(formData, "phone"),
    status: requireEnum(formData, "status", FACILITY_STATUSES),
  });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteFacility(id: string): Promise<void> {
  await requireUser(); // ← auth guard ✅

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

  revalidatePath(FACILITY_PATH);
}
