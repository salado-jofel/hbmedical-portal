"use client";

/**
 * IVRUploadView — alternative IVR shape (vs. the in-portal IVRFormDocument).
 *
 * Behavior:
 *   - Always rendered at the top of the IVR tab.
 *   - Uploading the first file replaces the built IVR (server-side wipe of
 *     all form columns + ivr_mode flip). If the built form has data, a
 *     confirmation modal warns first.
 *   - Subsequent uploads are non-destructive (mode already 'uploaded').
 *   - Deleting the last uploaded file flips ivr_mode back to 'built' so
 *     the empty built form reappears below.
 *   - "Mark IVR Complete" locks the IVR (equivalent to signing the built
 *     form). After that, deletes/uploads are disallowed.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  prepareOrderDocumentUpload,
  completeOrderDocumentUpload,
  deleteOrderDocument,
} from "../(services)/order-document-actions";
import { switchIvrMode } from "../(services)/order-ivr-actions";
import { SwitchIvrModeModal } from "./SwitchIvrModeModal";
import { DeleteIvrUploadModal } from "./DeleteIvrUploadModal";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import type { DashboardOrder, IOrderIVR } from "@/utils/interfaces/orders";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx,.gif,.webp";
const MAX_MB = 25;

interface IVRUploadViewProps {
  order: DashboardOrder;
  /** True when the IVR is locked. Per Dr. Ben (2026-06-26) this is now
   *  derived from order_status only — once the order is at
   *  manufacturer_review or beyond, uploads can't be added, removed, or
   *  modified. Until then the user can freely change their mind. */
  isLocked: boolean;
  /** Whether the current user can edit (clinic + admin + support, plus
   *  status-aware lock from the parent). */
  canEdit: boolean;
  /** Used to detect if the built-form fields have user data — drives the
   *  wipe-confirmation modal on the first upload. */
  ivrData: Partial<IOrderIVR> | null;
  /** Parent reload hook — fires after upload/delete/mark-complete so the
   *  fresh ivrData propagates back through OrderDetailModal. */
  onChange?: () => void | Promise<void>;
  /** Signals the parent how many docs are currently attached so it can
   *  decide whether to render the built form below. */
  onDocCountChange?: (count: number) => void;
  /** Optimistic removal — OrderDetailModal's localDocuments doesn't
   *  auto-refresh after we delete a doc here, so the chip would stay
   *  green pointing at a deleted storage path. Calling this on delete
   *  lets the parent drop the row from localDocuments immediately. */
  onUploadDeleted?: (docId: string) => void;
  /** Optimistic add — same idea as onUploadDeleted but for new uploads,
   *  so the IVR Form chip turns green right away without waiting for a
   *  full order refresh. */
  onUploadAdded?: (doc: {
    id: string;
    documentType: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
    fileSize: number;
  }) => void;
}

interface UploadedDoc {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
}

/** Returns true if any meaningful user-entered field is set on the built
 *  IVR form. Used to decide whether to show the "wipe confirmation" modal
 *  before the first upload. AI-extracted fields count as "user data" too
 *  — clinicians won't want them silently dropped. */
function hasBuiltFormData(ivr: Partial<IOrderIVR> | null): boolean {
  if (!ivr) return false;
  const fields: Array<unknown> = [
    ivr.insuranceProvider,
    ivr.memberId,
    ivr.subscriberName,
    ivr.patientName,
    ivr.patientPhone,
    ivr.patientAddress,
    ivr.physicianName,
    ivr.physicianNpi,
    ivr.facilityName,
    ivr.facilityAddress,
    ivr.placeOfService,
    ivr.icd10Codes,
    ivr.productInformation,
    ivr.priorAuthNumber,
    ivr.salesRepName,
    ivr.medicareAdminContractor,
    ivr.facilityNpi,
    ivr.facilityTin,
  ];
  return fields.some((v) => typeof v === "string" && v.trim().length > 0);
}

