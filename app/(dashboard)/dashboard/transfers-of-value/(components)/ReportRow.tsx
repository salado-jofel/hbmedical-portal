"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2, Loader2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch } from "@/store/hooks";
import { removeValueReportFromStore } from "../(redux)/transfers-of-value-slice";
import { deleteValueReport } from "../(services)/actions";
import {
  MONTH_LABELS,
  TRANSFERS_OF_VALUE_PATH,
  VALUE_REPORT_STATUS_LABELS,
} from "@/utils/constants/value-transfers";
import type { IValueReport } from "@/utils/interfaces/value-transfers";

const STATUS_COLORS: Record<IValueReport["status"], string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reviewed: "bg-[#15689E]/10 text-[#15689E] border-[#15689E]/20",
};

export function ReportRow({ report, showRepName }: { report: IValueReport; showRepName: boolean }) {
  const dispatch = useAppDispatch();
  const [isPending, startTransition] = useTransition();

  const monthLabel = MONTH_LABELS[report.reportingMonth - 1] ?? "";
  const canDelete = report.status === "draft";

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canDelete) return;
    if (!confirm(`Delete the ${monthLabel} ${report.reportingYear} draft? This cannot be undone.`))
      return;

    startTransition(async () => {
      const result = await deleteValueReport(report.id);
      if (result.success) {
        dispatch(removeValueReportFromStore(report.id));
        toast.success("Draft deleted.");
      } else {
        toast.error(result.error ?? "Failed to delete.");
      }
    });
  }

  return (
    <Link
      href={`${TRANSFERS_OF_VALUE_PATH}/${report.id}`}
      className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-white border border-[#E8EFF5] rounded-lg hover:border-[#15689E]/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#15689E]/10 flex items-center justify-center text-[#15689E]">
          <FileText className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">
            {monthLabel} {report.reportingYear}
          </p>
          {showRepName && (
            <p className="text-xs text-[var(--text3)]">{report.repName ?? "—"}</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center gap-3 sm:gap-6 text-xs text-[var(--text3)]">
        <span>
          Territory: <span className="text-[var(--text2)]">{report.territory ?? "—"}</span>
        </span>
        {report.submittedAt && (
          <span className="hidden sm:inline">
            Submitted: {new Date(report.submittedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[report.status]}`}
        >
          {VALUE_REPORT_STATUS_LABELS[report.status]}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Delete draft"
            className="p-1.5 rounded text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>
    </Link>
  );
}
