"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Save, AlertTriangle, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateValueReportInStore } from "../../(redux)/transfers-of-value-slice";
import { updateReportComplianceFlags } from "../../(services)/report-section-actions";
import {
  COMPLIANCE_FLAGS,
  type ComplianceFlagKey,
  type ComplianceFlagNoteKey,
} from "@/utils/constants/value-transfers";
import type { IValueReport } from "@/utils/interfaces/value-transfers";

type SectionState = {
  success: boolean;
  error: string | null;
  report?: IValueReport;
};

function buildFlagsFromReport(report: IValueReport | null) {
  return COMPLIANCE_FLAGS.reduce(
    (acc, f) => {
      acc[f.key] = Boolean(report?.[reportKeyForFlag(f.key)]);
      return acc;
    },
    {} as Record<ComplianceFlagKey, boolean>,
  );
}

function buildNotesFromReport(report: IValueReport | null) {
  return COMPLIANCE_FLAGS.reduce(
    (acc, f) => {
      acc[f.noteKey] =
        ((report?.[reportKeyForNote(f.noteKey)] as string | null) ?? "");
      return acc;
    },
    {} as Record<ComplianceFlagNoteKey, string>,
  );
}

export function ComplianceFlagsTab({ canEdit }: { canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const report = useAppSelector((s) => s.transfersOfValue.activeReport);

  const [flags, setFlags] = useState<Record<ComplianceFlagKey, boolean>>(() =>
    buildFlagsFromReport(report),
  );
  const [notes, setNotes] = useState<Record<ComplianceFlagNoteKey, string>>(() =>
    buildNotesFromReport(report),
  );

  // Re-sync local state from Redux whenever the report row changes — including
  // after our own save completes (which dispatches updateValueReportInStore).
  useEffect(() => {
    if (!report) return;
    setFlags(buildFlagsFromReport(report));
    setNotes(buildNotesFromReport(report));
  }, [report]);

  const isDirty = useMemo(() => {
    if (!report) return false;
    return COMPLIANCE_FLAGS.some((f) => {
      const flagDiff = flags[f.key] !== Boolean(report[reportKeyForFlag(f.key)]);
      if (flagDiff) return true;
      // Notes are only persisted when the flag is on; treat note edits as
      // dirty only in that case so a stale hidden note doesn't enable Save.
      if (flags[f.key]) {
        const stored = (report[reportKeyForNote(f.noteKey)] as string | null) ?? "";
        if (notes[f.noteKey] !== stored) return true;
      }
      return false;
    });
  }, [flags, notes, report]);

  const [state, formAction, isPending] = useActionState<SectionState | null, FormData>(
    updateReportComplianceFlags,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success && state.report) {
      dispatch(updateValueReportInStore(state.report));
      toast.success("Compliance flags saved.");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!report) return null;

  const anyFlagged = Object.values(flags).some(Boolean);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="report_id" value={report.id} />

      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.8} />
        <p>
          Section 6 — A &quot;Yes&quot; answer requires immediate compliance escalation. Any request to
          mischaracterize a payment, to under-report, or to channel value through a third party
          is a serious anti-kickback red flag.
        </p>
      </div>

      {COMPLIANCE_FLAGS.map((f) => (
        <div key={f.key} className="bg-white border border-[#E8EFF5] rounded-lg p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name={f.key}
              checked={flags[f.key]}
              onChange={(e) =>
                setFlags((prev) => ({ ...prev, [f.key]: e.target.checked }))
              }
              disabled={!canEdit}
              className="mt-0.5 w-4 h-4 rounded border-[#E8EFF5] text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-[var(--text2)] leading-relaxed">{f.question}</span>
          </label>

          {flags[f.key] && (
            <div className="mt-2 pl-6 space-y-1.5">
              <Label htmlFor={f.noteKey} className="text-[10px] uppercase tracking-wider text-[var(--text3)]">
                Describe
              </Label>
              <Textarea
                id={f.noteKey}
                name={f.noteKey}
                value={notes[f.noteKey]}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [f.noteKey]: e.target.value }))
                }
                disabled={!canEdit}
                className="min-h-[60px] text-sm"
                maxLength={2000}
              />
            </div>
          )}
        </div>
      ))}

      {anyFlagged && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          One or more flags are set. The compliance team will be notified when the report is
          submitted. If immediate escalation is needed, contact compliance directly.
        </div>
      )}

      {canEdit && (
        <div className="pt-2 border-t border-[var(--border)] flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending || !isDirty}
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.8} />
            )}
            Save compliance flags
          </Button>
          {!isDirty && !isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
              All changes saved
            </span>
          )}
        </div>
      )}
    </form>
  );
}

/* ── helpers — map flag/note keys to IValueReport camelCase props ── */
function reportKeyForFlag(k: ComplianceFlagKey): keyof IValueReport {
  switch (k) {
    case "flag_recipient_no_report":
      return "flagRecipientNoReport";
    case "flag_ownership_inquiry":
      return "flagOwnershipInquiry";
    case "flag_mischaracterize":
      return "flagMischaracterize";
    case "flag_third_party":
      return "flagThirdParty";
    case "flag_funding_for_referrals":
      return "flagFundingForReferrals";
    case "flag_family_member":
      return "flagFamilyMember";
    case "flag_other":
      return "flagOther";
  }
}

function reportKeyForNote(k: ComplianceFlagNoteKey): keyof IValueReport {
  switch (k) {
    case "flag_recipient_no_report_note":
      return "flagRecipientNoReportNote";
    case "flag_ownership_inquiry_note":
      return "flagOwnershipInquiryNote";
    case "flag_mischaracterize_note":
      return "flagMischaracterizeNote";
    case "flag_third_party_note":
      return "flagThirdPartyNote";
    case "flag_funding_for_referrals_note":
      return "flagFundingForReferralsNote";
    case "flag_family_member_note":
      return "flagFamilyMemberNote";
    case "flag_other_note":
      return "flagOtherNote";
  }
}
