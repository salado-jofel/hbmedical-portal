"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Type, PenLine, Upload, Check, ChevronLeft, ChevronRight, Paperclip, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { signSalesRepContract, uploadSalesRepContractAttachment } from "../(services)/actions";
import type {
  ContractDef,
  FieldDef,
  SalesRepContractKey,
} from "@/lib/pdf/sales-rep-contracts";

type SigTab = "type" | "draw" | "upload";

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  contract: ContractDef;
  defaults?: Record<string, string>;
  onSigned: (signedUrl: string | undefined) => void;
}

const CURSIVE_FONT = "'Segoe Script', 'Lucida Handwriting', 'Brush Script MT', cursive";

function formatMask(raw: string, mask: "ssn" | "ein" | "phone" | "zip"): string {
  const digits = raw.replace(/\D/g, "");
  switch (mask) {
    case "ssn": {
      const a = digits.slice(0, 3);
      const b = digits.slice(3, 5);
      const c = digits.slice(5, 9);
      return [a, b, c].filter(Boolean).join("-");
    }
    case "ein": {
      const a = digits.slice(0, 2);
      const b = digits.slice(2, 9);
      return [a, b].filter(Boolean).join("-");
    }
    case "phone": {
      const a = digits.slice(0, 3);
      const b = digits.slice(3, 6);
      const c = digits.slice(6, 10);
      if (!a) return "";
      if (!b) return `(${a}`;
      if (!c) return `(${a}) ${b}`;
      return `(${a}) ${b}-${c}`;
    }
    case "zip":
      return digits.slice(0, 5);
  }
}

