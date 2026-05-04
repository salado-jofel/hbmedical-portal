"use client";

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ExternalLink, X } from "lucide-react";

interface DocumentViewerSheetProps {
  /** When non-null the sheet is open. Close via the X button or ESC; click
   *  outside is intentionally NOT a close trigger because the user often
   *  needs to click into the order form behind the sheet to edit it. */
  doc:
    | {
        label: string;
        url: string;
        mimeType: string | null;
        fileName: string;
      }
    | null;
  onClose: () => void;
}

/**
 * Right-slide doc viewer that lets the user keep editing the order form
 * underneath while reading a PDF/image. Built on Radix Dialog with
 * `modal={false}` so:
 *   - No focus trap → keyboard input still reaches the form
 *   - No backdrop overlay → form fields remain clickable behind the sheet
 *   - Outside clicks don't dismiss → user can interact with the form without
 *     accidentally closing the doc
 *
 * Close paths: X button in the header, ESC key, or clicking the original
 * doc card (parent toggles state).
 *
 * Format support:
 *  - application/pdf      → iframe (browser-native PDF viewer)
 *  - image/jpeg|png|webp  → <img> preview
 *  - image/heic + others  → fallback message + open-in-tab CTA
 */
export function DocumentViewerSheet({ doc, onClose }: DocumentViewerSheetProps) {
  const open = !!doc;

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  // Catch ESC at the document level in the capture phase BEFORE it bubbles
  // up to the underlying OrderDetailModal's Radix Dialog. Without this, ESC
  // closes both the sheet AND the modal underneath. We close the sheet here
  // and stop propagation so the parent dialog never sees the event.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
    >
      <DialogPrimitive.Portal>
        {/* No <Overlay /> — keeping the underlying OrderDetailModal
            interactive while the sheet is visible. */}
        <DialogPrimitive.Content
          // Marker so the parent OrderDetailModal's outside-click detector
          // can recognize this portal as "still inside" the order context
          // (don't close the order modal when the user clicks on the sheet).
          data-document-viewer-sheet
          // Prevent dismiss on outside interaction. The user clicking into
          // the form below is normal cross-reference behavior, not a close
          // intent.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          // Defer ESC to the capture-phase document listener above, which
          // closes us AND stops propagation. Without preventDefault here,
          // Radix's auto-close fires too early and the parent modal still
          // receives the bubbling event.
          onEscapeKeyDown={(e) => e.preventDefault()}
          // Don't grab focus on open — leaves the form's active field
          // focused so typing continues uninterrupted.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-y-0 right-0 z-50 h-full w-[50vw] max-w-[600px] bg-popover shadow-2xl border-l border-[var(--border)] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-200"
          // Hide an a11y warning about missing description.
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {doc?.label ?? "Document"}
          </DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-white">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[var(--text1)] truncate">
                {doc?.label ?? "Document"}
              </h2>
              {doc?.fileName && (
                <p
                  className="text-[11px] text-[var(--text3)] truncate"
                  title={doc.fileName}
                >
                  {doc.fileName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doc && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text2)] hover:bg-[var(--bg)] transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md w-7 h-7 text-[var(--text3)] hover:bg-[var(--bg)] hover:text-[var(--text1)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden bg-[#f4f4f5]">
            {doc ? <DocumentBody {...doc} /> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Renders the right viewer for a given mime type, with a fallback for formats
 * the browser can't preview inline (HEIC, unknown types, etc.).
 */
function DocumentBody({
  url,
  mimeType,
  fileName,
}: {
  url: string;
  mimeType: string | null;
  fileName: string;
}) {
  const mt = (mimeType ?? "").toLowerCase();

  if (mt === "application/pdf") {
    // `#navpanes=0` hides Chrome's left thumbnail strip so the PDF takes
    // the full sheet width — at 600px max width that strip would otherwise
    // squeeze the actual page render down to ~450px and make small text
    // unreadable. `toolbar=1` keeps the download/zoom controls.
    const pdfUrl = `${url}#navpanes=0&toolbar=1`;
    return (
      <iframe
        src={pdfUrl}
        title={fileName}
        className="w-full h-full bg-white"
      />
    );
  }

  if (
    mt === "image/jpeg" ||
    mt === "image/jpg" ||
    mt === "image/png" ||
    mt === "image/webp" ||
    mt === "image/gif"
  ) {
    return (
      <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  // HEIC + everything else — no inline preview available
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center gap-3">
      <p className="text-sm text-[var(--text2)]">
        This file format can&apos;t be previewed inline.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--navy)] text-white px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in new tab to view
      </a>
    </div>
  );
}
