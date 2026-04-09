"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Upload, X, FileText } from "lucide-react";
import { createOrder } from "../(services)/order-write-actions";
import { uploadOrderDocument } from "../(services)/order-document-actions";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import type { DocumentType } from "@/utils/interfaces/orders";
import { WOUND_TYPES } from "@/utils/constants/orders";

type DocFile = { file: File; type: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,image/*";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadZoneProps {
  label: string;
  description: string;
  docType: string;
  required: boolean;
  multiple?: boolean;
  files: DocFile[];
  onAdd: (files: File[], type: string) => void;
  onRemove: (idx: number) => void;
  error?: boolean;
}

function UploadZone({
  label,
  description,
  docType,
  required,
  multiple,
  files,
  onAdd,
  onRemove,
  error,
}: UploadZoneProps) {
  const typeFiles = files.filter((f) => f.type === docType);

  // Map local index within this docType back to global index in `files`
  function globalIdx(localIdx: number): number {
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === docType) {
        if (count === localIdx) return i;
        count++;
      }
    }
    return -1;
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {required && <span className="text-red-500 text-xs">*</span>}
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{description}</p>

      {typeFiles.length === 0 ? (
        <label
          className={cn(
            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-3 py-4 cursor-pointer transition-all text-center",
            error
              ? "border-red-300 bg-red-50"
              : "border-slate-200 bg-slate-50 hover:border-[var(--navy)]/50 hover:bg-blue-50/30"
          )}
        >
          <Upload className="w-5 h-5 text-slate-300 mb-1.5" />
          <span className="text-xs text-slate-500">
            Drag & drop or{" "}
            <span className="text-[var(--navy)] font-medium">browse</span>
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            PDF, JPG, PNG, HEIC · max 10 MB
          </span>
          <input
            type="file"
            className="hidden"
            accept={ACCEPT}
            multiple={multiple}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              const valid = selected.filter((f) => {
                if (f.size > MAX_FILE_SIZE) {
                  toast.error(`${f.name} exceeds 10 MB.`);
                  return false;
                }
                return true;
              });
              if (valid.length) onAdd(valid, docType);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="space-y-1">
          {typeFiles.map((df, localIdx) => (
            <div
              key={localIdx}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">
                {df.file.name}
              </span>
              <span className="text-[11px] text-slate-400 shrink-0">
                {formatSize(df.file.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(globalIdx(localIdx))}
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <label className="flex items-center gap-1 text-[11px] text-[var(--navy)] hover:underline cursor-pointer mt-1">
            <Plus className="w-3 h-3" />
            Add more
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              multiple={multiple}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                const valid = selected.filter((f) => {
                  if (f.size > MAX_FILE_SIZE) {
                    toast.error(`${f.name} exceeds 10 MB.`);
                    return false;
                  }
                  return true;
                });
                if (valid.length) onAdd(valid, docType);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function CreateOrderModal() {
  const [open, setOpen] = useState(false);
  const [woundType, setWoundType] = useState<"chronic" | "post_surgical">(
    "chronic"
  );
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setWoundType("chronic");
    setDateOfService(new Date().toISOString().split("T")[0]);
    setNotes("");
    setDocs([]);
    setUploadProgress(null);
    setSubmitted(false);
  }

  function addDocs(files: File[], type: string) {
    setDocs((prev) => [...prev, ...files.map((f) => ({ file: f, type }))]);
  }

  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  }

  const hasFacesheet = docs.some((d) => d.type === "facesheet");
  const needsWoundPics = woundType === "chronic";
  const hasWoundPics = docs.some((d) => d.type === "wound_pictures");

  const canSubmit =
    !!woundType && !!dateOfService && hasFacesheet && (!needsWoundPics || hasWoundPics);

  function handleClose() {
    if (!isPending) {
      setOpen(false);
      reset();
    }
  }

  function handleSubmit() {
    setSubmitted(true);
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await createOrder({
        wound_type: woundType,
        date_of_service: dateOfService,
        notes: notes.trim() || null,
      });

      if (!result.success || !result.orderId) {
        toast.error(result.error ?? "Failed to create order.");
        return;
      }

      const orderId = result.orderId;

      // Upload documents sequentially
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        setUploadProgress(`Uploading ${i + 1}/${docs.length}: ${d.file.name}`);
        const docFd = new FormData();
        docFd.set("file", d.file);
        const res = await uploadOrderDocument(
          orderId,
          d.type as DocumentType,
          docFd
        );
        if (!res.success) {
          toast.error(`Failed to upload ${d.file.name}: ${res.error}`);
        }
      }

      setUploadProgress(null);
      toast.success("Order created. Upload confirmed.");
      setOpen(false);
      reset();
    });
  }

  const facesheetError = submitted && !hasFacesheet;
  const woundPicsError = submitted && needsWoundPics && !hasWoundPics;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white cursor-pointer rounded-lg shadow-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        New Order
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border-[var(--border)] shadow-2xl p-0">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-[var(--border)]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[var(--navy)]">
                Create Order
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Section 1 — Clinical Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Clinical Info
              </h3>

              {/* Wound Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Wound Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {WOUND_TYPES.map((wt) => (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setWoundType(wt.value)}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all",
                        woundType === wt.value
                          ? "border-[var(--navy)] bg-blue-50 text-[var(--navy)]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date of Service */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Date of Service <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateOfService}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDateOfService(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-600 text-xs shrink-0"
                    onClick={() =>
                      setDateOfService(new Date().toISOString().split("T")[0])
                    }
                  >
                    Today
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Clinical notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {/* Section 2 — Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Documents
              </h3>

              {/* Facesheet + Clinical Docs side by side */}
              <div className="flex gap-3">
                <UploadZone
                  label="Patient Facesheet"
                  description="Insurance & demographics"
                  docType="facesheet"
                  required
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                  error={facesheetError}
                />
                <UploadZone
                  label="Clinical Documentation"
                  description="Doctor's notes, records"
                  docType="clinical_docs"
                  required={false}
                  multiple
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                />
              </div>

              {facesheetError && (
                <p className="text-xs text-red-500">
                  Patient facesheet is required.
                </p>
              )}

              {/* Wound Pictures */}
              <UploadZone
                label="Wound Pictures"
                description="Multiple images allowed"
                docType="wound_pictures"
                required={needsWoundPics}
                multiple
                files={docs}
                onAdd={addDocs}
                onRemove={removeDoc}
                error={woundPicsError}
              />
              {woundPicsError && (
                <p className="text-xs text-red-500">
                  Wound pictures are required for chronic wounds.
                </p>
              )}
            </div>

            {/* Upload progress */}
            {uploadProgress && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                {uploadProgress}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-[var(--border)] px-6 py-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-[var(--border)]"
              disabled={isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Submit →"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
