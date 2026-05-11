"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import {
  TRANSFERS_OF_VALUE_PATH,
  VALUE_SAMPLE_ENTRIES_TABLE,
} from "@/utils/constants/value-transfers";
import {
  valueSampleEntrySchema,
  mapValueSampleEntry,
  type IValueSampleEntry,
  type IValueSampleEntryFormState,
} from "@/utils/interfaces/value-transfers";
import { getReportAccess, requireReportWriteAccess } from "./_shared";

export async function getSampleEntries(reportId: string): Promise<IValueSampleEntry[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const access = await getReportAccess(reportId);
  if (!access) return [];

  const role = await getUserRole(supabase);
  const client = isAdmin(role) ? createAdminClient() : supabase;

  const { data, error } = await client
    .from(VALUE_SAMPLE_ENTRIES_TABLE)
    .select("*")
    .eq("report_id", reportId)
    .order("sample_date", { ascending: false });

  if (error) {
    console.error("[getSampleEntries] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to load samples.");
  }
  return (data ?? []).map((r) => mapValueSampleEntry(r as Record<string, unknown>));
}

function pickFieldErrors(
  issues: ZodError["issues"],
): IValueSampleEntryFormState["fieldErrors"] {
  const fieldErrors: IValueSampleEntryFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof NonNullable<
      IValueSampleEntryFormState["fieldErrors"]
    >;
    fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function parseForm(formData: FormData) {
  const raw = {
    sample_date: formData.get("sample_date") as string,
    recipient_facility: formData.get("recipient_facility") as string,
    product_lot: formData.get("product_lot") as string,
    quantity: formData.get("quantity") as string,
    purpose: (formData.get("purpose") as string | null) || null,
    return_date: (formData.get("return_date") as string | null) || null,
  };
  return valueSampleEntrySchema.safeParse(raw);
}

export async function addSampleEntry(
  _prev: IValueSampleEntryFormState | null,
  formData: FormData,
): Promise<IValueSampleEntryFormState> {
  try {
    const reportId = formData.get("report_id") as string;
    if (!reportId) return { success: false, error: "Missing report id." };

    await requireReportWriteAccess(reportId);

    const parsed = parseForm(formData);
    if (!parsed.success) {
      return { success: false, error: null, fieldErrors: pickFieldErrors(parsed.error.issues) };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(VALUE_SAMPLE_ENTRIES_TABLE)
      .insert({
        report_id: reportId,
        sample_date: parsed.data.sample_date,
        recipient_facility: parsed.data.recipient_facility,
        product_lot: parsed.data.product_lot,
        quantity: parsed.data.quantity,
        purpose: parsed.data.purpose ?? null,
        return_date: parsed.data.return_date ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[addSampleEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to add sample." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null, entryId: (data as { id: string }).id };
  } catch (err) {
    console.error("[addSampleEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

export async function deleteSampleEntry(
  entryId: string,
  reportId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireReportWriteAccess(reportId);
    const supabase = await createClient();
    const { error } = await supabase
      .from(VALUE_SAMPLE_ENTRIES_TABLE)
      .delete()
      .eq("id", entryId)
      .eq("report_id", reportId);

    if (error) {
      console.error("[deleteSampleEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to delete." };
    }
    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteSampleEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
