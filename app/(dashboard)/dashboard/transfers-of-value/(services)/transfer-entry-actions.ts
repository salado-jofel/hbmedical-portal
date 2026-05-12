"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import {
  TRANSFERS_OF_VALUE_PATH,
  VALUE_TRANSFER_ENTRIES_TABLE,
} from "@/utils/constants/value-transfers";
import {
  valueTransferEntrySchema,
  mapValueTransferEntry,
  type IValueTransferEntry,
  type IValueTransferEntryFormState,
} from "@/utils/interfaces/value-transfers";
import { getReportAccess, requireReportWriteAccess } from "./_shared";

/* ── Read: list entries for a single report ── */
export async function getTransferEntries(reportId: string): Promise<IValueTransferEntry[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const access = await getReportAccess(reportId);
  if (!access) return [];

  const role = await getUserRole(supabase);
  const client = isAdmin(role) ? createAdminClient() : supabase;

  const { data, error } = await client
    .from(VALUE_TRANSFER_ENTRIES_TABLE)
    .select("*")
    .eq("report_id", reportId)
    .order("transfer_date", { ascending: false });

  if (error) {
    console.error("[getTransferEntries] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to load entries.");
  }
  return (data ?? []).map((r) => mapValueTransferEntry(r as Record<string, unknown>));
}

/* ── Internal: parse FormData with the entry schema, return field errors ── */
function parseEntryForm(formData: FormData) {
  const raw = {
    transfer_date: formData.get("transfer_date") as string,
    recipient_name: formData.get("recipient_name") as string,
    recipient_credential: formData.get("recipient_credential") as string,
    recipient_npi: (formData.get("recipient_npi") as string | null) || undefined,
    recipient_address: (formData.get("recipient_address") as string | null) || null,
    affiliation: (formData.get("affiliation") as string | null) || null,
    form_category: formData.get("form_category") as string,
    description: (formData.get("description") as string | null) || null,
    value_amount: formData.get("value_amount") as string,
    is_estimate: formData.get("is_estimate") === "on",
  };
  return valueTransferEntrySchema.safeParse(raw);
}

function pickFieldErrors(
  issues: ZodError["issues"],
): IValueTransferEntryFormState["fieldErrors"] {
  const fieldErrors: IValueTransferEntryFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof NonNullable<
      IValueTransferEntryFormState["fieldErrors"]
    >;
    fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

/* ── Add a transfer entry to a draft report ── */
export async function addTransferEntry(
  _prev: IValueTransferEntryFormState | null,
  formData: FormData,
): Promise<IValueTransferEntryFormState> {
  try {
    const reportId = formData.get("report_id") as string;
    if (!reportId) return { success: false, error: "Missing report id." };

    await requireReportWriteAccess(reportId);

    const parsed = parseEntryForm(formData);
    if (!parsed.success) {
      return { success: false, error: null, fieldErrors: pickFieldErrors(parsed.error.issues) };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(VALUE_TRANSFER_ENTRIES_TABLE)
      .insert({
        report_id: reportId,
        transfer_date: parsed.data.transfer_date,
        recipient_name: parsed.data.recipient_name,
        recipient_credential: parsed.data.recipient_credential,
        recipient_npi: parsed.data.recipient_npi ?? null,
        recipient_address: parsed.data.recipient_address ?? null,
        affiliation: parsed.data.affiliation ?? null,
        form_category: parsed.data.form_category,
        description: parsed.data.description ?? null,
        value_amount: parsed.data.value_amount,
        is_estimate: parsed.data.is_estimate ?? false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[addTransferEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to add entry." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null, entryId: (data as { id: string }).id };
  } catch (err) {
    console.error("[addTransferEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/* ── Update a transfer entry (rep only, draft only) ── */
export async function updateTransferEntry(
  _prev: IValueTransferEntryFormState | null,
  formData: FormData,
): Promise<IValueTransferEntryFormState> {
  try {
    const entryId = formData.get("entry_id") as string;
    const reportId = formData.get("report_id") as string;
    if (!entryId || !reportId)
      return { success: false, error: "Missing entry or report id." };

    await requireReportWriteAccess(reportId);

    const parsed = parseEntryForm(formData);
    if (!parsed.success) {
      return { success: false, error: null, fieldErrors: pickFieldErrors(parsed.error.issues) };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from(VALUE_TRANSFER_ENTRIES_TABLE)
      .update({
        transfer_date: parsed.data.transfer_date,
        recipient_name: parsed.data.recipient_name,
        recipient_credential: parsed.data.recipient_credential,
        recipient_npi: parsed.data.recipient_npi ?? null,
        recipient_address: parsed.data.recipient_address ?? null,
        affiliation: parsed.data.affiliation ?? null,
        form_category: parsed.data.form_category,
        description: parsed.data.description ?? null,
        value_amount: parsed.data.value_amount,
        is_estimate: parsed.data.is_estimate ?? false,
      })
      .eq("id", entryId)
      .eq("report_id", reportId);

    if (error) {
      console.error("[updateTransferEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to update entry." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null, entryId };
  } catch (err) {
    console.error("[updateTransferEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/* ── Delete a transfer entry (rep only, draft only) ── */
export async function deleteTransferEntry(
  entryId: string,
  reportId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireReportWriteAccess(reportId);

    const supabase = await createClient();
    const { error } = await supabase
      .from(VALUE_TRANSFER_ENTRIES_TABLE)
      .delete()
      .eq("id", entryId)
      .eq("report_id", reportId);

    if (error) {
      console.error("[deleteTransferEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to delete entry." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteTransferEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
