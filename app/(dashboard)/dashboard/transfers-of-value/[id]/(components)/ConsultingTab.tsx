"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateValueReportInStore } from "../../(redux)/transfers-of-value-slice";
import { updateReportConsulting } from "../../(services)/report-section-actions";
import {
  CONSULTING_STATUSES,
  CONSULTING_STATUS_LABELS,
  type ConsultingStatus,
} from "@/utils/constants/value-transfers";

type SectionState = {
  success: boolean;
  error: string | null;
  report?: import("@/utils/interfaces/value-transfers").IValueReport;
};

export function ConsultingTab({ canEdit }: { canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const report = useAppSelector((s) => s.transfersOfValue.activeReport);

  const [proposed, setProposed] = useState(report?.consultingProposed ?? false);
  const [recipient, setRecipient] = useState(report?.consultingRecipient ?? "");
  const [topic, setTopic] = useState(report?.consultingTopic ?? "");
  const [status, setStatus] = useState<ConsultingStatus | "">(
    report?.consultingStatus ?? "",
  );

  // Re-sync local state whenever the report row changes — covers the post-save
  // case where Redux gets the new server-stamped values.
  useEffect(() => {
    if (!report) return;
    setProposed(report.consultingProposed);
    setRecipient(report.consultingRecipient ?? "");
    setTopic(report.consultingTopic ?? "");
    setStatus(report.consultingStatus ?? "");
  }, [report]);

  const isDirty = useMemo(() => {
    if (!report) return false;
    if (proposed !== report.consultingProposed) return true;
    // When `proposed` is off the other three are wiped server-side, so they
    // shouldn't count as dirty regardless of what's in the inputs.
    if (!proposed) return false;
    return (
      recipient !== (report.consultingRecipient ?? "") ||
      topic !== (report.consultingTopic ?? "") ||
      status !== (report.consultingStatus ?? "")
    );
  }, [proposed, recipient, topic, status, report]);

  const [state, formAction, isPending] = useActionState<SectionState | null, FormData>(
    updateReportConsulting,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success && state.report) {
      dispatch(updateValueReportInStore(state.report));
      toast.success("Consulting section saved.");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!report) return null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="report_id" value={report.id} />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        <p className="font-semibold mb-1">Section 5 — Consulting / Honoraria</p>
        <p>
          Any consulting fee, honorarium, or speaker payment to a Covered Recipient must be
          made under a written agreement with HB Medical. The Representative shall NOT make
          any such payment directly. If a Covered Recipient should be engaged, flag it here
          BEFORE any service is performed or payment discussed.
        </p>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="consulting_proposed"
          checked={proposed}
          onChange={(e) => setProposed(e.target.checked)}
          disabled={!canEdit}
          className="mt-0.5 w-4 h-4 rounded border-[#E8EFF5] text-[#15689E] focus:ring-[#15689E]"
        />
        <span className="text-sm text-[var(--text2)]">
          A consulting / honorarium / speaker engagement was proposed this month.
        </span>
      </label>

      {proposed && (
        <div className="space-y-3 pl-6 border-l-2 border-[#15689E]/20">
          <div className="space-y-1.5">
            <Label htmlFor="consulting_recipient" className="text-xs">
              Covered Recipient
            </Label>
            <Input
              id="consulting_recipient"
              name="consulting_recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={!canEdit}
              className="h-9 text-sm"
              maxLength={240}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consulting_topic" className="text-xs">
              Topic / scope of proposed engagement
            </Label>
            <Textarea
              id="consulting_topic"
              name="consulting_topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!canEdit}
              className="min-h-[60px] text-sm"
              maxLength={1000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consulting_status" className="text-xs">
              Status
            </Label>
            <input
              type="hidden"
              name="consulting_status"
              value={status}
            />
            <Select
              value={status || undefined}
              onValueChange={(v) => setStatus(v as ConsultingStatus)}
              disabled={!canEdit}
            >
              <SelectTrigger id="consulting_status" className="h-9 text-sm">
                <SelectValue placeholder="Pick one…" />
              </SelectTrigger>
              <SelectContent>
                {CONSULTING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CONSULTING_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            Save consulting section
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
