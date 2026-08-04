"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { finalizeIvrConversion } from "../../ivrs/(services)/actions";
import { attachIntakeToOrder } from "../../intake/(services)/actions";
import {
  prepareOrderDocumentUpload,
  completeOrderDocumentUpload,
  triggerOrderExtraction,
} from "../(services)/order-document-actions";
import { getOrderById } from "../(services)/order-read-actions";
import { addOrderToStore } from "../(redux)/orders-slice";
import { useAppDispatch } from "@/store/hooks";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/utils/helpers/compress-image";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import type { DocumentType } from "@/utils/interfaces/orders";
import { WOUND_TYPES, ORDER_TYPES } from "@/utils/constants/orders";

type DocFile = { file: File; type: string };

// Matches the server-side cap in order-document-actions.ts (MAX_DOCUMENT_SIZE_MB = 25).
// Phone-camera photos auto-compress in compress-image.ts before upload, so the
// 25 MB ceiling is the hard upper bound — a phone photo is rarely above 12 MB
// post-compression, but keeping client + server caps aligned avoids a confusing
// "file looked OK but server rejected it" UX.
const MAX_FILE_SIZE = 25 * 1024 * 1024;

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
  const hintText = fileType === "image" ? "JPG, PNG, HEIC · max 25 MB" : "PDF, JPG, PNG, HEIC · max 25 MB";

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
        toast.error(`${f.name} exceeds 25 MB.`);
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
                  toast.error(`${f.name} exceeds 25 MB.`);
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
                    toast.error(`${f.name} exceeds 25 MB.`);
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

interface CreateOrderModalProps {
  /** External control for the open state. When provided, the modal
   *  becomes controlled and the internal trigger button is hidden by
   *  default (unless hideTrigger is explicitly false). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hides the built-in "New Order" trigger button. Useful when opening
   *  the modal from another component (e.g. IVR detail modal). */
  hideTrigger?: boolean;
  /** When creating an order from an approved standalone IVR, pass the
   *  ID + a friendly label (usually the file name). This:
   *    - shows a blue "Creating from approved IVR: <label>" banner up top
   *    - pre-selects Skin Grafts as the order type and bypasses the
   *      normal Skin-Grafts direct-creation gate
   *    - after the order is created, calls finalizeIvrConversion() to
   *      link order_ivr → standalone_ivrs, copy the IVR PDF to
   *      order_documents, and flip the IVR to 'converted'. */
  fromStandaloneIvr?: {
    ivrId: string;
    label: string | null;
  };
  /** When creating an order from a fax intake: shows a "Building from
   *  fax X.pdf" banner, and after the order + user's uploads are done,
   *  attaches the intake PDF as a facesheet order_document and marks
   *  the intake row as converted_order. */
  fromIntake?: {
    intakeId: string;
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  };
  /** Selectable clinic facilities. Required for the fromIntake path:
   *  admin/support triaging a fax don't belong to a facility themselves,
   *  so createOrder can't derive facility_id from facility_members and
   *  the triager must pick which clinic owns the fax. Ignored in the
   *  standard flow — clinic staff always use their own facility. */
  facilities?: Array<{ id: string; name: string }>;
}

