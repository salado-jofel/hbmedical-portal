"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SpecimenSignaturePad,
  type SpecimenSignaturePadHandle,
} from "@/app/(components)/SpecimenSignaturePad";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateValueReportInStore } from "../../(redux)/transfers-of-value-slice";
import { submitValueReport } from "../../(services)/submit-actions";
import type { ISubmitReportResult } from "@/utils/interfaces/value-transfers";
import { CERTIFICATIONS } from "@/utils/constants/value-transfers";

export function SubmitReportModal({
  open,
  onClose,
  reportId,
  hasFlags,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
  hasFlags: boolean;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const profile = useAppSelector((s) => s.dashboard);
  const defaultName =
    profile?.name && profile.name !== "Pending Setup" ? profile.name : "";

  const [checked, setChecked] = useState<boolean[]>(
    Array(CERTIFICATIONS.length).fill(false),
  );
  const [certifiedName, setCertifiedName] = useState(defaultName);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const padRef = useRef<SpecimenSignaturePadHandle | null>(null);

  const allChecked = checked.every(Boolean);
  const canSubmit = allChecked && certifiedName.trim().length > 0 && !!signatureUrl;

  const [state, formAction, isPending] = useActionState<
    ISubmitReportResult | null,
    FormData
  >(submitValueReport, null);

  useEffect(() => {
    if (!state) return;
    if (state.success && state.report) {
      dispatch(updateValueReportInStore(state.report));
      toast.success("Report submitted. PDF sent to compliance.");
      onClose();
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function captureSignature() {
    const url = padRef.current?.getDataUrl() ?? null;
    setSignatureUrl(url);
  }

  function toggle(idx: number, value: boolean) {
    setChecked((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl sm:rounded-2xl max-h-[calc(100vh-2rem)] overflow-auto">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <ShieldCheck className="w-4 h-4 text-[var(--navy)]" />
            Submit monthly report
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="report_id" value={reportId} />
          <input
            type="hidden"
            name="certified_signature_url"
            value={signatureUrl ?? ""}
          />

          <p className="text-xs text-[var(--text3)]">
            Submission is final. Once submitted, the report becomes read-only and a
            certified PDF is emailed to compliance. Review carefully before submitting.
          </p>

          {hasFlags && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.8} />
              <p>
                One or more compliance flags are set. The compliance team will
                see the flagged items highlighted in the email.
              </p>
            </div>
          )}

          {/* ── Certifications ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--navy)] uppercase tracking-wider">
              Section 7 — Representative Certification
            </p>
            {CERTIFICATIONS.map((c, idx) => (
              <label
                key={idx}
                className="flex items-start gap-2.5 p-2.5 bg-[#FAFBFC] border border-[#E8EFF5] rounded cursor-pointer hover:bg-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked[idx]}
                  onChange={(e) => toggle(idx, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#E8EFF5] text-[#15689E] focus:ring-[#15689E]"
                />
                <span className="text-xs text-[var(--text2)] leading-relaxed">
                  <span className="font-semibold">{idx + 1}.</span> {c}
                </span>
              </label>
            ))}
          </div>

          {/* ── Printed name ── */}
          <div className="space-y-1.5">
            <Label htmlFor="certified_name" className="text-xs">
              Representative name (printed) <span className="text-red-400">*</span>
            </Label>
            <Input
              id="certified_name"
              name="certified_name"
              value={certifiedName}
              onChange={(e) => setCertifiedName(e.target.value)}
              className="h-9 text-sm"
              maxLength={240}
              required
            />
          </div>

          {/* ── Signature ── */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Signature <span className="text-red-400">*</span>
            </Label>
            <SpecimenSignaturePad
              ref={padRef}
              defaultName={certifiedName}
              padHeightClass="h-28"
              onDirtyChange={() => captureSignature()}
            />
            <button
              type="button"
              onClick={captureSignature}
              className="text-xs text-[#15689E] hover:underline"
            >
              Capture current signature
            </button>
            {signatureUrl && (
              <p className="text-[11px] text-emerald-600">
                Signature captured · click submit to finalize.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Certify & submit"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
