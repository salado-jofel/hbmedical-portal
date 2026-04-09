"use client";

import { useState } from "react";
import { AdminUploadButton } from "@/app/(components)/AdminUploadButton";
import { uploadMarketingMaterial } from "../../marketing/(services)/client-upload";
import { uploadContractMaterial } from "../../contracts/(services)/client-upload";
import { uploadTrainingMaterial } from "../../trainings/(services)/client-upload";
import { uploadHospitalOnboardingMaterial } from "../../hospital-onboarding/(services)/client-upload";

const CATEGORY_OPTIONS = [
  { value: "marketing", label: "Marketing" },
  { value: "contracts", label: "Contracts" },
  { value: "training", label: "Training" },
  { value: "onboarding", label: "Onboarding" },
] as const;

type CategoryKey = (typeof CATEGORY_OPTIONS)[number]["value"];

function getUploadFn(category: string) {
  switch (category) {
    case "contracts": return uploadContractMaterial;
    case "training": return uploadTrainingMaterial;
    case "onboarding": return uploadHospitalOnboardingMaterial;
    default: return uploadMarketingMaterial;
  }
}

function tabToCategory(tab: string): string {
  switch (tab) {
    case "Contracts": return "contracts";
    case "Training": return "training";
    case "Onboarding": return "onboarding";
    default: return "marketing";
  }
}

export function ResourcesUploadButton({ activeTab }: { activeTab: string }) {
  const [category, setCategory] = useState<CategoryKey>("marketing");
  const isAll = activeTab === "All";
  const effectiveCategory = isAll ? category : tabToCategory(activeTab);
  const uploadFn = getUploadFn(effectiveCategory);

  return (
    <div className="flex items-center gap-2">
      {isAll && (
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className="rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-2 py-[7px] text-[12px] text-[var(--text2)] outline-none focus:border-[var(--accent)]"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      <AdminUploadButton onUpload={uploadFn} />
    </div>
  );
}
