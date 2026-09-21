"use client";

import { Info } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { prepareOfflineContractUpload } from "@/app/(dashboard)/dashboard/onboarding/(services)/manual-onboarding-actions";
import {
  MAX_OFFLINE_CONTRACT_BYTES,
  OFFLINE_CONTRACTS,
  type OfflineContractKey,
} from "@/utils/constants/manual-onboarding";
import type {
  ManualFormPatch,
  ManualOnboardingForm,
  OfflineContractDraft,
} from "@/utils/interfaces/manual-onboarding";
import { ContractUploadCard } from "./ContractUploadCard";
import { WizardStepHeading } from "./WizardField";

export function DocumentsStep({
  batchId,
  form,
  patch,
  errors,
  clearError,
}: {
  batchId: string;
  form: ManualOnboardingForm;
  patch: (p: ManualFormPatch) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
}) {
  function updateSlot(key: OfflineContractKey, partial: Partial<OfflineContractDraft>) {
    patch((f) => ({ contracts: { ...f.contracts, [key]: { ...f.contracts[key], ...partial } } }));
    for (const field of Object.keys(partial)) clearError(`contracts.${key}.${field}`);
  }

  async function handleFile(key: OfflineContractKey, file: File) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Only PDF scans are accepted.");
      return;
    }
    if (file.size > MAX_OFFLINE_CONTRACT_BYTES) {
      toast.error("PDF is too large (max 25 MB).");
      return;
    }
    updateSlot(key, { uploading: true, fileName: file.name, filePath: "" });
    try {
      const prep = await prepareOfflineContractUpload({
        batchId,
        contractType: key,
        mimeType: "application/pdf",
        size: file.size,
      });
      if (!prep.success || !prep.bucket || !prep.filePath || !prep.uploadToken) {
        throw new Error(prep.error ?? "Failed to prepare upload.");
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(prep.bucket)
        .uploadToSignedUrl(prep.filePath, prep.uploadToken, file, {
          contentType: "application/pdf",
        });
      if (error) throw new Error(error.message ?? "Upload failed.");
      updateSlot(key, { uploading: false, filePath: prep.filePath, fileName: file.name });
      toast.success(`${file.name} uploaded.`);
    } catch (err) {
      updateSlot(key, { uploading: false, filePath: "", fileName: "" });
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <div className="space-y-4">
      <WizardStepHeading
        title="Signed agreements"
        description="Upload the scanned Business Associate Agreement and Product & Services Agreement the clinic signed on paper."
      />

      <div className="flex items-start gap-2.5 bg-[#EFF6FF] border border-[var(--navy)]/20 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-[var(--navy)] mt-0.5 shrink-0" />
        <p className="text-sm text-[var(--navy)]">
          Both documents are required — the same rule as online onboarding. Enter the signer and
          date exactly as written on the paper copy; the PDF is stored as-is and emailed to the
          provider and to Meridian staff.
        </p>
      </div>

      {OFFLINE_CONTRACTS.map((def) => (
        <ContractUploadCard
          key={def.key}
          slotKey={def.key}
          label={def.label}
          draft={form.contracts[def.key]}
          errors={errors}
          onFile={(file) => handleFile(def.key, file)}
          onChange={(partial) => updateSlot(def.key, partial)}
        />
      ))}
    </div>
  );
}