export function SalesRepContractSignModal({ open, onClose, token, contract, defaults, onSigned }: Props) {
  const totalSteps = contract.steps.length; // last step is always the signature step

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [tab, setTab] = useState<SigTab>("type");
  const [typedSig, setTypedSig] = useState("");
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawDirtyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm({ ...(defaults ?? {}) });
    setFiles({});
    setTab("type");
    setTypedSig(defaults?.name ?? defaults?.last_name ?? "");
    setUploadDataUrl(null);
    drawDirtyRef.current = false;
    const c = drawCanvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }, [open, defaults, contract.key]);

  const fieldsByStep = useMemo(() => {
    const groups: FieldDef[][] = Array.from({ length: totalSteps }, () => []);
    for (const f of contract.fields) {
      const idx = Math.min(f.step ?? 0, totalSteps - 2 < 0 ? 0 : totalSteps - 2);
      groups[idx].push(f);
    }
    return groups;
  }, [contract.fields, totalSteps]);

  const isSigStep = step === totalSteps - 1;
  const currentFields = isSigStep ? [] : fieldsByStep[step] ?? [];

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFile(key: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [key]: file }));
  }

  function validateCurrent(): string | null {
    for (const f of currentFields) {
      const visible = !f.showIf || f.showIf(form);
      if (!visible) continue;
      if (!f.required) continue;
      if (f.type === "file") {
        if (!files[f.key]) return `${f.label} is required.`;
      } else if (f.type === "checkbox") {
        if (form[f.key] !== "true") return `${f.label} must be checked.`;
      } else if (!(form[f.key]?.trim())) {
        return `${f.label} is required.`;
      }
    }
    return null;
  }

  function goNext() {
    const err = validateCurrent();
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  /* ── Signature helpers (shared canvas/trim logic) ── */

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
    out.width = cw; out.height = ch;
    out.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  }

  function typedToDataUrl(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 140;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f2d4a";
    ctx.font = `56px ${CURSIVE_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(typedSig || form.name || form.first_name || "", 16, canvas.height / 2);
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
    ctx.moveTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
  }

  function handleDrawMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
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
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Upload must be PNG or JPG."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image too large (max 2 MB)."); return; }
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
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      const maxC = Math.max(p[i], p[i + 1], p[i + 2]);
      let a = 255 - maxC;
      if (a < 12) a = 0;
      p[i + 3] = a;
    }
    ctx.putImageData(data, 0, 0);
    setUploadDataUrl(trimCanvasToDataUrl(canvas));
  }

  async function handleSubmit() {
    // Ensure earlier steps are valid (defensive — mirrors validateCurrent rules)
    for (let i = 0; i < totalSteps - 1; i++) {
      for (const f of fieldsByStep[i] ?? []) {
        const visible = !f.showIf || f.showIf(form);
        if (!visible) continue;
        if (!f.required) continue;
        if (f.type === "file") {
          if (!files[f.key]) { setStep(i); toast.error(`${f.label} is required.`); return; }
        } else if (f.type === "checkbox") {
          if (form[f.key] !== "true") { setStep(i); toast.error(`${f.label} must be checked.`); return; }
        } else if (!(form[f.key]?.trim())) {
          setStep(i); toast.error(`${f.label} is required.`); return;
        }
      }
    }
    let signatureDataUrl: string | null = null;
    if (tab === "type") {
      if (!typedSig.trim()) { toast.error("Type your signature."); return; }
      signatureDataUrl = typedToDataUrl();
    } else if (tab === "draw") {
      signatureDataUrl = drawnToDataUrl();
      if (!signatureDataUrl) { toast.error("Draw your signature."); return; }
    } else {
      if (!uploadDataUrl) { toast.error("Upload a signature image."); return; }
      signatureDataUrl = uploadDataUrl;
    }

    const name = (form.name || `${form.first_name ?? ""} ${form.last_name ?? ""}`.trim() || form.staff_member || "").trim();
    if (!name) { toast.error("Enter your name first."); return; }

    setSubmitting(true);

    // Upload any attachments first so we can pass their storage paths to the sign action
    const attachmentPaths: string[] = [];
    for (const [slot, file] of Object.entries(files)) {
      if (!file) continue;
      const fd = new FormData();
      fd.append("token", token);
      fd.append("contractKey", contract.key);
      fd.append("slot", slot);
      fd.append("file", file);
      const up = await uploadSalesRepContractAttachment(fd);
      if (!up.success || !up.path) {
        setSubmitting(false);
        toast.error(up.error ?? `Failed to upload ${slot}`);
        return;
      }
      attachmentPaths.push(up.path);
    }

    const result = await signSalesRepContract({
      token,
      contractKey: contract.key as SalesRepContractKey,
      typedName: name,
      signatureMethod: tab,
      signatureDataUrl,
      formData: form,
      attachmentPaths,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to sign document.");
      return;
    }
    toast.success(`${contract.label} signed.`);
    onSigned(result.signedUrl);
    onClose();
  }

  if (!open) return null;

  const tabBtn = (key: SigTab, Icon: typeof Type, label: string) => (
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Sign {contract.label}</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Step {step + 1} of {totalSteps} — {contract.steps[step]}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isSigStep && (
            <div className="space-y-3">
              {currentFields.map((f) => {
                const visible = !f.showIf || f.showIf(form);
                if (!visible) return null;
                return (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={form[f.key] ?? ""}
                    onChange={(v) => setField(f.key, v)}
                    file={files[f.key] ?? null}
                    onFileChange={(file) => setFile(f.key, file)}
                  />
                );
              })}
            </div>
          )}

          {isSigStep && (
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-2">
                Signature
              </span>
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
                  <div className="h-24 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center px-4 text-[32px] text-[#0F172A]" style={{ fontFamily: CURSIVE_FONT }}>
                    {typedSig || <span className="text-sm text-[#94A3B8] font-sans">Preview</span>}
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
                  <button type="button" onClick={clearDraw} className="text-xs text-[#64748B] hover:text-[#0F172A] underline">
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
                    <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
          {isSigStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 text-white font-medium text-sm px-5 py-2 flex items-center gap-2 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Sign and continue
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium text-sm px-5 py-2 flex items-center gap-1 transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Field renderer ── */

function FieldInput({
  field,
  value,
  onChange,
  file,
  onFileChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  file?: File | null;
  onFileChange?: (file: File | null) => void;
}) {
  const common = {
    className:
      "w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20",
    placeholder: field.placeholder,
  };

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-2 cursor-pointer text-sm text-[#0F172A]">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="mt-1 accent-[var(--navy)]"
        />
        <span>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>
    );
  }

  if (field.type === "file") {
    const maxBytes = field.maxFileBytes ?? 5 * 1024 * 1024;
    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return onFileChange?.(null);
      if (f.size > maxBytes) {
        toast.error(`${field.label}: file must be ≤ ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
        e.target.value = "";
        return;
      }
      const accept = (field.accept ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (accept.length > 0 && !accept.includes(f.type)) {
        toast.error(`${field.label}: unsupported file type.`);
        e.target.value = "";
        return;
      }
      onFileChange?.(f);
    };
    return (
      <div>
        <span className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {file ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-[#0F172A] min-w-0">
              <Paperclip className="w-4 h-4 shrink-0 text-[var(--navy)]" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-[11px] text-[#94A3B8]">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
            </span>
            <button
              type="button"
              onClick={() => onFileChange?.(null)}
              className="text-[#94A3B8] hover:text-red-500 transition-colors"
              aria-label="Remove file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B] cursor-pointer hover:border-[var(--navy)]/40 transition-colors">
            <Paperclip className="w-4 h-4" />
            <span>Choose file (PDF, PNG, JPG — up to {((field.maxFileBytes ?? 5 * 1024 * 1024) / 1024 / 1024).toFixed(0)} MB)</span>
            <input
              type="file"
              accept={field.accept}
              onChange={handlePick}
              className="hidden"
            />
          </label>
        )}
        {field.helpText && <p className="mt-1 text-[11px] text-[#94A3B8]">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div>
        <span className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <div className="space-y-1.5">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-start gap-2 cursor-pointer text-sm text-[#0F172A]">
              <input
                type="radio"
                name={field.key}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="mt-1 accent-[var(--navy)]"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={common.className}
          placeholder={field.placeholder}
        />
      </label>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (field.type === "ssn") return onChange(formatMask(raw, "ssn"));
    if (field.type === "ein") return onChange(formatMask(raw, "ein"));
    if (field.type === "tel") return onChange(formatMask(raw, "phone"));
    onChange(raw);
  };

  const inputType =
    field.type === "email" ? "email" :
    field.type === "date" ? "date" :
    field.type === "tel" ? "tel" :
    "text";

  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input
        type={inputType}
        value={value}
        onChange={handleChange}
        maxLength={field.maxLength}
        {...common}
      />
      {field.helpText && <p className="mt-1 text-[11px] text-[#94A3B8]">{field.helpText}</p>}
    </label>
  );
}
