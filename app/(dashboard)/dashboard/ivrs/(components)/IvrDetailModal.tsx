"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { ConvertIvrModal } from "./ConvertIvrModal";
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
 * Detail modal for a single standalone IVR. Shows metadata, files, and
 * history timeline. Metadata is editable while the IVR is in draft
 * state; once sent/approved/denied/converted the view is read-only.
 * Deletion is also draft-only.
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

  // Edit-mode draft (only used while editing).
  const [draft, setDraft] = useState({
    patientName: "",
    patientDob: "",
    physicianName: "",
    physicianNpi: "",
    facilityId: "",
    productSummary: "",
    assignedApproverId: "",
  });

  useEffect(() => {
    if (!ivrId) {
      setIvr(null);
      setSignedUrls({});
      setEditing(false);
      return;
    }
    setLoading(true);
    getStandaloneIvrById(ivrId)
      .then(async (fresh) => {
        setIvr(fresh);
        if (fresh) {
          setDraft({
            // Metadata fields are now optional in the DB (info lives in
            // the PDF). Coalesce nulls to empty strings for the form inputs.
            patientName: fresh.patientName ?? "",
            patientDob: fresh.patientDob ?? "",
            physicianName: fresh.physicianName ?? "",
            physicianNpi: fresh.physicianNpi ?? "",
            facilityId: fresh.facilityId,
            productSummary: fresh.productSummary ?? "",
            assignedApproverId: fresh.assignedApproverId ?? "",
          });
          // Sign URLs for inline preview.
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

  function handleSave() {
    if (!ivr) return;
    startTransition(async () => {
      const res = await updateStandaloneIvr(ivr.id, draft);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      dispatch(updateIvrInStore(res.ivr));
      // Refetch to pick up the new history entry too.
      const fresh = await getStandaloneIvrById(ivr.id);
      setIvr(fresh);
      setEditing(false);
      toast.success("IVR updated.");
    });
  }

  async function reloadIvr() {
    if (!ivr) return;
    const fresh = await getStandaloneIvrById(ivr.id);
    setIvr(fresh);
    if (fresh) dispatch(updateIvrInStore(fresh));
  }

  function handleResubmit() {
    if (!ivr) return;
    if (
      !window.confirm(
        "Reset this denied IVR back to draft so you can edit and re-send it?",
      )
    ) {
      return;
    }
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

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (!ivr) return;
    if (
      !window.confirm(
        `Delete file "${fileName}" from this IVR? The file will be permanently removed.`,
      )
    ) {
      return;
    }
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

  function handleSend() {
    if (!ivr) return;
    if (
      !window.confirm(
        `Send this IVR to ${ivr.approver?.name ?? "the assigned approver"} for review?`,
      )
    ) {
      return;
    }
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

  function handleDelete() {
    if (!ivr) return;
    if (
      !window.confirm(
        `Delete this IVR for ${ivr.patientName}? Uploaded files will be removed.`,
      )
    ) {
      return;
    }
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
    facilities.find((f) => f.id === (editing ? draft.facilityId : ivr?.facilityId))
      ?.name ??
    ivr?.facilityName ??
    "—";
  const approverLabel = (() => {
    if (editing) {
      return approvers.find((a) => a.id === draft.assignedApproverId)?.name ?? "—";
    }
    return ivr?.approver?.name ?? "—";
  })();

  return (
    <Dialog open={!!ivrId} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
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
              {/* Metadata */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                    Details
                  </h3>
                  {isDraft && !editing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                  )}
                  {editing && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1"
                        disabled={pending}
                        onClick={() => {
                          setEditing(false);
                          setDraft({
                            patientName: ivr.patientName ?? "",
                            patientDob: ivr.patientDob ?? "",
                            physicianName: ivr.physicianName ?? "",
                            physicianNpi: ivr.physicianNpi ?? "",
                            facilityId: ivr.facilityId,
                            productSummary: ivr.productSummary ?? "",
                            assignedApproverId: ivr.assignedApproverId ?? "",
                          });
                        }}
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        disabled={pending}
                        onClick={handleSave}
                      >
                        {pending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Patient Name"
                      value={draft.patientName}
                      onChange={(v) => setDraft({ ...draft, patientName: v })}
                    />
                    <Field
                      label="Patient DOB"
                      type="date"
                      value={draft.patientDob}
                      onChange={(v) => setDraft({ ...draft, patientDob: v })}
                    />
                    <Field
                      label="Physician Name"
                      value={draft.physicianName}
                      onChange={(v) => setDraft({ ...draft, physicianName: v })}
                    />
                    <Field
                      label="Physician NPI"
                      value={draft.physicianNpi}
                      onChange={(v) => setDraft({ ...draft, physicianNpi: v })}
                    />
                    <SelectField
                      label="Facility"
                      value={draft.facilityId}
                      onChange={(v) => setDraft({ ...draft, facilityId: v })}
                      options={facilities.map((f) => ({
                        value: f.id,
                        label: f.name,
                      }))}
                    />
                    <SelectField
                      label="Approver"
                      value={draft.assignedApproverId}
                      onChange={(v) =>
                        setDraft({ ...draft, assignedApproverId: v })
                      }
                      options={approvers.map((a) => ({
                        value: a.id,
                        label: `${a.name} — ${a.email}`,
                      }))}
                    />
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-[#374151] block mb-1">
                        Products
                      </label>
                      <textarea
                        value={draft.productSummary}
                        onChange={(e) =>
                          setDraft({ ...draft, productSummary: e.target.value })
                        }
                        rows={2}
                        className="w-full text-[12px] px-2 py-1.5 border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                    {/* Patient / physician / products are nullable now —
                        info lives in the PDF. Show "See attached PDF"
                        as a fallback so the row doesn't render as "null
                        · DOB null". */}
                    <ReadRow
                      label="Patient"
                      value={
                        ivr.patientName
                          ? `${ivr.patientName}${ivr.patientDob ? ` · DOB ${ivr.patientDob}` : ""}`
                          : "See attached PDF"
                      }
                    />
                    <ReadRow
                      label="Physician"
                      value={
                        ivr.physicianName
                          ? `${ivr.physicianName}${ivr.physicianNpi ? ` · NPI ${ivr.physicianNpi}` : ""}`
                          : "See attached PDF"
                      }
                    />
                    <ReadRow label="Facility" value={facilityName} />
                    <ReadRow label="Approver" value={approverLabel} />
                    <ReadRow
                      className="col-span-2"
                      label="Products"
                      value={ivr.productSummary ?? "Added at order creation"}
                    />
                  </div>
                )}
              </div>

              {/* Approval outcome (if applicable) */}
              {(ivr.status === "approved" || ivr.status === "denied") && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 space-y-1 text-[12px]",
                    ivr.status === "approved"
                      ? "bg-green-50 border-green-200 text-green-900"
                      : "bg-red-50 border-red-200 text-red-900",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {ivr.status === "approved" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {ivr.status === "approved"
                      ? "Approved"
                      : "Denied"}{" "}
                    by {ivr.approverDisplayName ?? "external approver"}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {ivr.status === "approved"
                      ? new Date(ivr.approvedAt ?? "").toLocaleString()
                      : new Date(ivr.deniedAt ?? "").toLocaleString()}
                  </div>
                  {ivr.status === "denied" && ivr.denialReason && (
                    <p className="text-[12px] mt-1">
                      <span className="font-medium">Reason:</span>{" "}
                      {ivr.denialReason}
                    </p>
                  )}
                </div>
              )}

              {/* Files */}
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
                            onClick={() => handleDeleteFile(f.id, f.fileName)}
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
                onClick={handleDelete}
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
                onClick={handleSend}
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
                onClick={handleResubmit}
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
        <ConvertIvrModal
          open={convertOpen}
          ivrId={ivr?.id ?? null}
          patientName={ivr?.patientName ?? ""}
          onClose={() => setConvertOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#374151] block mb-1">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-[12px]"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#374151] block mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 text-[12px] px-2 border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent"
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10.5px] uppercase tracking-wide text-[var(--text3)] font-semibold">
        {label}
      </div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}
