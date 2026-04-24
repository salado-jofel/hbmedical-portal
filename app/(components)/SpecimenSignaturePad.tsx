"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";

const CURSIVE_FONT =
  "'Segoe Script', 'Lucida Handwriting', 'Brush Script MT', cursive";

type Tab = "type" | "draw" | "upload";

export interface SpecimenSignaturePadHandle {
  /** Returns a PNG data URL of the current signature, or null if empty. */
  getDataUrl: () => string | null;
  /** True when the pad has no content. */
  isEmpty: () => boolean;
  /** Clears all three tabs back to empty. */
  clear: () => void;
}

interface SpecimenSignaturePadProps {
  /** Default value for the typed-signature field (e.g. provider's name). */
  defaultName?: string;
  /** Disables all controls. */
  disabled?: boolean;
  /** Fires true when the pad transitions from empty → has-content or vice versa. */
  onDirtyChange?: (hasContent: boolean) => void;
  className?: string;
}

/**
 * Three-tab signature pad — Type / Draw / Upload. Produces a PNG data URL
 * via imperative handle so the parent only materializes the image on
 * commit (no data-url churn on every keystroke).
 *
 * Extracted from ContractSignModal so the onboarding signing flow and the
 * order-signing flow render the same UI.
 */
export const SpecimenSignaturePad = forwardRef<
  SpecimenSignaturePadHandle,
  SpecimenSignaturePadProps
>(function SpecimenSignaturePad(
  { defaultName = "", disabled = false, onDirtyChange, className },
  ref,
) {
  const [tab, setTab] = useState<Tab>("type");
  const [typedSig, setTypedSig] = useState(defaultName);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawDirtyRef = useRef(false);

  useEffect(() => {
    setTypedSig(defaultName);
  }, [defaultName]);

  // Track whether anything's captured so the parent can enable its Continue
  // button. Checked every render by re-computing per-tab presence.
  const hasContent =
    tab === "type"
      ? typedSig.trim().length > 0
      : tab === "draw"
        ? drawDirtyRef.current
        : !!uploadDataUrl;

  useEffect(() => {
    onDirtyChange?.(hasContent);
  }, [hasContent, onDirtyChange]);

  function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width,
      minY = height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return canvas.toDataURL("image/png");
    const pad = 4;
    const cx = Math.max(0, minX - pad);
    const cy = Math.max(0, minY - pad);
    const cw = Math.min(width - cx, maxX - minX + 1 + pad * 2);
    const ch = Math.min(height - cy, maxY - minY + 1 + pad * 2);
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  }

  function typedToDataUrl(): string | null {
    const text = typedSig.trim();
    if (!text) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 140;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f2d4a";
    ctx.font = `56px ${CURSIVE_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 16, canvas.height / 2);
    return trimCanvasToDataUrl(canvas);
  }

  function drawnToDataUrl(): string | null {
    if (!drawDirtyRef.current) return null;
    const c = drawCanvasRef.current;
    return c ? trimCanvasToDataUrl(c) : null;
  }

  function handleDrawStart(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#0f2d4a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const rect = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - rect.left) / rect.width) * c.width,
      ((e.clientY - rect.top) / rect.height) * c.height,
    );
  }

  function handleDrawMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    if (e.buttons !== 1) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(
      ((e.clientX - rect.left) / rect.width) * c.width,
      ((e.clientY - rect.top) / rect.height) * c.height,
    );
    ctx.stroke();
    drawDirtyRef.current = true;
  }

  function clearDraw() {
    const c = drawCanvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    drawDirtyRef.current = false;
    onDirtyChange?.(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Upload must be a PNG or JPG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large (max 2 MB).");
      return;
    }
    const rawUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = rawUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    // Luminance-key: white → transparent; black → opaque. Preserves
    // anti-aliased edges without leaving a gray halo.
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i],
        g = p[i + 1],
        b = p[i + 2];
      const maxC = Math.max(r, g, b);
      let a = 255 - maxC;
      if (a < 12) a = 0;
      p[i + 3] = a;
    }
    ctx.putImageData(data, 0, 0);
    setUploadDataUrl(trimCanvasToDataUrl(canvas));
  }

  useImperativeHandle(
    ref,
    () => ({
      getDataUrl: () => {
        if (tab === "type") return typedToDataUrl();
        if (tab === "draw") return drawnToDataUrl();
        return uploadDataUrl;
      },
      isEmpty: () => !hasContent,
      clear: () => {
        setTypedSig("");
        setUploadDataUrl(null);
        clearDraw();
        onDirtyChange?.(false);
      },
    }),
    [tab, typedSig, uploadDataUrl, hasContent, onDirtyChange],
  );

  const tabButton = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      disabled={disabled}
      className={cn(
        "flex-1 text-[12px] font-medium py-1.5 rounded transition-colors",
        tab === t
          ? "bg-[var(--navy)] text-white"
          : "bg-[var(--bg)] text-[var(--text2)] hover:bg-[var(--border)]",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-md">
        {tabButton("type", "Type")}
        {tabButton("draw", "Draw")}
        {tabButton("upload", "Upload")}
      </div>

      {tab === "type" && (
        <div className="space-y-2">
          <input
            type="text"
            value={typedSig}
            onChange={(e) => setTypedSig(e.target.value)}
            disabled={disabled}
            placeholder="Type your signature"
            className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--navy)]"
          />
          <div
            className="h-20 rounded-md border border-dashed border-[var(--border)] bg-white flex items-center justify-center overflow-hidden px-3"
          >
            <span
              style={{
                fontFamily: CURSIVE_FONT,
                fontSize: 32,
                color: "#0f2d4a",
                lineHeight: 1,
              }}
              className="truncate"
            >
              {typedSig || (
                <span className="text-[#ccc] font-sans text-[13px] italic">
                  Preview
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {tab === "draw" && (
        <div className="space-y-1.5">
          <canvas
            ref={drawCanvasRef}
            width={600}
            height={140}
            onPointerDown={handleDrawStart}
            onPointerMove={handleDrawMove}
            className={cn(
              "w-full h-32 rounded-md border border-dashed border-[var(--border)] bg-white",
              disabled ? "cursor-not-allowed" : "cursor-crosshair",
            )}
            style={{ touchAction: "none" }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[var(--text3)] italic">
              Draw with your mouse or finger.
            </span>
            <button
              type="button"
              onClick={clearDraw}
              disabled={disabled}
              className="text-[11px] text-[var(--text2)] hover:text-[var(--navy)] underline underline-offset-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleUpload}
            disabled={disabled}
            className="block w-full text-[12px] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[var(--navy)] file:text-white file:text-[11px] file:font-medium hover:file:bg-[var(--navy)]/80"
          />
          <div className="h-20 rounded-md border border-dashed border-[var(--border)] bg-white flex items-center justify-center overflow-hidden">
            {uploadDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadDataUrl}
                alt="Uploaded signature"
                className="max-h-16 object-contain"
              />
            ) : (
              <span className="text-[#ccc] text-[13px] italic">
                PNG or JPG — max 2 MB
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
