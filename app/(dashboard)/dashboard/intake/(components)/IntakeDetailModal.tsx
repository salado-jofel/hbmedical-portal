"use client";

import { useEffect, useState, useTransition } from "react";
// Raw Radix primitives — the shared shadcn DialogContent bakes in
// `sm:max-w-sm` via a media query that className cannot override
// (tailwind-merge only handles same-variant conflicts). Same pattern
// OrderDetailModal uses for the same reason. Sizing lives on the
// inner <div> instead so we own it 100%.
import { Dialog as RadixDialog } from "radix-ui";
import {
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Loader2,
  ArrowRight,
  Trash2,
  Phone,
  Clock,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateIntakeInStore } from "../(redux)/intake-slice";
import { getIntakeSignedUrl, dismissIntake } from "../(services)/actions";
import { INTAKE_STATUS_LABELS } from "@/utils/interfaces/intake";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { ConfirmModal } from "@/app/(dashboard)/(components)/ConfirmModal";
import { CreateOrderModal } from "../../orders/(components)/CreateOrderModal";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface IntakeDetailModalProps {
  intakeId: string | null;
  onClose: () => void;
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

/**
 * Detail modal for a single intake fax. Left side: PDF preview via
 * signed URL. Right side: metadata + two action buttons —
 *   - Build Order: opens the Create Order modal with THIS fax as the
 *                  facesheet doc. Marked converted_order on save.
 *   - Dismiss:     confirm modal → mark dismissed with a short reason
 *                  (spam / duplicate / not usable). Audit trail keeps it.
 *
 * All three actions are gated on `status === "pending"` — once a fax has
 * been triaged the buttons hide and only the read-only outcome shows.
 */
export function IntakeDetailModal({
  intakeId,
  onClose,
  facilities,
}: IntakeDetailModalProps) {
  // `approvers` is accepted in the type (kept so IntakeList doesn't need
  // a cascading refactor) but no longer read here since the Build-IVR
  // handoff was removed. `facilities` IS used — it's forwarded into
  // CreateOrderModal so the triager can pick which clinic the fax
  // belongs to (admin/support have no facility of their own so the
  // order's facility_id has to be chosen explicitly).
  const dispatch = useAppDispatch();
  const intake = useAppSelector((s) =>
    intakeId ? (s.intake.items.find((i) => i.id === intakeId) ?? null) : null,
  );
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);

  useEffect(() => {
    if (!intake) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    getIntakeSignedUrl(intake.filePath).then((res) => {
      if (!cancelled) setSignedUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [intake]);

  function doDismiss() {
    if (!intake) return;
    if (!dismissReason.trim()) {
      toast.error("Please give a short reason (spam / duplicate / other).");
      return;
    }
    startTransition(async () => {
      const res = await dismissIntake({
        intakeId: intake.id,
        reason: dismissReason,
      });
      if (!res.success || !res.intake) {
        toast.error(res.error ?? "Failed to dismiss.");
        return;
      }
      dispatch(updateIntakeInStore(res.intake));
      toast.success("Intake dismissed.");
      setConfirmDismiss(false);
      setDismissReason("");
      onClose();
    });
  }

  const isPending = intake?.status === "pending";

  return (
    <RadixDialog.Root
      open={!!intakeId}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogPortal>
        <DialogOverlay />
        <RadixDialog.Content
          aria-describedby={undefined}
          // Full-viewport transparent centering shell — no sizing on
          // this element; the inner div owns width/height so nothing
          // from shadcn's default DialogContent gets in the way.
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
        >
          <DialogTitle className="sr-only">Intake Fax</DialogTitle>

          {/* Sizing lives here on a plain div — no shadcn media queries
              to fight. On desktop this hits the 1400px cap; on smaller
              screens it stays at 95vw. */}
          <div className="bg-white w-[95vw] max-w-[1400px] h-[92vh] max-h-[calc(100vh-2rem)] rounded-[14px] shadow-xl border border-[var(--border)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-[#eee] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">Intake Fax</h2>
                {intake && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                      intake.status === "pending" &&
                        "bg-amber-50 text-amber-700 border-amber-200",
                      intake.status === "converted_ivr" &&
                        "bg-green-50 text-green-700 border-green-200",
                      intake.status === "converted_order" &&
                        "bg-blue-50 text-blue-700 border-blue-200",
                      intake.status === "dismissed" &&
                        "bg-gray-100 text-gray-600 border-gray-200",
                    )}
                  >
                    {INTAKE_STATUS_LABELS[intake.status]}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-[7px] hover:bg-[var(--bg)] transition-colors flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[var(--text2)]" />
              </button>
            </div>

        {!intake ? (
          <div className="flex-1 flex items-center justify-center text-[var(--text3)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] flex-1 min-h-0">
            {/* PDF preview — takes ~75% of the width, fills height */}
            <div className="border-b md:border-b-0 md:border-r border-[#eee] bg-[#f9fafb] min-h-[400px] md:min-h-0">
              {signedUrl ? (
                <iframe
                  src={signedUrl}
                  title={intake.fileName ?? "Fax"}
                  className="w-full h-full min-h-[500px] md:min-h-0"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text3)]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading preview…
                </div>
              )}
            </div>

            {/* Metadata + actions sidebar — fixed 360px on desktop */}
            <div className="p-5 space-y-4 overflow-y-auto min-h-0">
              <div className="space-y-2 text-[12.5px]">
                <MetaRow
                  icon={<Phone className="w-3.5 h-3.5" />}
                  label="From"
                  value={intake.fromNumber ?? "Unknown"}
                />
                <MetaRow
                  icon={<FileText className="w-3.5 h-3.5" />}
                  label="File"
                  value={intake.fileName ?? "fax.pdf"}
                />
                <MetaRow
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Received"
                  value={new Date(intake.receivedAt).toLocaleString()}
                />
                {intake.pageCount != null && (
                  <MetaRow
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Pages"
                    value={String(intake.pageCount)}
                  />
                )}
                {intake.fileSize != null && (
                  <MetaRow
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Size"
                    value={`${(intake.fileSize / 1024).toFixed(0)} KB`}
                  />
                )}
              </div>

              {intake.status === "dismissed" && intake.dismissReason && (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-[12px] text-gray-700">
                  <div className="font-semibold">Dismissed</div>
                  <div className="mt-0.5">Reason: {intake.dismissReason}</div>
                </div>
              )}

              {isPending ? (
                <div className="space-y-2 pt-2 border-t border-[#eee]">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                    Triage
                  </p>
                  {/* Build Order is now the sole primary action — the
                      Build IVR handoff was removed 2026-08-01 per Dr.
                      Ben spec: every fax intake goes straight into an
                      order; the standalone-IVR upload path is still
                      available separately from /dashboard/ivrs when a
                      user wants to send a standalone IVR for external
                      approval, but it's not a fax-triage step. */}
                  <Button
                    className="w-full justify-start gap-2"
                    onClick={() => setCreateOrderOpen(true)}
                    disabled={pending}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Build Order from this fax
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                    onClick={() => setConfirmDismiss(true)}
                    disabled={pending}
                  >
                    <Trash2 className="w-4 h-4" />
                    Dismiss (spam / not usable)
                  </Button>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#eee]">
                  <p className="text-[11.5px] text-[var(--text3)]">
                    This intake has already been triaged. No further action
                    needed.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

            <div className="flex items-center justify-end px-5 py-3 border-t border-[#eee] bg-[#fafafa] shrink-0">
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Close
              </Button>
            </div>
          </div>
        </RadixDialog.Content>
      </DialogPortal>

      {/* Dismiss confirm — with an inline reason input inside the body */}
      <ConfirmModal
        open={confirmDismiss}
        onOpenChange={(next) => {
          setConfirmDismiss(next);
          if (!next) setDismissReason("");
        }}
        title="Dismiss this fax?"
        body={
          <div className="space-y-2">
            <p>
              The fax will be marked as dismissed and hidden from the pending
              list. The record stays for audit.
            </p>
            <div>
              <label className="text-[11px] font-semibold text-[#374151] block mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. spam, duplicate, wrong number"
                className="w-full h-9 px-2 border border-[#d1d5db] rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
              />
            </div>
          </div>
        }
        tone="destructive"
        confirmLabel="Dismiss"
        pending={pending}
        onConfirm={doDismiss}
      />

      {/* Build Order handoff — opens the full CreateOrderModal with the
          intake file pre-attached as a facesheet doc. */}
      {intake && (
        <CreateOrderModal
          open={createOrderOpen && intake.status === "pending"}
          onOpenChange={setCreateOrderOpen}
          hideTrigger
          facilities={facilities}
          fromIntake={{
            intakeId: intake.id,
            filePath: intake.filePath,
            fileName: intake.fileName ?? `fax-${intake.id}.pdf`,
            mimeType: intake.mimeType ?? "application/pdf",
            fileSize: intake.fileSize ?? 0,
          }}
        />
      )}
    </RadixDialog.Root>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-[var(--text3)] mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-wide text-[var(--text3)] font-semibold">
          {label}
        </div>
        <div className="text-[13px] truncate">{value}</div>
      </div>
    </div>
  );
}
