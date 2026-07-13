"use client";

import { useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText, Plus, AlertCircle } from "lucide-react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useAppDispatch } from "@/store/hooks";
import { addIvrToStore } from "../(redux)/ivrs-slice";
import {
  createStandaloneIvr,
  prepareIvrFileUpload,
} from "../(services)/actions";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface UploadIvrsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

interface DraftRow {
  key: string;
  file: File;
  assignedApproverId: string;
  uploading: boolean;
  error: string | null;
}

const MAX_MB = 25;

/**
 * Bulk IVR upload modal — simplified per Dr. Ben feedback (2026-07-07):
 *   - Patient/physician/DOB/product info lives INSIDE the uploaded PDF;
 *     the portal doesn't ask for it. The approver reads the PDF to review.
 *   - Facility is derived from the caller's facility membership (single
 *     facility → auto; multiple → one shared picker at the top).
 *   - Products are added later, at order-creation time, not at IVR upload.
 *
 * Net effect: each dropped file only needs ONE choice — which external
 * approver receives it.
 */
export function UploadIvrsModal({
  open,
  onOpenChange,
  facilities,
  approvers,
}: UploadIvrsModalProps) {
  const dispatch = useAppDispatch();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  // If the user belongs to exactly one facility, lock it in silently. If
  // they cover multiple (typically reps), let them pick once for the whole
  // batch — the choice applies to every file dropped.
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    facilities.length === 1 ? facilities[0].id : "",
  );
  const facilityLocked = facilities.length === 1;
  const facilityName = facilities.find((f) => f.id === selectedFacilityId)?.name;

  // Default approver: if there's only one, preselect it — most users
  // will just drop files and click Upload.
  const defaultApproverId = approvers.length === 1 ? approvers[0].id : "";

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const additions: DraftRow[] = [];
    for (const file of Array.from(fileList)) {
      const mb = file.size / (1024 * 1024);
      if (mb > MAX_MB) {
        toast.error(`${file.name} is ${mb.toFixed(1)} MB — max ${MAX_MB} MB.`);
        continue;
      }
      additions.push({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        assignedApproverId: defaultApproverId,
        uploading: false,
        error: null,
      });
    }
    setRows((prev) => [...prev, ...additions]);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function reset() {
    setRows([]);
    if (!facilityLocked) setSelectedFacilityId("");
  }

  function handleClose(next: boolean) {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    dragDepth.current += 1;
    setDragActive(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (pending) return;
    addFiles(e.dataTransfer.files);
  }

  const missingFacility = !selectedFacilityId;
  const missingApprover = rows.some((r) => !r.assignedApproverId);
  const disableSubmit =
    rows.length === 0 || pending || missingFacility || missingApprover;

  function handleSubmit() {
    if (rows.length === 0) return;
    if (missingFacility) {
      toast.error("Please pick which facility these IVRs belong to.");
      return;
    }
    if (missingApprover) {
      toast.error("Every file needs an assigned approver.");
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserClient();
      const failures: Array<{ row: DraftRow; reason: string }> = [];
      const created: DraftRow[] = [];

      for (const row of rows) {
        updateRow(row.key, { uploading: true, error: null });

        const prep = await prepareIvrFileUpload({
          fileName: row.file.name,
          mimeType: row.file.type || "application/octet-stream",
          size: row.file.size,
        });
        if (!prep.success) {
          failures.push({ row, reason: prep.error });
          updateRow(row.key, { uploading: false, error: prep.error });
          continue;
        }

        const { error: uploadErr } = await supabase.storage
          .from(prep.bucket)
          .uploadToSignedUrl(prep.filePath, prep.uploadToken, row.file, {
            contentType: row.file.type || undefined,
          });
        if (uploadErr) {
          const reason = uploadErr.message ?? "Upload failed.";
          failures.push({ row, reason });
          updateRow(row.key, { uploading: false, error: reason });
          continue;
        }

        const res = await createStandaloneIvr({
          // Patient/physician/product info is inside the PDF; pass nulls
          // and let the DB store them (now nullable per migration).
          patientName: null,
          patientDob: null,
          physicianName: null,
          physicianNpi: null,
          facilityId: selectedFacilityId,
          productSummary: null,
          assignedApproverId: row.assignedApproverId,
          files: [
            {
              filePath: prep.filePath,
              fileName: row.file.name,
              mimeType: row.file.type || "application/octet-stream",
              fileSize: row.file.size,
            },
          ],
        });
        if (!res.success) {
          failures.push({ row, reason: res.error });
          updateRow(row.key, { uploading: false, error: res.error });
          continue;
        }
        dispatch(addIvrToStore(res.ivr));
        created.push(row);
      }

      setRows((prev) => prev.filter((r) => !created.includes(r)));

      if (failures.length > 0 && created.length === 0) {
        toast.error(
          `${failures.length} upload${failures.length !== 1 ? "s" : ""} failed. See row errors.`,
        );
      } else if (failures.length > 0) {
        toast.success(
          `${created.length} uploaded · ${failures.length} failed. Fix and retry.`,
        );
      } else {
        toast.success(
          `${created.length} IVR${created.length !== 1 ? "s" : ""} uploaded.`,
        );
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold">
            Upload IVRs
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Facility banner / picker. Shows above the drop zone so it's
              set for the whole batch before any files are dropped. */}
          {facilityLocked ? (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-[12px] text-slate-700">
              Uploading to{" "}
              <span className="font-semibold">{facilityName}</span>. All IVRs
              in this batch will be attached to this facility.
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-[#374151] block mb-1">
                Facility <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                disabled={pending}
                className="w-full h-9 text-[13px] px-2 border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent"
              >
                <option value="">— Select facility for this batch —</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text3)] mt-1">
                Applies to every file in this batch.
              </p>
            </div>
          )}

          {/* Info notice — one line explaining what the portal DOES NOT need. */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>
              Patient, physician, and product info stay in the PDF — no need to
              re-type them here. Just pick an approver for each file.
            </p>
          </div>

          {/* Drop zone */}
          <label
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "block border-2 border-dashed rounded-xl px-6 py-6 text-center transition-colors cursor-pointer bg-white",
              pending
                ? "border-[var(--border)] opacity-60 cursor-not-allowed"
                : dragActive
                  ? "border-[var(--navy)] bg-blue-50/60"
                  : "border-[var(--border)] hover:border-[var(--navy)]",
            )}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,.webp"
              multiple
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="pointer-events-none">
              <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--navy)]" />
              <p className="text-[13px] font-medium">
                {dragActive
                  ? "Drop to add"
                  : "Drop IVR files here, or click to browse"}
              </p>
              <p className="text-[11px] text-[var(--text3)] mt-1">
                PDF, DOC, DOCX, JPG, PNG, HEIC · max {MAX_MB} MB each · one file
                per IVR
              </p>
            </div>
          </label>

          {/* Draft rows — one per file, only asking for the approver. */}
          {rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div
                  key={row.key}
                  className={cn(
                    "rounded-lg border border-[var(--border)] p-3 bg-white",
                    row.error && "border-red-300 bg-red-50/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 shrink-0 text-[var(--navy)]" />
                    <p className="text-[12.5px] font-medium truncate flex-1 min-w-0">
                      IVR {idx + 1} · {row.file.name}
                    </p>
                    {row.uploading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text3)] shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={row.uploading || pending}
                      className="p-1 rounded hover:bg-[var(--bg)] text-[var(--text3)] shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] block mb-1">
                      Assigned Approver{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={row.assignedApproverId}
                      onChange={(e) =>
                        updateRow(row.key, { assignedApproverId: e.target.value })
                      }
                      disabled={row.uploading || pending}
                      // w-full + min-w-0 in a flex context stop the parent
                      // from squeezing the select — was the cause of the
                      // "Jofel Salado — salado..." truncation.
                      className="block w-full h-9 text-[13px] px-2 border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent disabled:opacity-60"
                    >
                      <option value="">— Select approver —</option>
                      {approvers.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {row.error && (
                    <p className="text-[11px] text-red-700 font-medium mt-2">
                      {row.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <label className="flex items-center justify-center gap-2 text-[12px] text-[var(--navy)] font-medium cursor-pointer py-2 border border-dashed border-[var(--border)] rounded-lg hover:bg-[var(--bg)] transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,.webp"
                multiple
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Plus className="w-3.5 h-3.5" />
              Add more files
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa]">
          <p className="text-[11px] text-[var(--text3)] flex-1">
            {rows.length === 0
              ? "No files selected"
              : `${rows.length} IVR${rows.length !== 1 ? "s" : ""} to upload`}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={disableSubmit}
            className="gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
