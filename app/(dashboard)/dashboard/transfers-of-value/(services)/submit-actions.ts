"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendValueTransferReportEmail } from "@/lib/emails/send-value-transfer-report";
import { TransferOfValuePDF } from "@/lib/pdf/transfer-of-value-pdf";
import {
  STORAGE_BUCKETS,
  STORAGE_FOLDERS,
} from "@/utils/constants/storage";
import {
  TRANSFERS_OF_VALUE_PATH,
  VALUE_REPORTS_SUBMIT_TO_EMAIL,
  VALUE_REPORTS_TABLE,
  VALUE_TRANSFER_ENTRIES_TABLE,
  VALUE_GROUP_MEAL_ENTRIES_TABLE,
  VALUE_SAMPLE_ENTRIES_TABLE,
  MONTH_LABELS,
} from "@/utils/constants/value-transfers";
import {
  mapValueReport,
  mapValueTransferEntry,
  mapValueGroupMealEntry,
  mapValueSampleEntry,
  submitReportSchema,
  summarizeValueReport,
  type IValueReport,
  type ISubmitReportFormState,
  type ISubmitReportResult,
} from "@/utils/interfaces/value-transfers";
import { requireReportWriteAccess } from "./_shared";

const REPORT_SELECT_WITH_REP = `
  *,
  rep:profiles!sales_rep_value_reports_rep_id_fkey(id, first_name, last_name, email)
`;

export async function submitValueReport(
  _prev: ISubmitReportResult | null,
  formData: FormData,
): Promise<ISubmitReportResult> {
  try {
    const reportId = formData.get("report_id") as string;
    if (!reportId) return { success: false, error: "Missing report id." };

    const access = await requireReportWriteAccess(reportId);

    /* ── Validate cert inputs ── */
    const raw = {
      certified_name: formData.get("certified_name") as string,
      certified_signature_url: formData.get("certified_signature_url") as string,
    };
    const parsed = submitReportSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: ISubmitReportFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<
          ISubmitReportFormState["fieldErrors"]
        >;
        fieldErrors[field] = issue.message;
      }
      return { success: false, error: null, fieldErrors };
    }

    /* ── Load the full report + children for the PDF + email ── */
    const adminClient = createAdminClient();
    const [reportRes, transfersRes, groupMealsRes, samplesRes] = await Promise.all([
      adminClient
        .from(VALUE_REPORTS_TABLE)
        .select(REPORT_SELECT_WITH_REP)
        .eq("id", reportId)
        .single(),
      adminClient
        .from(VALUE_TRANSFER_ENTRIES_TABLE)
        .select("*")
        .eq("report_id", reportId)
        .order("transfer_date", { ascending: false }),
      adminClient
        .from(VALUE_GROUP_MEAL_ENTRIES_TABLE)
        .select("*")
        .eq("report_id", reportId)
        .order("group_meal_date", { ascending: false }),
      adminClient
        .from(VALUE_SAMPLE_ENTRIES_TABLE)
        .select("*")
        .eq("report_id", reportId)
        .order("sample_date", { ascending: false }),
    ]);

    if (reportRes.error || !reportRes.data) {
      console.error("[submitValueReport] Failed to load report:", reportRes.error);
      return { success: false, error: "Failed to load report data." };
    }

    const draftReport = mapValueReport(
      reportRes.data as Record<string, unknown> & {
        id: string;
        rep_id: string;
        reporting_year: number;
        reporting_month: number;
        status: string;
        created_at: string;
        updated_at: string;
      },
    );
    const transfers = (transfersRes.data ?? []).map((r) =>
      mapValueTransferEntry(r as Record<string, unknown>),
    );
    const groupMeals = (groupMealsRes.data ?? []).map((r) =>
      mapValueGroupMealEntry(r as Record<string, unknown>),
    );
    const samples = (samplesRes.data ?? []).map((r) =>
      mapValueSampleEntry(r as Record<string, unknown>),
    );

    /* ── Stamp the submit fields in-memory; PDF reflects the signed state. ── */
    const submittedAt = new Date().toISOString();
    const signedReport: IValueReport = {
      ...draftReport,
      certifiedName: parsed.data.certified_name,
      certifiedSignatureUrl: parsed.data.certified_signature_url,
      certifiedAt: submittedAt,
      submittedAt,
      status: "submitted",
    };

    const repProfile = (reportRes.data as { rep?: { first_name?: string | null; last_name?: string | null; email?: string | null } }).rep;
    const repName =
      `${repProfile?.first_name ?? ""} ${repProfile?.last_name ?? ""}`.trim() ||
      parsed.data.certified_name;
    const repEmail = repProfile?.email ?? "";

    /* ── Render PDF buffer ── */
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderToBuffer(
        TransferOfValuePDF({
          report: signedReport,
          transfers,
          groupMeals,
          samples,
          repName,
          repEmail,
        }),
      );
    } catch (err) {
      console.error("[submitValueReport] PDF render failed:", err);
      return { success: false, error: "Failed to render report PDF." };
    }

    /* ── Upload to private storage ── */
    const monthLabel = MONTH_LABELS[signedReport.reportingMonth - 1] ?? "month";
    const pdfFileName = `${repName.replace(/[^a-zA-Z0-9-_ ]/g, "")} - ${monthLabel} ${signedReport.reportingYear}.pdf`;
    const storagePath = `${STORAGE_FOLDERS.transfersOfValue}/${access.repId}/${signedReport.reportingYear}-${String(signedReport.reportingMonth).padStart(2, "0")}-${reportId}.pdf`;

    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKETS.private)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[submitValueReport] Upload failed:", JSON.stringify(uploadError));
      return { success: false, error: "Failed to save report PDF." };
    }

    /* ── Persist the submitted state ── */
    const { data: updated, error: updateError } = await adminClient
      .from(VALUE_REPORTS_TABLE)
      .update({
        status: "submitted",
        certified_name: parsed.data.certified_name,
        certified_signature_url: parsed.data.certified_signature_url,
        certified_at: submittedAt,
        submitted_at: submittedAt,
        pdf_url: storagePath,
      })
      .eq("id", reportId)
      .select(REPORT_SELECT_WITH_REP)
      .single();

    if (updateError || !updated) {
      console.error("[submitValueReport] DB update failed:", updateError);
      return { success: false, error: "Failed to mark report submitted." };
    }

    const finalReport = mapValueReport(
      updated as Record<string, unknown> & {
        id: string;
        rep_id: string;
        reporting_year: number;
        reporting_month: number;
        status: string;
        created_at: string;
        updated_at: string;
      },
    );

    /* ── Send email — non-blocking; submission still succeeds if email fails. ── */
    try {
      const summary = summarizeValueReport(finalReport, transfers, groupMeals);
      await sendValueTransferReportEmail({
        to: VALUE_REPORTS_SUBMIT_TO_EMAIL,
        report: finalReport,
        repName,
        repEmail,
        totalTransfers: summary.totalTransfers,
        distinctRecipients: summary.distinctRecipients,
        totalValueUsd: summary.totalValueUsd,
        pdfBuffer,
        pdfFileName,
      });
    } catch (err) {
      console.error("[submitValueReport] Email send failed:", err);
      // Continue — DB record + PDF are authoritative.
    }

    revalidatePath(TRANSFERS_OF_VALUE_PATH);
    revalidatePath(`${TRANSFERS_OF_VALUE_PATH}/${reportId}`);

    return { success: true, error: null, report: finalReport };
  } catch (err) {
    console.error("[submitValueReport] Unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
