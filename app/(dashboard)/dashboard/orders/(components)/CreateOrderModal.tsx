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
import { uploadOrderDocument, triggerOrderExtraction } from "../(services)/order-document-actions";
import { getOrderById } from "../(services)/order-read-actions";
import { addOrderToStore } from "../(redux)/orders-slice";
import { useAppDispatch } from "@/store/hooks";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import type { DocumentType } from "@/utils/interfaces/orders";
import { WOUND_TYPES } from "@/utils/constants/orders";

type DocFile = { file: File; type: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Documents: PDF or images (AI extraction supports these formats only)
const ACCEPT_DOCS = ".pdf,.jpg,.jpeg,.png,.heic";
// Wound pictures: images only
const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.heic";

const VALID_DOC_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".heic"]);
const VALID_IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".heic"]);

function fileExt(file: File): string {
  return "." + (file.name.split(".").pop() ?? "").toLowerCase();
}

function isValidDocFile(file: File): boolean {
  return (
    VALID_DOC_EXTS.has(fileExt(file)) ||
    file.type === "application/pdf" ||
    file.type.startsWith("image/")
  );
}

function isValidImageFile(file: File): boolean {
  return VALID_IMG_EXTS.has(fileExt(file)) || file.type.startsWith("image/");
}

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
  accept: string;
  fileType: "document" | "image";
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
  accept,
  fileType,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const typeFiles = files.filter((f) => f.type === docType);
  const isValid = fileType === "image" ? isValidImageFile : isValidDocFile;
  const allowedLabel = fileType === "image" ? "JPG, PNG, HEIC" : "PDF, JPG, PNG, HEIC";
  const hintText = fileType === "image" ? "JPG, PNG, HEIC · max 10 MB" : "PDF, JPG, PNG, HEIC · max 10 MB";

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const valid = droppedFiles.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10 MB.`);
        return false;
      }
      if (!isValid(f)) {
        toast.error(`${f.name}: unsupported format. Allowed: ${allowedLabel}`);
        return false;
      }
      return true;
    });
    if (valid.length) onAdd(valid, docType);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-3 py-4 cursor-pointer transition-all text-center",
            isDragging
              ? "border-[var(--navy)] bg-blue-50/50 scale-[1.02]"
              : error
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-slate-50 hover:border-[var(--navy)]/50 hover:bg-blue-50/30",
          )}
        >
          <Upload className="w-5 h-5 text-slate-300 mb-1.5" />
          <span className="text-xs text-slate-500">
            Drag & drop or{" "}
            <span className="text-[var(--navy)] font-medium">browse</span>
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            {hintText}
          </span>
          <input
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              const valid = selected.filter((f) => {
                if (f.size > MAX_FILE_SIZE) {
                  toast.error(`${f.name} exceeds 10 MB.`);
                  return false;
                }
                if (!isValid(f)) {
                  toast.error(`${f.name}: unsupported format. Allowed: ${allowedLabel}`);
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
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "space-y-1",
            isDragging && "ring-2 ring-[var(--navy)] rounded-lg",
          )}
        >
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
              accept={accept}
              multiple={multiple}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                const valid = selected.filter((f) => {
                  if (f.size > MAX_FILE_SIZE) {
                    toast.error(`${f.name} exceeds 10 MB.`);
                    return false;
                  }
                  if (!isValid(f)) {
                    toast.error(`${f.name}: unsupported format. Allowed: ${allowedLabel}`);
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
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [woundType, setWoundType] = useState<"chronic" | "post_surgical">(
    "chronic",
  );
  // Order Type is locked to "omeza" per client request — Surgical Collagen
  // is no longer offered as a selectable option. The state + submit payload
  // still accept the broader type union so legacy orders with
  // "surgical_collagen" continue to type-check downstream.
  const [orderType, setOrderType] = useState<"surgical_collagen" | "omeza" | null>("omeza");
  const [manualInput, setManualInput] = useState(false);
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientLastName, setPatientLastName] = useState("");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setWoundType("chronic");
    setOrderType(null);
    setManualInput(false);
    setPatientFirstName("");
    setPatientLastName("");
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
  const hasClinicalDocs = docs.some((d) => d.type === "clinical_docs");
  const hasValidId = docs.some((d) => d.type === "valid_id");

  // Manual input skips AI extraction entirely; every document upload becomes
  // optional, and the order/IVR/HCFA forms stay blank for manual completion.
  const docsRequired = !manualInput;
  const patientNameProvided =
    patientFirstName.trim().length > 0 && patientLastName.trim().length > 0;

  const canSubmit =
    !!woundType &&
    !!dateOfService &&
    (!docsRequired || (hasFacesheet && hasClinicalDocs && hasValidId)) &&
    (!manualInput || patientNameProvided);

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
        order_type: orderType,
        manual_input: manualInput,
        patient_first_name: manualInput ? patientFirstName.trim() : null,
        patient_last_name: manualInput ? patientLastName.trim() : null,
      });

      if (!result.success || !result.orderId) {
        toast.error(result.error ?? "Failed to create order.");
        return;
      }

      const orderId = result.orderId;

      // Upload documents sequentially; collect file paths for AI extraction
      const extractableDocs: Array<{ documentType: string; filePath: string }> = [];
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        setUploadProgress(`Uploading ${i + 1}/${docs.length}: ${d.file.name}`);
        const docFd = new FormData();
        docFd.set("file", d.file);
        const res = await uploadOrderDocument(
          orderId,
          d.type as DocumentType,
          docFd,
        );
        if (!res.success) {
          toast.error(`Failed to upload ${d.file.name}: ${res.error}`);
        } else if (
          res.document &&
          ["facesheet", "clinical_docs"].includes(d.type)
        ) {
          extractableDocs.push({
            documentType: d.type,
            filePath: res.document.filePath,
          });
        }
      }

      // Trigger a single combined AI extraction after all uploads complete.
      // Skip entirely when the user chose manual input — forms must stay blank.
      if (!manualInput && extractableDocs.length > 0) {
        triggerOrderExtraction(orderId, extractableDocs).catch((err) =>
          console.error("[CreateOrderModal] AI trigger:", err),
        );
      }

      setUploadProgress(null);
      toast.success("Order created. Upload confirmed.");
      setOpen(false);
      reset();

      // Add to store and open detail modal immediately
      const fullOrder = await getOrderById(orderId);
      if (fullOrder) {
        dispatch(addOrderToStore(fullOrder));
        window.dispatchEvent(
          new CustomEvent("open-order-modal", {
            detail: { orderId, tab: "overview" },
          }),
        );
      }
    });
  }

  const facesheetError = submitted && docsRequired && !hasFacesheet;
  const clinicalDocsError = submitted && docsRequired && !hasClinicalDocs;
  const validIdError = submitted && docsRequired && !hasValidId;
  const patientFirstNameError =
    submitted && manualInput && patientFirstName.trim().length === 0;
  const patientLastNameError =
    submitted && manualInput && patientLastName.trim().length === 0;

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
              <div className="flex flex-col gap-1.5">
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
                          : "border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Type — locked to Omeza. Surgical Collagen removed per
                  client request; if it ever needs to come back, restore the
                  toggle array + onChange handler. */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Order Type
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled
                    aria-pressed="true"
                    className="flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium border-[var(--navy)] bg-blue-50 text-[var(--navy)] cursor-default opacity-90"
                  >
                    Omeza
                  </button>
                  <div className="flex-1" aria-hidden="true" />
                </div>
              </div>

              {/* Date of Service */}
              <div className="flex flex-col gap-1.5">
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
              <div className="flex flex-col gap-1.5">
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

            {/* Manual Input toggle — sits above Documents so the user sees the
                change in document requirements as soon as they toggle it on. */}
            <label
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all",
                manualInput
                  ? "border-[var(--navy)] bg-blue-50"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="checkbox"
                checked={manualInput}
                onChange={(e) => setManualInput(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--navy)] cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">
                  Manual input — fill all forms myself
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Skips AI extraction. Order Form, IVR, and HCFA/1500 stay blank
                  for you to complete manually. Document uploads become optional.
                </p>
              </div>
            </label>

            {/* Patient name — required only when manual input is active, since
                the AI flow otherwise extracts the patient from the facesheet. */}
            {manualInput && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Patient
                </h3>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={patientFirstName}
                      onChange={(e) => setPatientFirstName(e.target.value)}
                      className={cn(
                        "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)]",
                        patientFirstNameError ? "border-red-300 bg-red-50" : "border-slate-200",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={patientLastName}
                      onChange={(e) => setPatientLastName(e.target.value)}
                      className={cn(
                        "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)]",
                        patientLastNameError ? "border-red-300 bg-red-50" : "border-slate-200",
                      )}
                    />
                  </div>
                </div>
                {(patientFirstNameError || patientLastNameError) && (
                  <p className="text-xs text-red-500">
                    Patient first and last name are required for manual input.
                  </p>
                )}
              </div>
            )}

            {/* Section 2 — Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Documents {manualInput && <span className="text-slate-400 normal-case font-normal tracking-normal">(optional)</span>}
              </h3>

              {/* Facesheet + Clinical Docs side by side */}
              <div className="flex gap-3">
                <UploadZone
                  label="Patient Facesheet"
                  description="Insurance & demographics"
                  docType="facesheet"
                  required={docsRequired}
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                  error={facesheetError}
                  accept={ACCEPT_DOCS}
                  fileType="document"
                />
                <UploadZone
                  label="Clinical Documentation"
                  description="Doctor's notes, records"
                  docType="clinical_docs"
                  required={docsRequired}
                  multiple
                  files={docs}
                  onAdd={addDocs}
                  onRemove={removeDoc}
                  error={clinicalDocsError}
                  accept={ACCEPT_DOCS}
                  fileType="document"
                />
              </div>

              {facesheetError && (
                <p className="text-xs text-red-500">
                  Patient facesheet is required.
                </p>
              )}
              {clinicalDocsError && (
                <p className="text-xs text-red-500">
                  Clinical documentation is required.
                </p>
              )}

              {/* Wound Pictures — always optional */}
              <UploadZone
                label="Wound Pictures"
                description="Multiple images allowed"
                docType="wound_pictures"
                required={false}
                multiple
                files={docs}
                onAdd={addDocs}
                onRemove={removeDoc}
                accept={ACCEPT_IMAGES}
                fileType="image"
              />

              {/* Valid ID — government-issued photo ID for the patient.
                  Full-width to match Wound Pictures above. Required by
                  default; becomes optional when manual_input is checked
                  (same rules as Facesheet). Multiple files allowed for
                  front + back. */}
              <UploadZone
                label="Valid ID"
                description="Driver's license, passport, etc. (front + back)"
                docType="valid_id"
                required={docsRequired}
                multiple
                files={docs}
                onAdd={addDocs}
                onRemove={removeDoc}
                error={validIdError}
                accept={ACCEPT_DOCS}
                fileType="document"
              />
              {validIdError && (
                <p className="text-xs text-red-500">
                  Patient&apos;s valid ID is required.
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
