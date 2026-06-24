"use client";

/**
 * IVRUploadView — alternative IVR shape (vs. the in-portal IVRFormDocument).
 *
 * Workflow:
 *   1. Clinician picks a completed external IVR file (PDF, image, or doc)
 *   2. File uploads into Supabase Storage at order-documents/<orderId>/uploaded/
 *   3. A row is inserted into order_documents with document_type = additional_ivr
 *   4. Once at least one file is present, "Mark IVR Complete" enables and locks
 *      the IVR row (mirrors the Sign workflow for the built form)
 *   5. After lock, the upload becomes read-only and the file preview shows
 *
 * Switching back to "Built" mode is destructive (server action deletes all
 * uploaded additional_ivr docs). Confirmation modal sits in the parent IVRTab.
 */

import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  prepareOrderDocumentUpload,
  completeOrderDocumentUpload,
  deleteOrderDocument,
} from "../(services)/order-document-actions";
import { markIvrUploadedComplete } from "../(services)/order-ivr-actions";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx,.gif,.webp";
const MAX_MB = 25;

interface IVRUploadViewProps {
  order: DashboardOrder;
  /** Whether the IVR is already locked (Marked Complete). */
  isLocked: boolean;
  /** Whether the current user can edit (clinic + admin + support, plus
   *  status-aware lock from the parent). */
  canEdit: boolean;
  onChange?: () => void;
}

interface UploadedDoc {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
  signedUrl?: string;
}

export function IVRUploadView({
  order,
  isLocked,
  canEdit,
  onChange,
}: IVRUploadViewProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const supabase = createClient();

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_documents")
      .select("id,file_name,file_path,mime_type,file_size,created_at")
      .eq("order_id", order.id)
      .eq("document_type", "additional_ivr")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[IVRUploadView] fetch failed:", error);
      setLoading(false);
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
    // Generate signed URLs for inline preview (15-min TTL — short on
    // purpose since this is PHI-adjacent and the page is interactive).
    const urlMap: Record<string, string> = {};
    for (const d of rows) {
      const { data: signed } = await supabase.storage
        .from("order-documents")
        .createSignedUrl(d.filePath, 60 * 15);
      if (signed?.signedUrl) urlMap[d.id] = signed.signedUrl;
    }
    setPreviewUrls(urlMap);
    setLoading(false);
  }, [order.id, supabase]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const sizeMb = file.size / (1024 * 1024);
        if (sizeMb > MAX_MB) {
          toast.error(`${file.name} is ${sizeMb.toFixed(1)} MB — max ${MAX_MB} MB.`);
          continue;
        }
        // 1. Get a one-time signed upload URL from the server.
        const prep = await prepareOrderDocumentUpload({
          orderId: order.id,
          documentType: "additional_ivr",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        if (!prep.success || !prep.uploadToken || !prep.filePath || !prep.bucket) {
          toast.error(prep.error ?? `Failed to prepare upload for ${file.name}.`);
          continue;
        }
        // 2. Upload directly to Supabase Storage using the signed token.
        const { error: uploadErr } = await supabase.storage
          .from(prep.bucket)
          .uploadToSignedUrl(prep.filePath, prep.uploadToken, file);
        if (uploadErr) {
          toast.error(`Upload failed for ${file.name}: ${uploadErr.message}`);
          continue;
        }
        // 3. Register the upload in order_documents.
        const res = await completeOrderDocumentUpload({
          orderId: order.id,
          documentType: "additional_ivr",
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
      }
      await fetchDocs();
      onChange?.();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: UploadedDoc) {
    if (isLocked) {
      toast.error("IVR is locked — uploads cannot be deleted.");
      return;
    }
    if (
      !window.confirm(
        `Delete "${doc.fileName}"? The file will be removed from this order.`,
      )
    ) {
      return;
    }
    const res = await deleteOrderDocument(doc.id, doc.filePath);
    if (!res.success) {
      toast.error(res.error ?? "Failed to delete.");
      return;
    }
    await fetchDocs();
    onChange?.();
  }

  async function handleMarkComplete() {
    setMarking(true);
    try {
      const res = await markIvrUploadedComplete(order.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to mark complete.");
        return;
      }
      toast.success("IVR marked complete.");
      onChange?.();
    } finally {
      setMarking(false);
    }
  }

  const hasUploads = docs.length > 0;

  return (
    <div className="px-4 py-3 space-y-4">
      {/* ── Lock banner ── */}
      {isLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-[12px] text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          IVR uploaded and marked complete. The document is locked.
        </div>
      )}

      {/* ── Upload zone (hidden when locked) ── */}
      {!isLocked && (
        <div>
          <label
            className={cn(
              "block border-2 border-dashed rounded-xl px-6 py-8 text-center transition-colors",
              canEdit
                ? "border-[var(--border)] hover:border-[var(--navy)] cursor-pointer bg-white"
                : "border-[var(--border)] opacity-60 cursor-not-allowed",
            )}
          >
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="sr-only"
              disabled={!canEdit || uploading}
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-[13px] text-[var(--text2)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--navy)]" />
                <p className="text-[13px] font-medium text-[var(--text)]">
                  Upload completed IVR document
                </p>
                <p className="text-[11px] text-[var(--text3)] mt-1">
                  PDF, DOC, DOCX, JPG, PNG, HEIC · max {MAX_MB} MB · multiple files allowed
                </p>
              </>
            )}
          </label>
        </div>
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
                  {d.fileSize
                    ? `${(d.fileSize / 1024).toFixed(0)} KB`
                    : ""}{" "}
                  · uploaded {new Date(d.uploadedAt).toLocaleString()}
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
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text3)] italic">
          <AlertCircle className="w-4 h-4" />
          No IVR document uploaded yet.
        </div>
      )}

      {/* ── Mark Complete action ── */}
      {!isLocked && hasUploads && canEdit && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <p className="text-[11px] text-[var(--text3)] italic">
            Marking complete will lock the upload — equivalent to signing the
            built form.
          </p>
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={marking}
            className="px-4 py-2 rounded-lg bg-[var(--navy)] text-white text-[13px] font-medium hover:bg-[var(--navy)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {marking ? "Marking…" : "Mark IVR Complete"}
          </button>
        </div>
      )}
    </div>
  );
}
