"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole, requireAdminOrThrow } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep, isSupport } from "@/utils/helpers/role";
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

/* -------------------------------------------------------------------------- */
/* getContactsByFacility                                                     */
/* -------------------------------------------------------------------------- */

export async function getContactsByFacility(
  facilityId: string,
): Promise<IContact[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role) && !isSupport(role)) {
    throw new Error("Unauthorized");
  }

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
    await requireAdminOrThrow(supabase);

    const raw = {
      first_name:        formData.get("first_name") as string,
      last_name:         formData.get("last_name") as string,
      title:             formData.get("title") as string,
      email:             formData.get("email") as string,
      phone:             formData.get("phone") as string,
      preferred_contact: (formData.get("preferred_contact") as string) || "email",
      notes:             toNullable(formData.get("notes") as string),
    };

    const parsed = createContactSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IContactFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IContactFormState["fieldErrors"]>;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      return { error: null, success: false, fieldErrors };
    }

    const payload: InsertContactPayload = {
      facility_id:       facilityId,
      first_name:        parsed.data.first_name,
      last_name:         parsed.data.last_name,
      title:             parsed.data.title,
      email:             parsed.data.email,
      phone:             parsed.data.phone,
      preferred_contact: parsed.data.preferred_contact,
      notes:             toNullable(parsed.data.notes),
      is_active:         true,
    };

    const { data, error } = await supabase
      .from(CONTACTS_TABLE)
      .insert(payload)
      .select(CONTACT_SELECT)
      .single();

    if (error) {
      console.error("[createContact] Error:", JSON.stringify(error));
      return { error: error.message || "Failed to create contact.", success: false };
    }

    revalidatePath(`${ACCOUNTS_PATH}/${facilityId}`);
    return { error: null, success: true, contact: data as IContact };
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
    await requireAdminOrThrow(supabase);

    const raw = {
      first_name:        formData.get("first_name") as string,
      last_name:         formData.get("last_name") as string,
      title:             formData.get("title") as string,
      email:             formData.get("email") as string,
      phone:             formData.get("phone") as string,
      preferred_contact: (formData.get("preferred_contact") as string) || "email",
      notes:             toNullable(formData.get("notes") as string),
    };

    const parsed = updateContactSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IContactFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<IContactFormState["fieldErrors"]>;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      return { error: null, success: false, fieldErrors };
    }

    const payload: UpdateContactPayload = {
      first_name:        parsed.data.first_name,
      last_name:         parsed.data.last_name,
      title:             parsed.data.title,
      email:             parsed.data.email,
      phone:             parsed.data.phone,
      preferred_contact: parsed.data.preferred_contact,
      notes:             toNullable(parsed.data.notes),
    };

    const { error } = await supabase
      .from(CONTACTS_TABLE)
      .update(payload)
      .eq("id", contactId)
      .eq("facility_id", facilityId);

    if (error) {
      console.error("[updateContact] Error:", JSON.stringify(error));
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
  await requireAdminOrThrow(supabase);

  const { error } = await supabase
    .from(CONTACTS_TABLE)
    .update({ is_active: false })
    .eq("id", contactId)
    .eq("facility_id", facilityId);

  if (error) {
    console.error("[deactivateContact] Error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to deactivate contact.");
  }

  revalidatePath(`${ACCOUNTS_PATH}/${facilityId}`);
}
