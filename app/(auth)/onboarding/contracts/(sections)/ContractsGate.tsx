"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, X, Type, PenLine, Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
  signProviderContractAsUser,
  signSalesRepContractAsUser,
  type ContractGateStatus,
} from "../(services)/actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import type { SalesRepContractKey } from "@/lib/pdf/sales-rep-contracts";
import type { ContractType } from "@/lib/pdf/sign-contract";

const CURSIVE_FONT =
  "'Segoe Script', 'Lucida Handwriting', 'Brush Script MT', cursive";

interface Props {
  status: ContractGateStatus;
  missingKeys: string[];
  email: string;
  firstName: string;
  lastName: string;
}

type SigTab = "type" | "draw" | "upload";

interface SigningTarget {
  audience: "sales_rep" | "provider";
  /** Slug for sales_rep; ContractType for provider. */
  key: string;
  label: string;
}

export function ContractsGate({
  status,
  missingKeys,
  firstName,
  lastName,
}: Props) {
  const fullName = `${firstName} ${lastName}`.trim();

  // Track signed state locally so the UI updates without a page reload.
  const [signedMap, setSignedMap] = useState<Record<string, string | null>>(
    () => {
      const initial: Record<string, string | null> = {};
      if (status.audience === "sales_rep") {
        for (const c of status.salesRep) initial[c.key] = c.signedUrl;
      } else {
        for (const c of status.provider) initial[c.type] = c.signedUrl;
      }
      return initial;
    },
  );

  const cards = useMemo(() => {
    if (status.audience === "sales_rep") {
      return status.salesRep.map((c) => ({
        audience: "sales_rep" as const,
        key: c.key,
        label: c.label,
        sourceUrl: c.sourceUrl,
      }));
    }
    return status.provider.map((c) => ({
      audience: "provider" as const,
      key: c.type,
      label: c.label,
      sourceUrl: c.sourceUrl,
    }));
  }, [status]);

  const allSigned = cards.every((c) => Boolean(signedMap[c.key]));

  const [signing, setSigning] = useState<SigningTarget | null>(null);

  function handleSigned(target: SigningTarget, signedUrl: string | undefined) {
    setSignedMap((prev) => ({ ...prev, [target.key]: signedUrl ?? "" }));
    setSigning(null);
    toast.success(`${target.label} signed.`);
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#E2E8F0] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#0F172A]">
            Required Onboarding Documents
          </h1>
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            Before you can use the portal, please review and sign each of the
            documents below. {fullName ? `Welcome, ${fullName}.` : ""}
          </p>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            {cards.length - missingKeys.length} of {cards.length} signed
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs text-[#64748B] underline hover:text-[#0F172A] whitespace-nowrap"
        >
          Sign out
        </button>
      </div>

      <div className="px-6 py-5 space-y-6">
        {cards.map((c, idx) => {
          const signed = Boolean(signedMap[c.key]);
          const previewUrl = signedMap[c.key] || c.sourceUrl;
          return (
            <div key={c.key} className="space-y-3">
              {idx > 0 && <div className="border-t border-[#E2E8F0]" />}
              <div className="flex items-center justify-between gap-3 pt-3">
                <h3 className="text-sm font-medium text-[#0F172A]">
                  {c.label}
                  {!signed && <span className="text-red-400 ml-1">*</span>}
                </h3>
                {signed && (
                  <span className="flex items-center gap-1 text-xs text-[#15803D] font-medium">
                    <Check className="w-4 h-4" /> Signed
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full h-[380px] md:h-[520px]"
                  title={c.label}
                />
              </div>
              {!signed && (
                <button
                  type="button"
                  onClick={() =>
                    setSigning({
                      audience: c.audience,
                      key: c.key,
                      label: c.label,
                    })
                  }
                  className="inline-flex items-center gap-2 bg-[var(--navy)] hover:bg-[#0f4f7a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Review &amp; Sign {c.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-end">
        <a
          href="/dashboard"
          aria-disabled={!allSigned}
          onClick={(e) => {
            if (!allSigned) e.preventDefault();
          }}
          className={`inline-flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-colors ${
            allSigned
              ? "bg-[#15803D] hover:bg-[#166534] text-white"
              : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed"
          }`}
        >
          {allSigned ? "Continue to dashboard →" : "Sign all documents to continue"}
        </a>
      </div>

      {signing && (
        <SignModal
          target={signing}
          defaultName={fullName}
          onClose={() => setSigning(null)}
          onSigned={(url) => handleSigned(signing, url)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Self-contained signing modal — captures name (and title for provider),
 *  signature via type/draw/upload, then calls the appropriate user-keyed
 *  server action. Deliberately simpler than the invite-signup modals
 *  because gate users don't need to fill AcroForm fields (sales rep contracts
 *  with `fields: []` like DME work via append-page; legacy contracts with
 *  fields would need the rep's prior data, which we don't have post-login —
 *  so the gate is most useful for the DME-only case in practice).
 *
 *  For sales-rep contracts that DO have fields (Code of Conduct, Conflict of
 *  Interest, Hep B, I-9, TB Risk, W-9), this modal sends `formData = {}`,
 *  which means those fields will not be filled. Signing still works and
 *  produces a signature stamp + flatten. If the client wants those fields
 *  pre-filled for legacy users, that's a future enhancement.
 * ──────────────────────────────────────────────────────────────────────── */

interface SignModalProps {
  target: SigningTarget;
  defaultName: string;
  onClose: () => void;
  onSigned: (signedUrl: string | undefined) => void;
}

function SignModal({ target, defaultName, onClose, onSigned }: SignModalProps) {
  const [tab, setTab] = useState<SigTab>("type");
  const [typedName, setTypedName] = useState(defaultName);
  const [typedTitle, setTypedTitle] = useState("");
  const [typedSig, setTypedSig] = useState(defaultName);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawDirtyRef = useRef(false);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsTitle = target.audience === "provider";

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
    ctx.fillText(typedSig || typedName, 16, canvas.height / 2);
    return trimCanvasToDataUrl(canvas);
  }

  function drawnToDataUrl(): string | null {
    if (!drawDirtyRef.current) return null;
    const c = drawCanvasRef.current;
    return c ? trimCanvasToDataUrl(c) : null;
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!typedName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (needsTitle && !typedTitle.trim()) {
      toast.error("Please enter your title.");
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
    let result;
    if (target.audience === "provider") {
      result = await signProviderContractAsUser({
        contractType: target.key as ContractType,
        typedName: typedName.trim(),
        typedTitle: typedTitle.trim(),
        signatureMethod: tab,
        signatureDataUrl,
      });
    } else {
      result = await signSalesRepContractAsUser({
        contractKey: target.key as SalesRepContractKey,
        typedName: typedName.trim(),
        signatureMethod: tab,
        signatureDataUrl,
        formData: {},
      });
    }
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to sign document.");
      return;
    }
    onSigned(result.signedUrl);
  }

  function tabBtn(key: SigTab, Icon: typeof Type, label: string) {
    return (
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
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">
              Sign {target.label}
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Confirm your name{needsTitle ? " and title" : ""}, then sign below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#475569]">
              Printed Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:border-[var(--navy)] focus:outline-none"
            />
          </div>
          {needsTitle && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#475569]">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={typedTitle}
                onChange={(e) => setTypedTitle(e.target.value)}
                placeholder="e.g. MD, Practice Manager, Owner"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:border-[var(--navy)] focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#475569]">Signature</p>
            <div className="flex items-center gap-2">
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
                  placeholder="Your name"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:border-[var(--navy)] focus:outline-none"
                />
                <div
                  className="h-20 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center text-2xl text-[#0f2d4a]"
                  style={{ fontFamily: CURSIVE_FONT }}
                >
                  {typedSig || "Type your name above"}
                </div>
              </div>
            )}
            {tab === "draw" && (
              <DrawCanvas
                ref={drawCanvasRef}
                onChange={() => {
                  drawDirtyRef.current = true;
                }}
              />
            )}
            {tab === "upload" && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleUpload}
                  className="block w-full text-xs text-[#475569] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#0f2d4a] file:text-white"
                />
                {uploadDataUrl && (
                  <img
                    src={uploadDataUrl}
                    alt="Signature preview"
                    className="h-20 rounded-lg border border-[#E2E8F0] bg-white object-contain"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#64748B] hover:text-[#0F172A] px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-[var(--navy)] hover:bg-[#0f4f7a] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign &amp; Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

interface DrawCanvasProps {
  ref: React.RefObject<HTMLCanvasElement | null>;
  onChange: () => void;
}

function DrawCanvas({ ref, onChange }: DrawCanvasProps) {
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f2d4a";
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!(e.buttons & 1)) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    onChange();
  }
  function clear() {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }
  return (
    <div className="space-y-1">
      <canvas
        ref={ref}
        width={600}
        height={140}
        className="w-full h-32 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
      />
      <button
        type="button"
        onClick={clear}
        className="text-xs text-[#64748B] underline hover:text-[#0F172A]"
      >
        Clear
      </button>
    </div>
  );
}
