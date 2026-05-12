"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserOrThrow,
  getUserRole,
} from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import {
  VALUE_REPORTS_TABLE,
  TRANSFERS_OF_VALUE_PATH,
} from "@/utils/constants/value-transfers";
import { STORAGE_BUCKETS } from "@/utils/constants/storage";
import { getReportAccess } from "./_shared";
import {
  createValueReportSchema,
  mapValueReport,
  type IValueReport,
  type IValueReportFormState,
} from "@/utils/interfaces/value-transfers";

/* ── SELECT shape — report row + the rep profile for display ── */
const REPORT_SELECT = `
  *,
  rep:profiles!sales_rep_value_reports_rep_id_fkey(id, first_name, last_name, email)
`;

/* ── Read: list reports the current user is allowed to see ──
 *   sales_representative → own reports only (repId param ignored)
 *   admin               → all reports, optionally filtered to a single rep
 */
export async function getMyValueReports(
  repIdFilter?: string | null,
): Promise<IValueReport[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isSalesRep(role) && !isAdmin(role)) {
    return [];
  }

  const admin = isAdmin(role);
  const client = admin ? createAdminClient() : supabase;

  let query = client
    .from(VALUE_REPORTS_TABLE)
    .select(REPORT_SELECT)
    .order("reporting_year", { ascending: false })
    .order("reporting_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (admin) {
    if (repIdFilter) query = query.eq("rep_id", repIdFilter);
  } else {
    query = query.eq("rep_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getMyValueReports] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to load reports.");
  }

  return (data ?? []).map((row) => mapValueReport(row as Record<string, unknown> & {
    id: string;
    rep_id: string;
    reporting_year: number;
    reporting_month: number;
    status: string;
    created_at: string;
    updated_at: string;
  }));
}

/* ── Read: a single report by id (scoped). Used by the detail page. ── */
export async function getValueReport(reportId: string): Promise<IValueReport | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isSalesRep(role) && !isAdmin(role)) return null;

  const admin = isAdmin(role);
  const client = admin ? createAdminClient() : supabase;

  let query = client
    .from(VALUE_REPORTS_TABLE)
    .select(REPORT_SELECT)
    .eq("id", reportId);

  if (!admin) query = query.eq("rep_id", user.id);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getValueReport] Error:", JSON.stringify(error));
    throw new Error(error.message ?? "Failed to load report.");
  }
  if (!data) return null;

  return mapValueReport(data as Record<string, unknown> & {
    id: string;
    rep_id: string;
    reporting_year: number;
    reporting_month: number;
    status: string;
    created_at: string;
    updated_at: string;
  });
}

/* ── Create: rep opens a new monthly draft report ── */
export async function createValueReport(
  _prev: IValueReportFormState | null,
  formData: FormData,
): Promise<IValueReportFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isSalesRep(role)) {
      return { success: false, error: "Only sales reps can create reports." };
    }

    const raw = {
      reporting_year: formData.get("reporting_year") as string,
      reporting_month: formData.get("reporting_month") as string,
      territory: (formData.get("territory") as string | null) || null,
    };

    const parsed = createValueReportSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: IValueReportFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<
          IValueReportFormState["fieldErrors"]
        >;
        fieldErrors[field] = issue.message;
      }
      return { success: false, error: null, fieldErrors };
    }

    const { reporting_year, reporting_month, territory } = parsed.data;

    // Refuse duplicate (rep_id, year, month) — give a clean inline error
    // before the DB throws a unique-constraint violation.
    const { data: existing } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .select("id")
      .eq("rep_id", user.id)
      .eq("reporting_year", reporting_year)
      .eq("reporting_month", reporting_month)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "A report already exists for that month — open it from the list.",
      };
    }

    const { data, error } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .insert({
        rep_id: user.id,
        reporting_year,
        reporting_month,
        territory: territory ?? null,
        status: "draft",
      })
      .select(REPORT_SELECT)
      .single();

    if (error) {
      console.error("[createValueReport] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to create report." };
    }

    revalidatePath(TRANSFERS_OF_VALUE_PATH);

    return {
      success: true,
      error: null,
      reportId: (data as { id: string }).id,
    };
  } catch (err) {
    console.error("[createValueReport] Unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* ── Signed URL for the submitted PDF (rep + admin) ── */
export async function getReportPdfSignedUrl(reportId: string): Promise<{
  url: string | null;
  error: string | null;
}> {
  try {
    const access = await getReportAccess(reportId);
    if (!access) return { url: null, error: "Report not found." };

    const adminClient = createAdminClient();
    const { data: row, error: rowError } = await adminClient
      .from(VALUE_REPORTS_TABLE)
      .select("pdf_url, status")
      .eq("id", reportId)
      .maybeSingle();

    if (rowError || !row?.pdf_url) {
      return { url: null, error: "No PDF available — report has not been submitted." };
    }

    const { data: signed, error: signError } = await adminClient.storage
      .from(STORAGE_BUCKETS.private)
      .createSignedUrl(row.pdf_url as string, 60 * 5);

    if (signError || !signed?.signedUrl) {
      console.error("[getReportPdfSignedUrl] Sign error:", JSON.stringify(signError));
      return { url: null, error: "Failed to generate download link." };
    }

    return { url: signed.signedUrl, error: null };
  } catch (err) {
    console.error("[getReportPdfSignedUrl] Unexpected:", err);
    return {
      url: null,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/* ── Delete: rep removes their own draft only ── */
export async function deleteValueReport(reportId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    const { data: existing, error: readError } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .select("id, rep_id, status")
      .eq("id", reportId)
      .maybeSingle();

    if (readError) {
      console.error("[deleteValueReport] Read error:", JSON.stringify(readError));
      return { success: false, error: "Failed to load report." };
    }
    if (!existing) return { success: false, error: "Report not found." };
    if (existing.rep_id !== user.id)
      return { success: false, error: "You can only delete your own reports." };
    if (existing.status !== "draft")
      return { success: false, error: "Only drafts can be deleted." };

    const { error } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .delete()
      .eq("id", reportId);

    if (error) {
      console.error("[deleteValueReport] Delete error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to delete." };
    }

    revalidatePath(TRANSFERS_OF_VALUE_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteValueReport] Unexpected:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