export function IVRUploadView({
  order,
  isLocked,
  canEdit,
  ivrData,
  onChange,
  onDocCountChange,
  onUploadDeleted,
  onUploadAdded,
}: IVRUploadViewProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  // Pending file list captured when the user picked files but we still
  // need to show the wipe-confirmation modal. Resolved on confirm/cancel.
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Doc the user clicked the trash icon on — drives DeleteIvrUploadModal.
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<UploadedDoc | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // Stable Supabase client — createClient() returns a new instance on
  // every render, which would force fetchDocs/useEffect to re-fire and
  // re-show the "Loading uploads…" skeleton on every parent re-render.
  const supabase = useMemo(() => createClient(), []);
  // Latest onDocCountChange in a ref so fetchDocs doesn't depend on a
  // prop reference that changes every render (parent passes an inline
  // arrow). Same trick avoids gratuitous re-fetches.
  const onDocCountChangeRef = useRef(onDocCountChange);
  useEffect(() => {
    onDocCountChangeRef.current = onDocCountChange;
  }, [onDocCountChange]);

  const dbMode = ivrData?.ivrMode ?? "built";

  // Show the skeleton only on the very first fetch — subsequent re-fetches
  // (after upload/delete/realtime) should just swap the row list silently
  // so opening/closing the document viewer doesn't flash the skeleton.
  const initialLoadDone = useRef(false);

  const fetchDocs = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    const { data, error } = await supabase
      .from("order_documents")
      .select("id,file_name,file_path,mime_type,file_size,created_at")
      .eq("order_id", order.id)
      .eq("document_type", "uploaded_ivr")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[IVRUploadView] fetch failed:", error);
      setLoading(false);
      initialLoadDone.current = true;
      return;
    }
    const rows: UploadedDoc[] = (data ?? []).map((r) => ({
      id: r.id as string,
      fileName: r.file_name as string,
      filePath: r.file_path as string,
      mimeType: (r.mime_type as string) ?? null,
      fileSize: (r.file_size as number) ?? null,
      uploadedAt: r.created_at as string,
    }));
    setDocs(rows);
    onDocCountChangeRef.current?.(rows.length);
    // Signed URLs for inline preview (15-min TTL — short, PHI-adjacent).
    const urlMap: Record<string, string> = {};
    for (const d of rows) {
      const { data: signed } = await supabase.storage
        .from("order-documents")
        .createSignedUrl(d.filePath, 60 * 15);
      if (signed?.signedUrl) urlMap[d.id] = signed.signedUrl;
    }
    setPreviewUrls(urlMap);
    setLoading(false);
    initialLoadDone.current = true;
  }, [order.id, supabase]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  /** Runs after the user-confirmation step (if any). Performs the actual
   *  upload to Storage and registers each file in order_documents. */
  async function doUpload(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        const sizeMb = file.size / (1024 * 1024);
        if (sizeMb > MAX_MB) {
          toast.error(
            `${file.name} is ${sizeMb.toFixed(1)} MB — max ${MAX_MB} MB.`,
          );
          continue;
        }
        const prep = await prepareOrderDocumentUpload({
          orderId: order.id,
          documentType: "uploaded_ivr",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        if (
          !prep.success ||
          !prep.uploadToken ||
          !prep.filePath ||
          !prep.bucket
        ) {
          toast.error(
            prep.error ?? `Failed to prepare upload for ${file.name}.`,
          );
          continue;
        }
        const { error: uploadErr } = await supabase.storage
          .from(prep.bucket)
          .uploadToSignedUrl(prep.filePath, prep.uploadToken, file);
        if (uploadErr) {
          toast.error(`Upload failed for ${file.name}: ${uploadErr.message}`);
          continue;
        }
        const res = await completeOrderDocumentUpload({
          orderId: order.id,
          documentType: "uploaded_ivr",
          bucket: prep.bucket,
          filePath: prep.filePath,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        });
        if (!res.success) {
          toast.error(res.error ?? "Failed to register upload.");
          continue;
        }
        if (res.document) {
          // Push optimistically into the parent's localDocuments so the
          // IVR Form chip flips green and the viewer can open the new
          // file without waiting for a full order refresh.
          onUploadAdded?.({
            id: res.document.id,
            documentType: res.document.documentType,
            fileName: res.document.fileName,
            filePath: res.document.filePath,
            mimeType: res.document.mimeType ?? null,
            fileSize: res.document.fileSize ?? file.size,
          });
        }
      }
      await fetchDocs();
      await onChange?.();
    } finally {
      setUploading(false);
    }
  }

  /** Entry point when the user picks files via the upload zone. Branches
   *  on whether the wipe-confirmation modal is needed. Only one IVR file
   *  is allowed at a time — if a file is already present, ignore further
   *  picks (the upload zone is hidden in that state anyway). */
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (docs.length > 0) {
      toast.error("Only one IVR file is allowed. Delete the current one first.");
      return;
    }
    // Take only the first picked file — defense in depth, the input is
    // single-select but multi-file drag/drop can still land here.
    const fileList = [files[0]];

    // If we're already in uploaded mode, no destructive switch needed.
    if (dbMode === "uploaded") {
      void doUpload(fileList);
      return;
    }
    // dbMode === "built" — destructive switch ahead. Warn only if the
    // built form actually has user data; otherwise switch silently.
    if (!hasBuiltFormData(ivrData)) {
      setSwitching(true);
      try {
        const res = await switchIvrMode(order.id, "uploaded");
        if (!res.success) {
          toast.error(res.error ?? "Failed to switch to upload mode.");
          return;
        }
        await onChange?.();
        await doUpload(fileList);
      } finally {
        setSwitching(false);
      }
      return;
    }
    // Built form has data — open confirmation modal. doUpload runs on
    // confirm (handleConfirmSwitch below).
    setPendingFiles(fileList);
    setConfirmOpen(true);
  }

  async function handleConfirmSwitch() {
    if (!pendingFiles) return;
    setSwitching(true);
    try {
      const res = await switchIvrMode(order.id, "uploaded");
      if (!res.success) {
        toast.error(res.error ?? "Failed to switch to upload mode.");
        setConfirmOpen(false);
        setPendingFiles(null);
        return;
      }
      await onChange?.();
      setConfirmOpen(false);
      const filesToUpload = pendingFiles;
      setPendingFiles(null);
      await doUpload(filesToUpload);
    } finally {
      setSwitching(false);
    }
  }

  function handleCancelSwitch() {
    if (switching) return;
    setConfirmOpen(false);
    setPendingFiles(null);
  }

  function handleDelete(doc: UploadedDoc) {
    if (isLocked) {
      toast.error("IVR is locked — uploads cannot be deleted.");
      return;
    }
    setPendingDeleteDoc(doc);
  }

  async function handleConfirmDelete() {
    const doc = pendingDeleteDoc;
    if (!doc) return;
    setDeleting(true);
    try {
      const res = await deleteOrderDocument(doc.id, doc.filePath);
      if (!res.success) {
        toast.error(res.error ?? "Failed to delete.");
        return;
      }
      // Tell the parent to drop the row from localDocuments so the IVR
      // Form chip stops pointing at a now-deleted storage path.
      onUploadDeleted?.(doc.id);
      const remaining = docs.length - 1;
      // Last upload deleted → silently flip ivr_mode back to 'built' so
      // the empty built form re-appears below. switchIvrMode also tries
      // to delete any remaining uploaded_ivr docs (none here, just
      // deleted), which is a safe no-op.
      if (remaining === 0 && dbMode === "uploaded") {
        await switchIvrMode(order.id, "built");
      }
      await fetchDocs();
      await onChange?.();
      setPendingDeleteDoc(null);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancelDelete() {
    if (deleting) return;
    setPendingDeleteDoc(null);
  }

  const hasUploads = docs.length > 0;
  const busy = uploading || switching;

  return (
    <div className="py-3 space-y-4">
      {/* ── Lock banner (order moved past pending_signature) ── */}
      {isLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Order is under manufacturer review — IVR uploads are locked.
        </div>
      )}

      {/* ── Soft "ready" badge — purely informational. Lets the user know
           the IVR document is attached and the order is set up to submit,
           without implying anything is locked. Hidden when status-locked
           (the amber banner above takes over) or when no file is up yet. */}
      {!isLocked && hasUploads && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-[12px] text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          IVR document attached — order is ready for submission. You can still
          delete and re-upload anytime before review.
        </div>
      )}

      {/* ── Upload zone — hidden once an IVR file is attached (only one
           allowed at a time) or when the order is status-locked. To
           replace, the user deletes the existing file and re-uploads. ── */}
      {!isLocked && !hasUploads && (
        <label
          className={cn(
            "block border-2 border-dashed rounded-xl px-6 py-6 text-center transition-colors",
            canEdit && !busy
              ? "border-[var(--border)] hover:border-[var(--navy)] cursor-pointer bg-white"
              : "border-[var(--border)] opacity-60 cursor-not-allowed",
          )}
        >
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            className="sr-only"
            disabled={!canEdit || busy}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          {busy ? (
            <div className="flex items-center justify-center gap-2 text-[13px] text-[var(--text2)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {switching ? "Switching…" : "Uploading…"}
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--navy)]" />
              <p className="text-[13px] font-medium text-[var(--text)]">
                Upload completed IVR document
              </p>
              <p className="text-[11px] text-[var(--text3)] mt-1">
                Optional · PDF, DOC, DOCX, JPG, PNG, HEIC · max {MAX_MB} MB
              </p>
              <p className="text-[11px] text-[var(--text3)] mt-1">
                Uploading replaces the in-portal IVR form below.
              </p>
            </>
          )}
        </label>
      )}

      {/* ── File list ── */}
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text3)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading uploads…
        </div>
      ) : hasUploads ? (
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
            Uploaded {docs.length === 1 ? "file" : "files"}
          </h3>
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-white"
            >
              <FileText className="w-5 h-5 shrink-0 text-[var(--navy)] mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-[var(--text)] truncate">
                    {d.fileName}
                  </p>
                  {!isLocked && canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      className="shrink-0 text-[var(--text3)] hover:text-red-500 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text3)]">
                  {d.fileSize ? `${(d.fileSize / 1024).toFixed(0)} KB` : ""} ·
                  uploaded {new Date(d.uploadedAt).toLocaleString()}
                </p>
                {previewUrls[d.id] && (
                  <a
                    href={previewUrls[d.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-[12px] text-[var(--navy)] hover:underline"
                  >
                    View document
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Wipe-confirmation modal (first upload when built form has
           data). Re-uses the existing SwitchIvrModeModal so styling stays
           consistent with the rest of the app. ── */}
      <SwitchIvrModeModal
        open={confirmOpen}
        targetMode="uploaded"
        loading={switching}
        onConfirm={handleConfirmSwitch}
        onCancel={handleCancelSwitch}
      />

      {/* ── Delete-upload confirmation modal ── */}
      <DeleteIvrUploadModal
        open={pendingDeleteDoc !== null}
        fileName={pendingDeleteDoc?.fileName ?? ""}
        willRevertToBuilt={docs.length === 1 && dbMode === "uploaded"}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
