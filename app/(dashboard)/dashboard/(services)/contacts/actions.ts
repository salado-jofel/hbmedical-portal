"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { ACCOUNTS_PATH, CONTACTS_TABLE, CONTACT_SELECT } from "@/utils/constants/accounts";
import {
  createContactSchema,
  updateContactSchema,
  type IContact,
  type IContactFormState,
  type InsertContactPayload,
  type UpdateContactPayload,
} from "@/utils/interfaces/contacts";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function toNullable(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

async function canManageContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  facilityId: string,
): Promise<boolean> {
  const role = await getUserRole(supabase);
  if (role === "admin") return true;

  if (role === "sales_representative") {
    const { data } = await supabase
      .from("facilities")
      .select("assigned_rep")
      .eq("id", facilityId)
      .maybeSingle();
    return data?.assigned_rep === userId;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* getContactsByFacility                                                     */
/* -------------------------------------------------------------------------- */

export async function getContactsByFacility(
  facilityId: string,
): Promise<IContact[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .select(CONTACT_SELECT)
    .eq("facility_id", facilityId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[getContactsByFacility] Error:", error);
    throw new Error(error.message || "Failed to fetch contacts.");
  }

  return (data ?? []) as IContact[];
}

/* -------------------------------------------------------------------------- */
/* createContact                                                             */
/* -------------------------------------------------------------------------- */

export async function createContact(
  facilityId: string,
  _prevState: IContactFormState | null,
  formData: FormData,
): Promise<IContactFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const allowed = await canManageContacts(supabase, user.id, facilityId);
    if (!allowed) {
      return { error: "You do not have permission to add contacts to this account.", success: false };
    }

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      title: toNullable(formData.get("title") as string),
      email: toNullable(formData.get("email") as string) || null,
      phone: toNullable(formData.get("phone") as string),
      preferred_contact: formData.get("preferred_contact") as string || "either",
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = createContactSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const payload: InsertContactPayload = {
      facility_id: facilityId,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      title: toNullable(parsed.data.title),
      email: toNullable(parsed.data.email),
      phone: toNullable(parsed.data.phone),
      preferred_contact: parsed.data.preferred_contact ?? "either",
      notes: toNullable(parsed.data.notes),
      is_active: true,
    };

    const { error } = await supabase.from(CONTACTS_TABLE).insert(payload);

    if (error) {
      console.error("[createContact] Error:", error);
      return { error: error.message || "Failed to create contact.", success: false };
    }

    revalidatePath(`${ACCOUNTS_PATH}/${facilityId}`);
    return { error: null, success: true };
  } catch (err) {
    console.error("[createContact] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* updateContact                                                             */
/* -------------------------------------------------------------------------- */

export async function updateContact(
  contactId: string,
  facilityId: string,
  _prevState: IContactFormState | null,
  formData: FormData,
): Promise<IContactFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const allowed = await canManageContacts(supabase, user.id, facilityId);
    if (!allowed) {
      return { error: "You do not have permission to edit this contact.", success: false };
    }

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      title: toNullable(formData.get("title") as string),
      email: toNullable(formData.get("email") as string) || null,
      phone: toNullable(formData.get("phone") as string),
      preferred_contact: formData.get("preferred_contact") as string || "either",
      notes: toNullable(formData.get("notes") as string),
    };

    const parsed = updateContactSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const payload: UpdateContactPayload = {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      title: toNullable(parsed.data.title),
      email: toNullable(parsed.data.email),
      phone: toNullable(parsed.data.phone),
      preferred_contact: parsed.data.preferred_contact ?? "either",
      notes: toNullable(parsed.data.notes),
    };

    const { error } = await supabase
      .from(CONTACTS_TABLE)
      .update(payload)
      .eq("id", contactId)
      .eq("facility_id", facilityId);

    if (error) {
      console.error("[updateContact] Error:", error);
      return { error: error.message || "Failed to update contact.", success: false };
    }

    revalidatePath(`${ACCOUNTS_PATH}/${facilityId}`);
    return { error: null, success: true };
  } catch (err) {
    console.error("[updateContact] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deactivateContact                                                         */
/* -------------------------------------------------------------------------- */

export async function deactivateContact(
  contactId: string,
  facilityId: string,
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const allowed = await canManageContacts(supabase, user.id, facilityId);
  if (!allowed) {
    throw new Error("You do not have permission to remove this contact.");
  }

  const { error } = await supabase
    .from(CONTACTS_TABLE)
    .update({ is_active: false })
    .eq("id", contactId)
    .eq("facility_id", facilityId);

  if (error) {
    console.error("[deactivateContact] Error:", error);
    throw new Error(error.message || "Failed to deactivate contact.");
  }

  revalidatePath(`${ACCOUNTS_PATH}/${facilityId}`);
}
