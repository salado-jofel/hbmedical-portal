"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TRANSFERS_OF_VALUE_PATH,
  VALUE_REPORTS_TABLE,
  CONSULTING_STATUSES,
  COMPLIANCE_FLAGS,
} from "@/utils/constants/value-transfers";
import {
  mapValueReport,
  type IValueReport,
} from "@/utils/interfaces/value-transfers";
import { requireReportWriteAccess } from "./_shared";

type SectionUpdateState = {
  success: boolean;
  error: string | null;
  report?: IValueReport;
};

/* ── Section 5 — consulting / honoraria ── */
export async function updateReportConsulting(
  _prev: SectionUpdateState | null,
  formData: FormData,
): Promise<SectionUpdateState> {
  try {
    const reportId = formData.get("report_id") as string;
    if (!reportId) return { success: false, error: "Missing report id." };
    await requireReportWriteAccess(reportId);

    const proposed = formData.get("consulting_proposed") === "on";
    const recipient = (formData.get("consulting_recipient") as string | null) || null;
    const topic = (formData.get("consulting_topic") as string | null) || null;
    const statusRaw = (formData.get("consulting_status") as string | null) || null;
    const status =
      statusRaw && (CONSULTING_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw
        : null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .update({
        consulting_proposed: proposed,
        consulting_recipient: proposed ? recipient : null,
        consulting_topic: proposed ? topic : null,
        consulting_status: proposed ? status : null,
      })
      .eq("id", reportId)
      .select(
        `*, rep:profiles!sales_rep_value_reports_rep_id_fkey(id, first_name, last_name, email)`,
      )
      .single();

    if (error) {
      console.error("[updateReportConsulting] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return {
      success: true,
      error: null,
      report: mapValueReport(
        data as Record<string, unknown> & {
          id: string;
          rep_id: string;
          reporting_year: number;
          reporting_month: number;
          status: string;
          created_at: string;
          updated_at: string;
        },
      ),
    };
  } catch (err) {
    console.error("[updateReportConsulting] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/* ── Section 6 — seven compliance flags ── */
export async function updateReportComplianceFlags(
  _prev: SectionUpdateState | null,
  formData: FormData,
): Promise<SectionUpdateState> {
  try {
    const reportId = formData.get("report_id") as string;
    if (!reportId) return { success: false, error: "Missing report id." };
    await requireReportWriteAccess(reportId);

    const patch: Record<string, boolean | string | null> = {};
    for (const flag of COMPLIANCE_FLAGS) {
      const checked = formData.get(flag.key) === "on";
      const note = (formData.get(flag.noteKey) as string | null) || null;
      patch[flag.key] = checked;
      patch[flag.noteKey] = checked ? note : null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(VALUE_REPORTS_TABLE)
      .update(patch)
      .eq("id", reportId)
      .select(
        `*, rep:profiles!sales_rep_value_reports_rep_id_fkey(id, first_name, last_name, email)`,
      )
      .single();

    if (error) {
      console.error("[updateReportComplianceFlags] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to save." };
    }

    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);
    return {
      success: true,
      error: null,
      report: mapValueReport(
        data as Record<string, unknown> & {
          id: string;
          rep_id: string;
          reporting_year: number;
          reporting_month: number;
          status: string;
          created_at: string;
          updated_at: string;
        },
      ),
    };
  } catch (err) {
    console.error("[updateReportComplianceFlags] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
