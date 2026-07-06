"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText, Plus } from "lucide-react";
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
  patientName: string;
  patientDob: string;
  physicianName: string;
  physicianNpi: string;
  facilityId: string;
  productSummary: string;
  assignedApproverId: string;
  uploading: boolean;
  error: string | null;
}

const MAX_MB = 25;

/**
 * Bulk IVR upload modal. Each dropped file becomes ONE draft IVR row
 * with its own metadata form. Uploader can mix multiple approvers per
 * batch. On submit each row is uploaded to Storage and its metadata
 * committed via createStandaloneIvr; per-row failures are surfaced but
 * don't abort the batch.
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

  // Preselect the first facility if the user only has one — friction saver.
  const defaultFacilityId = facilities.length === 1 ? facilities[0].id : "";
  const defaultApproverId = approvers.length === 1 ? approvers[0].id : "";

  const anyIncomplete = useMemo(() => {
    return rows.some(
      (r) =>
        !r.patientName.trim() ||
        !r.patientDob ||
        !r.physicianName.trim() ||
        !r.facilityId ||
        !r.productSummary.trim() ||
        !r.assignedApproverId,
    );
  }, [rows]);

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
        patientName: "",
        patientDob: "",
        physicianName: "",
        physicianNpi: "",
        facilityId: defaultFacilityId,
        productSummary: "",
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
  }

  function handleClose(next: boolean) {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (rows.length === 0) return;
    if (anyIncomplete) {
      toast.error("Fill in every field on every row before uploading.");
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserClient();
      const failures: Array<{ row: DraftRow; reason: string }> = [];
      const created: DraftRow[] = [];

      for (const row of rows) {
        updateRow(row.key, { uploading: true, error: null });

        // 1. Sign a one-time upload URL.
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

        // 2. Upload the bytes direct to Storage.
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

        // 3. Create the IVR row + register the file.
        const res = await createStandaloneIvr({
          patientName: row.patientName,
          patientDob: row.patientDob,
          physicianName: row.physicianName,
          physicianNpi: row.physicianNpi || null,
          facilityId: row.facilityId,
          productSummary: row.productSummary,
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

      // Drop successfully-created rows from the modal, keep failures so
      // the user can retry.
      setRows((prev) => prev.filter((r) => !created.includes(r)));

      if (failures.length > 0 && created.length === 0) {
        toast.error(`${failures.length} upload${failures.length !== 1 ? "s" : ""} failed. See row errors.`);
      } else if (failures.length > 0) {
        toast.success(`${created.length} uploaded · ${failures.length} failed. Fix and retry.`);
      } else {
        toast.success(`${created.length} IVR${created.length !== 1 ? "s" : ""} uploaded.`);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold">
            Upload IVRs
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Drop zone */}
          <label
            className={cn(
              "block border-2 border-dashed rounded-xl px-6 py-6 text-center transition-colors cursor-pointer bg-white",
              pending
                ? "border-[var(--border)] opacity-60 cursor-not-allowed"
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
            <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--navy)]" />
            <p className="text-[13px] font-medium">
              Drop IVR files here, or click to browse
            </p>
            <p className="text-[11px] text-[var(--text3)] mt-1">
              PDF, DOC, DOCX, JPG, PNG, HEIC · max {MAX_MB} MB each · one file
              per IVR
            </p>
          </label>

          {/* Draft rows */}
          {rows.length > 0 && (
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={row.key}
                  className={cn(
                    "rounded-lg border border-[var(--border)] p-3 bg-white space-y-3",
                    row.error && "border-red-300 bg-red-50/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 shrink-0 text-[var(--navy)]" />
                      <p className="text-[13px] font-medium truncate">
                        IVR {idx + 1} · {row.file.name}
                      </p>
                      {row.uploading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text3)]" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={row.uploading || pending}
                      className="p-1 rounded hover:bg-[var(--bg)] text-[var(--text3)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Patient Name"
                      required
                      value={row.patientName}
                      onChange={(v) => updateRow(row.key, { patientName: v })}
                      disabled={row.uploading || pending}
                    />
                    <FormField
                      label="Patient DOB"
                      required
                      type="date"
                      value={row.patientDob}
                      onChange={(v) => updateRow(row.key, { patientDob: v })}
                      disabled={row.uploading || pending}
                    />
                    <FormField
                      label="Physician Name"
                      required
                      value={row.physicianName}
                      onChange={(v) => updateRow(row.key, { physicianName: v })}
                      disabled={row.uploading || pending}
                    />
                    <FormField
                      label="Physician NPI"
                      value={row.physicianNpi}
                      onChange={(v) => updateRow(row.key, { physicianNpi: v })}
                      disabled={row.uploading || pending}
                      placeholder="Optional"
                    />
                    <SelectField
                      label="Facility"
                      required
                      value={row.facilityId}
                      onChange={(v) => updateRow(row.key, { facilityId: v })}
                      disabled={row.uploading || pending}
                      options={facilities.map((f) => ({
                        value: f.id,
                        label: f.name,
                      }))}
                    />
                    <SelectField
                      label="Assigned Approver"
                      required
                      value={row.assignedApproverId}
                      onChange={(v) =>
                        updateRow(row.key, { assignedApproverId: v })
                      }
                      disabled={row.uploading || pending}
                      options={approvers.map((a) => ({
                        value: a.id,
                        label: `${a.name} — ${a.email}`,
                      }))}
                    />
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-[#374151] block mb-1">
                        Products <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={row.productSummary}
                        onChange={(e) =>
                          updateRow(row.key, { productSummary: e.target.value })
                        }
                        disabled={row.uploading || pending}
                        rows={2}
                        className="w-full text-[12px] px-2 py-1.5 border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent disabled:opacity-60"
                        placeholder="e.g. Carefirst 4x4 × 2, Resolve Matrix 2x2 × 1"
                      />
                    </div>
                  </div>

                  {row.error && (
                    <p className="text-[11px] text-red-700 font-medium">
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
            disabled={pending || rows.length === 0}
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

function FormField({
  label,
  required,
  type = "text",
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#374151] block mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-8 text-[12px]"
      />
    </div>
  );
}

function SelectField({
  label,
  required,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#374151] block mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-8 text-[12px] px-2 border border-[#e5e7eb] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent disabled:opacity-60"
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