export function CreateOrderModal(props: CreateOrderModalProps = {}) {
  const { hideTrigger, fromStandaloneIvr, fromIntake, facilities } = props;
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = props.open !== undefined;
  const open = isControlled ? !!props.open : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) props.onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [woundType, setWoundType] = useState<"chronic" | "post_surgical" | "dfu" | "vlu">(
    "chronic",
  );
  // Order Type is now a user choice: Skin Grafts or DME Collagen
  // (Dr. Ben spec, 2026-06-18). The legacy "surgical_collagen" / "omeza"
  // values stay in the type union so existing orders typecheck downstream,
  // but aren't surfaced as buttons. Required at create time — submit
  // is gated on a non-null choice via `canSubmit` below.
  const [orderType, setOrderType] = useState<
    "skin_grafts" | "dme_collagen" | "surgical_collagen" | "omeza" | null
  >(fromStandaloneIvr ? "skin_grafts" : null);
  const [manualInput, setManualInput] = useState(false);
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientLastName, setPatientLastName] = useState("");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  // Facility picker — only rendered + required in the fromIntake path
  // (admin/support triaging a fax has no membership of their own, so
  // createOrder can't derive facility_id and needs the choice explicitly).
  // Auto-picks the only option when there's exactly one, to save a click.
  const [facilityId, setFacilityId] = useState<string>(() =>
    fromIntake && facilities?.length === 1 ? facilities[0].id : "",
  );
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setWoundType("chronic");
    // From-IVR mode always keeps skin_grafts preselected across resets,
    // since the whole point of the flow is to convert one specific IVR
    // into a Skin Grafts order.
    setOrderType(fromStandaloneIvr ? "skin_grafts" : null);
    setManualInput(false);
    setPatientFirstName("");
    setPatientLastName("");
    setDateOfService(new Date().toISOString().split("T")[0]);
    setNotes("");
    setFacilityId(fromIntake && facilities?.length === 1 ? facilities[0].id : "");
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

  // Facility is required only in the fromIntake path — admin/support
  // don't have a facility_members row so createOrder can't derive one
  // and would otherwise 500 on the NOT NULL constraint on
  // orders.facility_id.
  const facilityRequired = !!fromIntake;
  const canSubmit =
    !!orderType &&
    // Skin Grafts orders are blocked from direct creation — go through
    // the IVR workflow instead. When we're already IN the IVR-conversion
    // flow (fromStandaloneIvr set), the gate is bypassed since the IVR
    // approval upstream is what satisfies the compliance requirement.
    (orderType !== "skin_grafts" || !!fromStandaloneIvr) &&
    !!woundType &&
    !!dateOfService &&
    (!facilityRequired || !!facilityId) &&
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
        // Only forward when actually chosen — clinic staff never set
        // this, and their own facility is used by requireClinicRole.
        facility_id: facilityId || null,
      });

      if (!result.success || !result.orderId) {
        toast.error(result.error ?? "Failed to create order.");
        return;
      }

      const orderId = result.orderId;

      // Upload documents sequentially via direct browser → Supabase Storage.
      //
      // Bytes go BROWSER → SUPABASE STORAGE directly (signed-upload URL),
      // bypassing Vercel's 4.5 MB serverless request body cap that broke
      // phone-camera facesheet/valid_id uploads in production. The server
      // action only receives metadata + signs the URL, then we hand off the
      // file to `uploadToSignedUrl`, then call `completeOrderDocumentUpload`
      // to insert the order_documents row + write history.
      //
      // Image inputs (PNG/JPG) are compressed client-side first
      // (~1600 px longest edge, JPEG 0.85). Typical phone-camera ID photo:
      // 6 MB → ~400 KB, well within any limit and faster on mobile networks.
      // PDFs pass through unchanged (can't compress losslessly client-side).
      const supabase = createClient();
      const extractableDocs: Array<{ documentType: string; filePath: string }> = [];
      // Collect per-doc failures so we can surface a PERSISTENT summary
      // at the end. Ephemeral toasts inside the loop get covered by
      // subsequent progress/success toasts and vanish before the user
      // notices — that's the "Valid ID silently failed" mode Dr. Ben
      // reported. This array is the single source of truth for whether
      // to celebrate or warn on modal close.
      type UploadFailure = { docType: string; fileName: string; reason: string };
      const failures: UploadFailure[] = [];
      // Human-readable labels for the failure summary. Kept local so we
      // don't need to import from the shared constants file just for
      // this narrow use case.
      const DOC_TYPE_LABELS: Record<string, string> = {
        facesheet: "Facesheet",
        clinical_docs: "Clinical Docs",
        valid_id: "Valid ID",
        wound_pictures: "Wound Pictures",
        additional_ivr: "IVR Form",
        uploaded_ivr: "IVR Form",
        order_form: "Order Form",
        form_1500: "HCFA-1500",
      };

      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        setUploadProgress(`Uploading ${i + 1}/${docs.length}: ${d.file.name}`);
        try {
          const file = await compressImage(d.file);

          const prepared = await prepareOrderDocumentUpload({
            orderId,
            documentType: d.type as DocumentType,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          });
          if (
            !prepared.success ||
            !prepared.bucket ||
            !prepared.filePath ||
            !prepared.uploadToken
          ) {
            failures.push({
              docType: d.type,
              fileName: d.file.name,
              reason: prepared.error ?? "Could not prepare upload.",
            });
            continue;
          }

          const { error: uploadErr } = await supabase.storage
            .from(prepared.bucket)
            .uploadToSignedUrl(prepared.filePath, prepared.uploadToken, file, {
              contentType: file.type,
            });
          if (uploadErr) {
            console.error("[CreateOrderModal] storage upload:", uploadErr);
            failures.push({
              docType: d.type,
              fileName: d.file.name,
              reason: uploadErr.message ?? "Upload failed.",
            });
            continue;
          }

          const completed = await completeOrderDocumentUpload({
            orderId,
            documentType: d.type as DocumentType,
            bucket: prepared.bucket,
            filePath: prepared.filePath,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          });
          if (!completed.success || !completed.document) {
            failures.push({
              docType: d.type,
              fileName: d.file.name,
              reason: completed.error ?? "Could not save document.",
            });
            continue;
          }

          if (["facesheet", "clinical_docs"].includes(d.type)) {
            extractableDocs.push({
              documentType: d.type,
              filePath: completed.document.filePath,
            });
          }
        } catch (err) {
          // e.g., compressImage threw on a corrupt image, or the network
          // dropped mid-upload. Previously this uncaught-throw aborted
          // the whole loop silently; now it's captured per-doc so the
          // remaining docs still get their chance.
          console.error("[CreateOrderModal] upload threw:", err);
          failures.push({
            docType: d.type,
            fileName: d.file.name,
            reason:
              err instanceof Error ? err.message : "Unexpected upload error.",
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

      // If we're finishing an IVR conversion, wire the standalone_ivr →
      // order link now that the order + its uploads exist. Runs AFTER
      // the user's uploads so the linkage summary comes at the end and
      // any upload failures don't block the conversion (the IVR PDF and
      // ivr_mode='uploaded' are what actually matter for compliance).
      if (fromStandaloneIvr) {
        const link = await finalizeIvrConversion({
          ivrId: fromStandaloneIvr.ivrId,
          orderId,
        });
        if (!link.success) {
          toast.error(
            `Order created, but linking to the approved IVR failed: ${link.error ?? "unknown error"}. Open the order to attach the IVR manually.`,
            { duration: Infinity },
          );
        }
      }

      // If we're finishing a fax-intake conversion, attach the intake
      // PDF as a facesheet doc (metadata insert against the shared
      // storage path) and flip the intake row → converted_order. Same
      // "runs after user's uploads" reasoning.
      if (fromIntake) {
        // Attach the fax as the completed IVR document (default doctype
        // in attachIntakeToOrder). The server-side helper also flips
        // order_ivr.ivr_mode → 'uploaded' so the IVR Form tab shows the
        // fax as the source of truth. Facesheet / clinical docs / valid
        // ID are still uploaded separately above via the modal's own
        // UploadZones — the fax alone is not enough.
        const link = await attachIntakeToOrder({
          intakeId: fromIntake.intakeId,
          orderId,
        });
        if (!link.success) {
          toast.error(
            `Order created, but attaching the fax failed: ${link.error ?? "unknown error"}. Open the order to attach the fax manually.`,
            { duration: Infinity },
          );
        }
      }

      // Persistent (Infinity duration) failure summary. Lists every doc
      // that failed and the specific reason, so the user knows exactly
      // what to re-upload from the OrderDetailModal. Success toast only
      // fires when everything landed.
      if (failures.length > 0) {
        const succeeded = docs.length - failures.length;
        const lines = failures.map(
          (f) => `• ${DOC_TYPE_LABELS[f.docType] ?? f.docType} (${f.fileName}) — ${f.reason}`,
        );
        toast.error(
          `Order created, but ${failures.length} of ${docs.length} uploads failed.\n${lines.join("\n")}\n\nOpen the order to re-upload the missing files.`,
          { duration: Infinity },
        );
        // Also alert once so the user MUST dismiss before continuing —
        // toast on its own could still be missed on a distracted screen.
        if (typeof window !== "undefined") {
          window.alert(
            `Uploaded ${succeeded} of ${docs.length}. Missing:\n\n${lines.join("\n")}\n\nOpen the order to re-upload the missing files.`,
          );
        }
      } else {
        toast.success("Order created. All uploads confirmed.");
      }

      setOpen(false);
      reset();

      // Add to store and open detail modal immediately
      const fullOrder = await getOrderById(orderId);
      if (fullOrder) {
        dispatch(addOrderToStore(fullOrder));
      }

      // Routing: if we were on a different page (e.g. /dashboard/ivrs
      // for the from-IVR conversion flow), navigate to /dashboard/orders
      // with ?open=<id> — the Orders Kanban listens for that param and
      // opens the modal, then strips it from the URL so a refresh
      // doesn't re-open. On /dashboard/orders itself we dispatch the
      // in-page custom event, which is a bit snappier than a route push.
      const onOrdersPage =
        typeof window !== "undefined" &&
        window.location.pathname === "/dashboard/orders";
      if (onOrdersPage) {
        window.dispatchEvent(
          new CustomEvent("open-order-modal", {
            detail: { orderId, tab: "overview" },
          }),
        );
      } else {
        router.push(`/dashboard/orders?open=${orderId}`);
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

  // Auto-hide the internal trigger button whenever the parent is
  // controlling `open` — otherwise you'd get a duplicate "New Order"
  // button in whatever surface embedded us. Explicit hideTrigger can
  // also force it hidden even in uncontrolled mode.
  const showTrigger = !hideTrigger && !isControlled;

  return (
    <>
      {showTrigger && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white cursor-pointer rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border-[var(--border)] shadow-2xl p-0">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-[var(--border)]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[var(--navy)]">
                {fromStandaloneIvr
                  ? "Create Order from Approved IVR"
                  : fromIntake
                    ? "Create Order from Fax"
                    : "Create Order"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* From-IVR banner. Small, unobtrusive hint at the top of the
              body — everything else in the modal stays identical to the
              standard flow. The IVR file gets attached as uploaded_ivr
              via finalizeIvrConversion() after the order is saved. */}
          {fromStandaloneIvr && (
            <div className="px-6 pt-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[12.5px] text-green-900 flex items-start gap-2">
                <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Creating from approved IVR</p>
                  <p className="text-[11.5px] mt-0.5 leading-snug">
                    {fromStandaloneIvr.label
                      ? `${fromStandaloneIvr.label} will be attached to this order automatically.`
                      : "The approved IVR document will be attached to this order automatically."}{" "}
                    Order type is pre-set to <b>Skin Grafts</b>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* From-Fax banner — analogous hint for the fax-intake flow.
              Intake PDF is attached as a facesheet document post-save.
              Nothing about the docs section changes visually; users can
              upload additional clinical/valid-ID docs as usual.

              Facility picker sits right under the banner: admin/support
              triaging a fax don't belong to any facility, so the order's
              facility_id has to be picked explicitly here (otherwise the
              NOT NULL constraint on orders.facility_id blows the insert). */}
          {fromIntake && (
            <div className="px-6 pt-4 space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12.5px] text-blue-900 flex items-start gap-2">
                <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Creating from inbound fax</p>
                  <p className="text-[11.5px] mt-0.5 leading-snug">
                    <span className="font-medium">{fromIntake.fileName}</span>{" "}
                    will be attached as the completed <b>IVR document</b>{" "}
                    and shown in the order&apos;s IVR Form tab. Upload the
                    patient facesheet, clinical docs, and Valid ID below.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Clinic / Facility <span className="text-red-500">*</span>
                </label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className={cn(
                    "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)]",
                    submitted && !facilityId
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200",
                  )}
                >
                  <option value="">— Select the clinic this fax is for —</option>
                  {(facilities ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {submitted && !facilityId && (
                  <p className="text-xs text-red-500 mt-0.5">
                    Pick which clinic this fax belongs to.
                  </p>
                )}
                {(facilities?.length ?? 0) === 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    No clinics available to pick from. Add a facility before
                    building an order from this fax.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-5 space-y-6">
            {/* Section 1 — Clinical Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Clinical Info
              </h3>

              {/* Order Type — product category (Skin Grafts / DME Collagen).
                  Independent of Wound Type per Option A — any wound type can
                  be paired with any order type. Required to submit. Stored on
                  orders.order_type, gated by the orders_order_type_check
                  CHECK that accepts the two new values plus the legacy
                  surgical_collagen/omeza values for backward compat.
                  Inline error appears under the buttons once the user has
                  attempted Submit without picking — same UX pattern as
                  the other required fields below. */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Order Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ORDER_TYPES.map((ot) => (
                    <button
                      key={ot.value}
                      type="button"
                      onClick={() => setOrderType(ot.value)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all",
                        orderType === ot.value
                          ? "border-[var(--navy)] bg-blue-50 text-[var(--navy)]"
                          : submitted && !orderType
                            ? "border-red-300 bg-red-50/50 text-slate-600 hover:border-red-400"
                            : "border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {ot.label}
                    </button>
                  ))}
                </div>
                {submitted && !orderType && (
                  <p className="text-xs text-red-500 mt-0.5">
                    Please select an order type.
                  </p>
                )}
                {/* Skin Grafts gate (Dr. Ben spec 2026-07-02): Skin Grafts
                    orders must originate from an approved IVR — direct
                    creation is blocked here. The user is routed to the
                    IVR workflow. When we're already IN the IVR conversion
                    flow (fromStandaloneIvr), the gate is inverted — this
                    IS the approved-IVR path, so no warning. DME Collagen
                    keeps parallel creation. */}
                {orderType === "skin_grafts" && !fromStandaloneIvr && (
                  <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
                    <p className="font-semibold mb-1">
                      Skin Grafts orders start from an approved IVR
                    </p>
                    <p className="text-[11.5px] leading-snug">
                      Upload the completed IVR to{" "}
                      <a
                        href="/dashboard/ivrs"
                        className="underline font-medium hover:text-amber-800"
                      >
                        IVR Forms
                      </a>{" "}
                      and send it to an external approver. Once approved,
                      you can create the order from that IVR in one click.
                    </p>
                  </div>
                )}
              </div>

              {/* Wound Type — 2x2 grid: Chronic | Post-Surgical / DFU | VLU.
                  DFU and VLU are first-class wound types per Dr. Ben (matches
                  the Fortify workflow). Phase 1 ships the buttons + DB CHECK;
                  Phase 2 wires custom DFU/VLU form variants once the file
                  format arrives. In the interim DFU/VLU orders render the
                  chronic form template with the matching etiology pre-checked
                  and a banner noting the interim state. */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Wound Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {WOUND_TYPES.map((wt) => (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setWoundType(wt.value)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all",
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

              {/* Order Type UI is hidden — there's only one allowed value
                  ("omeza") and the disabled single-choice button was just
                  visual noise. The orderType state stays defaulted to
                  "omeza" so the server action still receives order_type and
                  downstream logic (PDF, exports, etc.) is unchanged. When
                  the client wants Order Type back as a user choice, restore
                  the toggle JSX here and add the additional options. */}

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

              {/* Wound Pictures — chronic only. Post-surgical wounds are
                  fresh surgical incisions where a wound photo isn't
                  clinically meaningful (matches the post-surgical hide
                  in OrderDetailModal sidebar + OrderFormDocument). */}
              {woundType !== "post_surgical" && (
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
              )}

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
