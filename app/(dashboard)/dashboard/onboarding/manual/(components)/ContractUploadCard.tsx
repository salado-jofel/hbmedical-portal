"use client";

import { useRef } from "react";
import { FileCheck, FileUp, Loader2, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { OfflineContractDraft } from "@/utils/interfaces/manual-onboarding";
import { WizardField } from "./WizardField";

export function ContractUploadCard({
  slotKey,
  label,
  draft,
  errors,
  onFile,
  onChange,
}: {
  slotKey: string;
  label: string;
  draft: OfflineContractDraft;
  errors: Record<string, string>;
  onFile: (file: File) => void;
  onChange: (partial: Partial<OfflineContractDraft>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const err = (field: string) => errors[`contracts.${slotKey}.${field}`];
  const uploaded = Boolean(draft.filePath) && !draft.uploading;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileCheck className={`w-4 h-4 ${uploaded ? "text-emerald-600" : "text-[var(--text3)]"}`} />
        <h3 className="text-sm font-semibold text-[var(--navy)]">{label}</h3>
        <span className="text-red-400 text-xs">*</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={draft.uploading}
        onClick={() => inputRef.current?.click()}
        className={`w-full flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition-colors ${
          err("filePath")
            ? "border-red-300 bg-red-50/40"
            : uploaded
              ? "border-emerald-300 bg-emerald-50/40"
              : "border-[var(--border)] hover:border-[var(--navy)]/40 hover:bg-[#EFF6FF]"
        }`}
      >
        {draft.uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[var(--navy)] shrink-0" />
        ) : uploaded ? (
          <RefreshCw className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <FileUp className="w-5 h-5 text-[var(--navy)] shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text1)] truncate">
            {draft.uploading
              ? "Uploading…"
              : uploaded
                ? draft.fileName
                : "Upload the signed PDF scan"}
          </p>
          <p className="text-xs text-[var(--text3)]">
            {uploaded ? "Click to replace" : "PDF only, up to 25 MB"}
          </p>
        </div>
      </button>
      {err("filePath") && <p className="text-xs text-red-500">{err("filePath")}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WizardField
          id={`${slotKey}_signer_name`}
          label="Signer name (as printed)"
          required
          value={draft.signerName}
          onChange={(v) => onChange({ signerName: v })}
          error={err("signerName")}
          placeholder="Dr. Jane Doe"
        />
        <WizardField
          id={`${slotKey}_signer_title`}
          label="Signer title"
          required
          value={draft.signerTitle}
          onChange={(v) => onChange({ signerTitle: v })}
          error={err("signerTitle")}
          placeholder="Medical Director"
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${slotKey}_signed_on`} className="text-xs">
            Date signed <span className="text-red-400">*</span>
          </Label>
          <input
            id={`${slotKey}_signed_on`}
            type="date"
            max={today}
            value={draft.signedOn}
            onChange={(e) => onChange({ signedOn: e.target.value })}
            className={`h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              err("signedOn") ? "border-red-400" : "border-input"
            }`}
          />
          {err("signedOn") && <p className="text-xs text-red-500">{err("signedOn")}</p>}
        </div>
      </div>
    </div>
  );
}
