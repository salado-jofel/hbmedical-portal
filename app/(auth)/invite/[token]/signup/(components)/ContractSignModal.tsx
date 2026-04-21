"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Type, PenLine, Upload, Check } from "lucide-react";
import toast from "react-hot-toast";
import { signContract } from "../(services)/actions";

type Tab = "type" | "draw" | "upload";

interface ContractSignModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  contractType: "baa" | "product_services";
  contractLabel: string;
  defaultName: string;
  defaultTitle: string;
  onSigned: (signedUrl: string | undefined) => void;
}

const CURSIVE_FONT = "'Segoe Script', 'Lucida Handwriting', 'Brush Script MT', cursive";

export function ContractSignModal({
  open,
  onClose,
  token,
  contractType,
  contractLabel,
  defaultName,
  defaultTitle,
  onSigned,
}: ContractSignModalProps) {
  const [tab, setTab] = useState<Tab>("type");
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState(defaultTitle);
  const [typedSig, setTypedSig] = useState(defaultName);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawDirtyRef = useRef(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setTab("type");
      setName(defaultName);
      setTitle(defaultTitle);
      setTypedSig(defaultName);
      setUploadDataUrl(null);
      drawDirtyRef.current = false;
      const c = drawCanvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }
  }, [open, defaultName, defaultTitle]);

  function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
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

  function typedToDataUrl(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 140;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f2d4a";
    ctx.font = `56px ${CURSIVE_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(typedSig || name, 16, canvas.height / 2);
    return trimCanvasToDataUrl(canvas);
  }

  function drawnToDataUrl(): string | null {
    if (!drawDirtyRef.current) return null;
    const c = drawCanvasRef.current;
    return c ? trimCanvasToDataUrl(c) : null;
  }

  function handleDrawStart(e: React.PointerEvent<HTMLCanvasElement>) {
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
    // Load into a canvas, knock out near-white pixels (signatures photographed
    // on paper / exported as JPG have opaque white backgrounds), then trim.
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
    // Luminance-key: treat the image like a Photoshop Multiply layer.
    //   white pixel     → alpha 0 (fully transparent)
    //   black pixel     → alpha 255 (fully opaque)
    //   gray pixel      → proportional alpha (keeps anti-aliased stroke edges
    //                     without leaving a light-gray halo around the ink)
    // Pixels with alpha < 12 are clamped to 0 to kill JPG-compression speckle
    // that would otherwise render as a faint rectangle around the signature.
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const maxC = Math.max(r, g, b);
      let a = 255 - maxC;
      if (a < 12) a = 0;
      p[i + 3] = a;
    }
    ctx.putImageData(data, 0, 0);
    setUploadDataUrl(trimCanvasToDataUrl(canvas));
  }

  async function handleSign() {
    if (!name.trim() || !title.trim()) {
      toast.error("Name and title are required.");
      return;
    }
    let signatureDataUrl: string | null = null;
    if (tab === "type") {
      if (!typedSig.trim()) {
        toast.error("Type your signature.");
        return;
      }
      signatureDataUrl = typedToDataUrl();
    } else if (tab === "draw") {
      signatureDataUrl = drawnToDataUrl();
      if (!signatureDataUrl) {
        toast.error("Draw your signature.");
        return;
      }
    } else {
      if (!uploadDataUrl) {
        toast.error("Upload a signature image.");
        return;
      }
      signatureDataUrl = uploadDataUrl;
    }

    setSubmitting(true);
    const result = await signContract({
      token,
      contractType,
      typedName: name.trim(),
      typedTitle: title.trim(),
      signatureMethod: tab,
      signatureDataUrl,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to sign contract.");
      return;
    }
    toast.success(`${contractLabel} signed.`);
    onSigned(result.signedUrl);
    onClose();
  }

  if (!open) return null;

  const tabBtn = (key: Tab, Icon: typeof Type, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        tab === key
          ? "bg-[var(--navy)] text-white"
          : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
          <h3 className="text-sm font-semibold text-[#0F172A]">Sign {contractLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
              />
            </label>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Signature</span>
            <div className="flex gap-2 mb-3">
              {tabBtn("type", Type, "Type")}
              {tabBtn("draw", PenLine, "Draw")}
              {tabBtn("upload", Upload, "Upload")}
            </div>

            {tab === "type" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={typedSig}
                  onChange={(e) => setTypedSig(e.target.value)}
                  placeholder="Type your name"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
                />
                <div
                  className="h-24 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-4 text-[32px] text-[#0F172A]"
                  style={{ fontFamily: CURSIVE_FONT }}
                >
                  {typedSig || (
                    <span className="text-sm text-[#94A3B8] font-sans">Preview</span>
                  )}
                </div>
              </div>
            )}

            {tab === "draw" && (
              <div className="space-y-2">
                <canvas
                  ref={drawCanvasRef}
                  width={600}
                  height={200}
                  onPointerDown={handleDrawStart}
                  onPointerMove={handleDrawMove}
                  className="w-full h-32 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] cursor-crosshair touch-none"
                />
                <button
                  type="button"
                  onClick={clearDraw}
                  className="text-xs text-[#64748B] hover:text-[#0F172A] underline"
                >
                  Clear
                </button>
              </div>
            )}

            {tab === "upload" && (
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer hover:border-[var(--navy)]/40 transition-colors">
                  {uploadDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={uploadDataUrl} alt="Signature" className="max-h-28 object-contain" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[#94A3B8]" />
                      <span className="mt-1 text-xs text-[#64748B]">PNG or JPG, max 2 MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSign}
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 text-white font-medium text-sm py-2.5 flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Sign and continue
          </button>
        </div>
      </div>
    </div>
  );
}
