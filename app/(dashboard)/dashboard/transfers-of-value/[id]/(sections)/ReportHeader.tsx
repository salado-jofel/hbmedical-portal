"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, ShieldCheck, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import {
  MONTH_LABELS,
  TRANSFERS_OF_VALUE_PATH,
  VALUE_REPORT_STATUS_LABELS,
} from "@/utils/constants/value-transfers";
import { getReportPdfSignedUrl } from "../../(services)/actions";
import { SubmitReportModal } from "../(components)/SubmitReportModal";

const STATUS_COLORS = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reviewed: "bg-[#15689E]/10 text-[#15689E] border-[#15689E]/20",
} as const;

export function ReportHeader({ admin, canEdit }: { admin: boolean; canEdit: boolean }) {
  const report = useAppSelector((s) => s.transfersOfValue.activeReport);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const monthLabel = MONTH_LABELS[report.reportingMonth - 1] ?? "";
  const showDownload = report.status !== "draft" && !!report.pdfUrl;

  const hasFlags =
    report.flagRecipientNoReport ||
    report.flagOwnershipInquiry ||
    report.flagMischaracterize ||
    report.flagThirdParty ||
    report.flagFundingForReferrals ||
    report.flagFamilyMember ||
    report.flagOther;

  function handleDownload() {
    setDownloading(true);
    startTransition(async () => {
      const result = await getReportPdfSignedUrl(report!.id);
      setDownloading(false);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error ?? "Failed to open PDF.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Link
        href={TRANSFERS_OF_VALUE_PATH}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text3)] hover:text-[var(--navy)] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        All reports
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-[#15689E]/10 flex items-center justify-center text-[#15689E]">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-[var(--navy)]">
              {monthLabel} {report.reportingYear}
            </h1>
            <p className="text-xs text-[var(--text3)] mt-0.5">
              {admin && report.repName ? `${report.repName} · ` : ""}
              Territory: {report.territory ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded text-[11px] font-medium border ${STATUS_COLORS[report.status]}`}
          >
            {VALUE_REPORT_STATUS_LABELS[report.status]}
          </span>

          {showDownload && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
              )}
              Download PDF
            </Button>
          )}

          {canEdit && (
            <Button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
              Submit report
            </Button>
          )}
        </div>
      </div>

      {canEdit && (
        <SubmitReportModal
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          reportId={report.id}
          hasFlags={hasFlags}
        />
      )}
    </div>
  );
}
