"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Loader2,
  Pencil,
  Save,
  X,
  Trash2,
  Clock,
  CheckCircle2,
  Send,
  ArrowRight,
  RotateCcw,
  Upload,
} from "lucide-react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { CreateOrderModal } from "../../orders/(components)/CreateOrderModal";
import { ConfirmModal } from "@/app/(dashboard)/(components)/ConfirmModal";
import { useAppDispatch } from "@/store/hooks";
import {
  updateIvrInStore,
  removeIvrFromStore,
} from "../(redux)/ivrs-slice";
import {
  getStandaloneIvrById,
  getIvrFileSignedUrl,
  updateStandaloneIvr,
  deleteStandaloneIvr,
  sendIvrsForApproval,
  resubmitDeniedIvr,
  addFileToIvr,
  deleteIvrFile,
  prepareIvrFileUpload,
} from "../(services)/actions";
import type {
  IStandaloneIvr,
  IStandaloneIvrFile,
  IStandaloneIvrHistoryEntry,
  IExternalApprover,
  StandaloneIvrHistoryEvent,
} from "@/utils/interfaces/standalone-ivrs";
import { STANDALONE_IVR_STATUS_LABELS } from "@/utils/interfaces/standalone-ivrs";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface IvrDetailModalProps {
  ivrId: string | null;
  onClose: () => void;
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

const EVENT_LABELS: Record<StandaloneIvrHistoryEvent, string> = {
  created: "Created",
  sent: "Sent to Approver",
  approved: "Approved",
  denied: "Denied",
  edited: "Edited",
  resubmitted: "Resubmitted",
  converted: "Converted to Order",
};

/**
 * Detail modal for a single standalone IVR. Simplified per Dr. Ben
 * feedback (2026-07-07):
 *
 *  - Patient, physician, and product info live INSIDE the PDF, so we no
 *    longer show or edit them here. The uploaded file is the source of
 *    truth for review.
 *  - Facility is fixed at upload time (auto-derived from the caller's
 *    account) and shown read-only.
 *  - Approver is the ONLY editable field, and only while the IVR is
 *    still in draft.
 *
 * What's rendered: status + files + (approval outcome banner) + facility
 * + approver + history. That's it.
 */
export function IvrDetailModal({
  ivrId,
  onClose,
  facilities,
  approvers,
}: IvrDetailModalProps) {
  const dispatch = useAppDispatch();
  const [ivr, setIvr] = useState<
    | (IStandaloneIvr & {
        files: IStandaloneIvrFile[];
        history: IStandaloneIvrHistoryEntry[];
      })
    | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [convertOpen, setConvertOpen] = useState(false);
  // Confirm-modal state — one entry per user-triggered destructive/send
  // action. Native window.confirm is banned per user feedback 2026-07-07.
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmResubmit, setConfirmResubmit] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<
    { fileId: string; fileName: string } | null
  >(null);

  // Only piece of editable state — approver assignment (draft only).
  const [draftApproverId, setDraftApproverId] = useState("");

  useEffect(() => {
    if (!ivrId) {
      setIvr(null);
      setSignedUrls({});
      setEditing(false);
      setDraftApproverId("");
      return;
    }
    setLoading(true);
    getStandaloneIvrById(ivrId)
      .then(async (fresh) => {
        setIvr(fresh);
        if (fresh) {
          setDraftApproverId(fresh.assignedApproverId ?? "");
          const urls: Record<string, string> = {};
          for (const f of fresh.files) {
            const { url } = await getIvrFileSignedUrl(f.filePath);
            if (url) urls[f.id] = url;
          }
          setSignedUrls(urls);
        }
      })
      .finally(() => setLoading(false));
  }, [ivrId]);

  async function reloadIvr() {
    if (!ivr) return;
    const fresh = await getStandaloneIvrById(ivr.id);
    setIvr(fresh);
    if (fresh) {
      dispatch(updateIvrInStore(fresh));
      setDraftApproverId(fresh.assignedApproverId ?? "");
    }
  }

  function handleSaveApprover() {
    if (!ivr) return;
    if (!draftApproverId) {
      toast.error("Please pick an approver.");
      return;
    }
    startTransition(async () => {
      // Only send the approver field — other fields stay as-is on the
      // server since they're captured from the PDF at review time.
      const res = await updateStandaloneIvr(ivr.id, {
        assignedApproverId: draftApproverId,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      dispatch(updateIvrInStore(res.ivr));
      const fresh = await getStandaloneIvrById(ivr.id);
      setIvr(fresh);
      setEditing(false);
      toast.success("Approver updated.");
    });
  }

  function doResubmit() {
    if (!ivr) return;
    setConfirmResubmit(false);
    startTransition(async () => {
      const res = await resubmitDeniedIvr(ivr.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to resubmit.");
        return;
      }
      toast.success("IVR reset to draft. Edit as needed, then send.");
      await reloadIvr();
    });
  }

  async function handleAddFile(file: File) {
    if (!ivr) return;
    startTransition(async () => {
      const prep = await prepareIvrFileUpload({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!prep.success) {
        toast.error(prep.error);
        return;
      }
      const supabase = createBrowserClient();
      const { error: uploadErr } = await supabase.storage
        .from(prep.bucket)
        .uploadToSignedUrl(prep.filePath, prep.uploadToken, file, {
          contentType: file.type || undefined,
        });
      if (uploadErr) {
        toast.error(uploadErr.message ?? "Upload failed.");
        return;
      }
      const res = await addFileToIvr({
        ivrId: ivr.id,
        filePath: prep.filePath,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to attach file.");
        return;
      }
      toast.success(`Added ${file.name}.`);
      await reloadIvr();
    });
  }

  function doDeleteFile() {
    if (!ivr || !confirmDeleteFile) return;
    const { fileId } = confirmDeleteFile;
    setConfirmDeleteFile(null);
    startTransition(async () => {
      const res = await deleteIvrFile(ivr.id, fileId);
      if (!res.success) {
        toast.error(res.error ?? "Failed to delete file.");
        return;
      }
      toast.success("File removed.");
      await reloadIvr();
    });
  }

  function doSend() {
    if (!ivr) return;
    setConfirmSend(false);
    startTransition(async () => {
      const res = await sendIvrsForApproval([ivr.id]);
      if (!res.success) {
        toast.error(res.error ?? "Failed to send.");
        return;
      }
      toast.success("IVR sent for approval.");
      const fresh = await getStandaloneIvrById(ivr.id);
      setIvr(fresh);
      if (fresh) dispatch(updateIvrInStore(fresh));
    });
  }

  function doDelete() {
    if (!ivr) return;
    setConfirmDelete(false);
    startTransition(async () => {
      const res = await deleteStandaloneIvr(ivr.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to delete IVR.");
        return;
      }
      dispatch(removeIvrFromStore(ivr.id));
      toast.success("IVR deleted.");
      onClose();
    });
  }

  const isDraft = ivr?.status === "draft";
  const isApproved = ivr?.status === "approved";
  const isDenied = ivr?.status === "denied";

  const facilityName =
    facilities.find((f) => f.id === ivr?.facilityId)?.name ??
    ivr?.facilityName ??
    "—";
  const approverName =
    approvers.find((a) => a.id === ivr?.assignedApproverId)?.name ??
    ivr?.approver?.name ??
    "—";

  return (
    <Dialog open={!!ivrId} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            IVR Details
            {ivr && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  ivr.status === "draft" &&
                    "bg-gray-100 text-gray-700 border-gray-200",
                  ivr.status === "sent" &&
                    "bg-blue-50 text-blue-700 border-blue-200",
                  ivr.status === "approved" &&
                    "bg-green-50 text-green-700 border-green-200",
                  ivr.status === "denied" &&
                    "bg-red-50 text-red-700 border-red-200",
                  ivr.status === "converted" &&
                    "bg-purple-50 text-purple-700 border-purple-200",
                )}
              >
                {STANDALONE_IVR_STATUS_LABELS[ivr.status]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {loading || !ivr ? (
            <div className="flex items-center justify-center py-12 text-[var(--text3)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : (
            <>
              {/* Files — this is the primary content since the PDF IS
                  the source of patient/physician/product info. */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                    Uploaded {ivr.files.length === 1 ? "file" : "files"}
                  </h3>
                  {isDraft && (
                    <label className="inline-flex items-center gap-1 text-[11px] text-[var(--navy)] font-medium cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />
                      Add file
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,.webp"
                        className="sr-only"
                        disabled={pending}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAddFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {ivr.files.length === 0 ? (
                  <p className="text-[12px] text-[var(--text3)] italic">
                    No files.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {ivr.files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-white"
                      >
                        <FileText className="w-4 h-4 shrink-0 text-[var(--navy)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium truncate">
                            {f.fileName}
                          </p>
                          <p className="text-[10.5px] text-[var(--text3)]">
                            {f.fileSize
                              ? `${(f.fileSize / 1024).toFixed(0)} KB`
                              : ""}{" "}
                            · uploaded{" "}
                            {new Date(f.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {signedUrls[f.id] && (
                          <a
                            href={signedUrls[f.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-[var(--navy)] hover:underline shrink-0"
                          >
                            View
                          </a>
                        )}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteFile({
                                fileId: f.id,
                                fileName: f.fileName,
                              })
                            }
                            disabled={pending}
                            className="shrink-0 p-1 rounded text-[var(--text3)] hover:text-red-500"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval outcome (if applicable) */}
              {(isApproved || isDenied) && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 space-y-1 text-[12px]",
                    isApproved
                      ? "bg-green-50 border-green-200 text-green-900"
                      : "bg-red-50 border-red-200 text-red-900",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {isApproved ? "Approved" : "Denied"} by{" "}
                    {ivr.approverDisplayName ?? "external approver"}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {isApproved
                      ? new Date(ivr.approvedAt ?? "").toLocaleString()
                      : new Date(ivr.deniedAt ?? "").toLocaleString()}
                  </div>
                  {isDenied && ivr.denialReason && (
                    <p className="text-[12px] mt-1">
                      <span className="font-medium">Reason:</span>{" "}
                      {ivr.denialReason}
                    </p>
                  )}
                </div>
              )}

              {/* Facility (read-only) + Approver (editable in draft). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-[var(--text3)] font-semibold mb-1">
                    Facility
                  </div>
                  <div className="text-[13px]">{facilityName}</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10.5px] uppercase tracking-wide text-[var(--text3)] font-semibold">
                      Assigned Approver
                    </div>
                    {isDraft && !editing && (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-[11px] text-[var(--navy)] hover:underline inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        Change
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={draftApproverId}
                        onChange={(e) => setDraftApproverId(e.target.value)}
                        disabled={pending}
                        // block + w-full + min-w-0 stop the parent flex
                        // from squeezing the select — same fix as the
                        // upload modal.
                        className="block w-full min-w-0 h-9 text-[13px] px-2 border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent"
                      >
                        <option value="">— Select —</option>
                        {approvers.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {a.email}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0 gap-1"
                        disabled={pending}
                        onClick={() => {
                          setEditing(false);
                          setDraftApproverId(ivr.assignedApproverId ?? "");
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 shrink-0 gap-1"
                        disabled={pending}
                        onClick={handleSaveApprover}
                      >
                        {pending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[13px] truncate">{approverName}</div>
                  )}
                </div>
              </div>

              {/* History */}
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
                  History
                </h3>
                <ol className="space-y-2">
                  {ivr.history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-start gap-2 text-[12px]"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text3)]" />
                      <div className="min-w-0">
                        <p className="font-medium">{EVENT_LABELS[h.event]}</p>
                        <p className="text-[10.5px] text-[var(--text3)]">
                          {new Date(h.createdAt).toLocaleString()}
                          {h.note ? ` · ${h.note}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa]">
          <div>
            {ivr && isDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="text-red-600 hover:text-red-700 gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete IVR
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {ivr && isDraft && !editing && (
              <Button
                onClick={() => setConfirmSend(true)}
                disabled={pending || !ivr.assignedApproverId}
                className="gap-1"
              >
                {pending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send for Approval
              </Button>
            )}
            {ivr && isDenied && (
              <Button
                onClick={() => setConfirmResubmit(true)}
                disabled={pending}
                variant="outline"
                className="gap-1"
              >
                {pending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reset to Draft
              </Button>
            )}
            {ivr && isApproved && (
              <Button
                onClick={() => setConvertOpen(true)}
                disabled={pending}
                className="gap-1"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Create Order from IVR
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Close
            </Button>
          </div>
        </div>
        {/* Opens the full CreateOrderModal driven by our state, with
            fromStandaloneIvr set so it shows the approved-IVR banner,
            pre-selects Skin Grafts, bypasses the direct-creation gate,
            and finalizes the standalone_ivr → order link after save. */}
        <CreateOrderModal
          open={convertOpen && !!ivr}
          onOpenChange={setConvertOpen}
          hideTrigger
          fromStandaloneIvr={
            ivr
              ? {
                  ivrId: ivr.id,
                  label:
                    ivr.files?.[0]?.fileName ?? ivr.patientName ?? null,
                }
              : undefined
          }
        />
      </DialogContent>

      {/* Confirmation modals — replace window.confirm per user feedback. */}
      <ConfirmModal
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this IVR for approval?"
        body={
          <>
            The assigned approver{" "}
            <span className="font-semibold">
              {ivr?.approver?.name ?? "for this IVR"}
            </span>{" "}
            will receive an email with a link to review and approve or deny.
          </>
        }
        confirmLabel="Send for Approval"
        pending={pending}
        onConfirm={doSend}
      />
      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this IVR?"
        body="All uploaded files will be permanently removed. This can't be undone."
        tone="destructive"
        confirmLabel="Delete IVR"
        pending={pending}
        onConfirm={doDelete}
      />
      <ConfirmModal
        open={confirmResubmit}
        onOpenChange={setConfirmResubmit}
        title="Reset denied IVR to draft?"
        body="Clears the denial and lets you edit and re-send. History of the denial stays on the audit trail."
        confirmLabel="Reset to Draft"
        pending={pending}
        onConfirm={doResubmit}
      />
      <ConfirmModal
        open={!!confirmDeleteFile}
        onOpenChange={(next) => !next && setConfirmDeleteFile(null)}
        title="Delete this file?"
        body={
          confirmDeleteFile ? (
            <>
              <span className="font-semibold">{confirmDeleteFile.fileName}</span>{" "}
              will be permanently removed from this IVR.
            </>
          ) : null
        }
        tone="destructive"
        confirmLabel="Delete File"
        pending={pending}
        onConfirm={doDeleteFile}
      />
    </Dialog>
  );
}
