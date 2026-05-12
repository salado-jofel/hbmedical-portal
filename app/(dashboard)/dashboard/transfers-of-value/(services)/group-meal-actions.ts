"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import {
  TRANSFERS_OF_VALUE_PATH,
  VALUE_GROUP_MEAL_ENTRIES_TABLE,
} from "@/utils/constants/value-transfers";
import {
  valueGroupMealEntrySchema,
  mapValueGroupMealEntry,
  type IValueGroupMealEntry,
  type IValueGroupMealEntryFormState,
} from "@/utils/interfaces/value-transfers";
import { getReportAccess, requireReportWriteAccess } from "./_shared";

export async function getGroupMealEntries(reportId: string): Promise<IValueGroupMealEntry[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const access = await getReportAccess(reportId);
  if (!access) return [];

  const role = await getUserRole(supabase);
  const client = isAdmin(role) ? createAdminClient() : supabase;

  const { data, error } = await client
    .from(VALUE_GROUP_MEAL_ENTRIES_TABLE)
    .select("*")
    .eq("report_id", reportId)
    .order("group_meal_date", { ascending: false });

  if (error) {
    console.error("[getGroupMealEntries] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to load group meals.");
  }
  return (data ?? []).map((r) => mapValueGroupMealEntry(r as Record<string, unknown>));
}

function pickFieldErrors(
  issues: ZodError["issues"],
): IValueGroupMealEntryFormState["fieldErrors"] {
  const fieldErrors: IValueGroupMealEntryFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof NonNullable<
      IValueGroupMealEntryFormState["fieldErrors"]
    >;
    fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function parseForm(formData: FormData) {
  const recipientsRaw = (formData.get("covered_recipients") as string | null) ?? "[]";
  let parsedRecipients: unknown = [];
  try {
    parsedRecipients = JSON.parse(recipientsRaw);
  } catch {
    parsedRecipients = [];
  }

  const raw = {
    group_meal_date: formData.get("group_meal_date") as string,
    total_cost: formData.get("total_cost") as string,
    total_attendees: formData.get("total_attendees") as string,
    covered_recipients: parsedRecipients,
    notes: (formData.get("notes") as string | null) || null,
  };
  return valueGroupMealEntrySchema.safeParse(raw);
}

export async function addGroupMealEntry(
  _prev: IValueGroupMealEntryFormState | null,
  formData: FormData,
): Promise<IValueGroupMealEntryFormState> {
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
      .from(VALUE_GROUP_MEAL_ENTRIES_TABLE)
      .insert({
        report_id: reportId,
        group_meal_date: parsed.data.group_meal_date,
        total_cost: parsed.data.total_cost,
        total_attendees: parsed.data.total_attendees,
        covered_recipients: parsed.data.covered_recipients,
        notes: parsed.data.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[addGroupMealEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to add group meal." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null, entryId: (data as { id: string }).id };
  } catch (err) {
    console.error("[addGroupMealEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

export async function deleteGroupMealEntry(
  entryId: string,
  reportId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await requireReportWriteAccess(reportId);
    const supabase = await createClient();
    const { error } = await supabase
      .from(VALUE_GROUP_MEAL_ENTRIES_TABLE)
      .delete()
      .eq("id", entryId)
      .eq("report_id", reportId);

    if (error) {
      console.error("[deleteGroupMealEntry] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to delete." };
    }
    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteGroupMealEntry] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
