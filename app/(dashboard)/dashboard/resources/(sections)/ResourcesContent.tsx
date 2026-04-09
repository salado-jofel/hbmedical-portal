"use client";

import { useState } from "react";
import { Megaphone, ScrollText, BookOpen, Hospital, FileText, CheckSquare } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { AdminMaterialCard } from "@/app/(components)/AdminMaterialCard";
import { AdminBulkBar } from "@/app/(components)/AdminBulkBar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { ActionBar } from "@/app/(components)/ActionBar";
import { ResourceSubTabs } from "../(components)/ResourceSubTabs";
import {
  toggleSelectMarketingItem, selectAllMarketingItems, clearMarketingSelection,
} from "../../marketing/(redux)/marketing-slice";
import {
  toggleSelectContractItem, selectAllContractItems, clearContractSelection,
} from "../../contracts/(redux)/contracts-slice";
import {
  toggleSelectTrainingItem, selectAllTrainingItems, clearTrainingSelection,
} from "../../trainings/(redux)/trainings-slice";
import {
  toggleSelectHospitalOnboardingItem, selectAllHospitalOnboardingItems, clearHospitalOnboardingSelection,
} from "../../hospital-onboarding/(redux)/hospital-onboarding-slice";
import { getSignedDownloadUrl as getMarketingUrl } from "../../marketing/(services)/actions";
import {
  deleteMarketingMaterial, bulkDeleteMarketingMaterials,
} from "../../marketing/(services)/actions";
import {
  deleteContractMaterial, bulkDeleteContractMaterials,
} from "../../contracts/(services)/actions";
import {
  deleteTrainingMaterial, bulkDeleteTrainingMaterials,
} from "../../trainings/(services)/actions";
import {
  deleteHospitalOnboardingMaterial, bulkDeleteHospitalOnboardingMaterials,
} from "../../hospital-onboarding/(services)/actions";

type Category = "marketing" | "contracts" | "training" | "onboarding";

type ResourceItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  tag?: string | null;
  file_url: string;
  is_active?: boolean;
  category: Category;
};

function getCategoryIcon(category: Category) {
  switch (category) {
    case "marketing": return <Megaphone className="w-6 h-6 text-white" />;
    case "contracts": return <ScrollText className="w-6 h-6 text-white" />;
    case "training": return <BookOpen className="w-6 h-6 text-white" />;
    case "onboarding": return <Hospital className="w-6 h-6 text-white" />;
  }
}

function getCategoryLabel(category: Category): string {
  switch (category) {
    case "marketing": return "Marketing";
    case "contracts": return "Contracts";
    case "training": return "Training";
    case "onboarding": return "Onboarding";
  }
}

function getDeleteFn(category: Category): (id: string) => Promise<void> {
  switch (category) {
    case "marketing": return deleteMarketingMaterial;
    case "contracts": return deleteContractMaterial;
    case "training": return deleteTrainingMaterial;
    case "onboarding": return deleteHospitalOnboardingMaterial;
  }
}

async function handleDownload(fileUrl: string): Promise<string> {
  const url = await getMarketingUrl(fileUrl);
  if (!url) throw new Error("Failed to generate download URL");
  return url;
}

const CATEGORY_ORDER: Category[] = ["marketing", "contracts", "training", "onboarding"];

const TAB_CATEGORY: Record<string, Category | null> = {
  All: null,
  Marketing: "marketing",
  Contracts: "contracts",
  Training: "training",
  Onboarding: "onboarding",
};

export default function ResourcesContent({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState("");

  const marketingItems = useAppSelector((s) => s.marketing.items);
  const contractItems = useAppSelector((s) => s.contracts.items);
  const trainingItems = useAppSelector((s) => s.trainings.items);
  const onboardingItems = useAppSelector((s) => s.hospitalOnboarding.items);

  const marketingSelected = useAppSelector((s) => s.marketing.selectedIds);
  const contractsSelected = useAppSelector((s) => s.contracts.selectedIds);
  const trainingsSelected = useAppSelector((s) => s.trainings.selectedIds);
  const onboardingSelected = useAppSelector((s) => s.hospitalOnboarding.selectedIds);
  const totalSelected = marketingSelected.length + contractsSelected.length + trainingsSelected.length + onboardingSelected.length;

  const isAdmin = checkIsAdmin(useAppSelector((s) => s.dashboard.role));

  const allItems: ResourceItem[] = [
    ...marketingItems.map((i) => ({ ...i, category: "marketing" as Category })),
    ...contractItems.map((i) => ({ ...i, category: "contracts" as Category })),
    ...trainingItems.map((i) => ({ ...i, category: "training" as Category })),
    ...onboardingItems.map((i) => ({ ...i, category: "onboarding" as Category })),
  ];

  const counts = {
    Marketing: marketingItems.length,
    Contracts: contractItems.length,
    Training: trainingItems.length,
    Onboarding: onboardingItems.length,
  };

  const q = search.trim().toLowerCase();
  const categoryFilter = TAB_CATEGORY[activeTab];

  const filtered = allItems.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (!q) return true;
    return (
      (item.title ?? "").toLowerCase().includes(q) ||
      (item.tag ?? "").toLowerCase().includes(q)
    );
  });

  function isItemSelected(item: ResourceItem): boolean {
    switch (item.category) {
      case "marketing": return marketingSelected.includes(item.id);
      case "contracts": return contractsSelected.includes(item.id);
      case "training": return trainingsSelected.includes(item.id);
      case "onboarding": return onboardingSelected.includes(item.id);
    }
  }

  function toggleItem(item: ResourceItem) {
    switch (item.category) {
      case "marketing": dispatch(toggleSelectMarketingItem(item.id)); break;
      case "contracts": dispatch(toggleSelectContractItem(item.id)); break;
      case "training": dispatch(toggleSelectTrainingItem(item.id)); break;
      case "onboarding": dispatch(toggleSelectHospitalOnboardingItem(item.id)); break;
    }
  }

  function selectAll() {
    dispatch(selectAllMarketingItems());
    dispatch(selectAllContractItems());
    dispatch(selectAllTrainingItems());
    dispatch(selectAllHospitalOnboardingItems());
  }

  function clearAll() {
    dispatch(clearMarketingSelection());
    dispatch(clearContractSelection());
    dispatch(clearTrainingSelection());
    dispatch(clearHospitalOnboardingSelection());
  }

  async function handleBulkDelete() {
    await Promise.all([
      marketingSelected.length ? bulkDeleteMarketingMaterials(marketingSelected) : Promise.resolve(),
      contractsSelected.length ? bulkDeleteContractMaterials(contractsSelected) : Promise.resolve(),
      trainingsSelected.length ? bulkDeleteTrainingMaterials(trainingsSelected) : Promise.resolve(),
      onboardingSelected.length ? bulkDeleteHospitalOnboardingMaterials(onboardingSelected) : Promise.resolve(),
    ]);
    clearAll();
  }

  function renderCard(item: ResourceItem) {
    const title = item.title ?? "Untitled";
    const description = item.description ?? undefined;
    const tag = item.tag ?? undefined;
    const icon = getCategoryIcon(item.category);
    if (isAdmin) {
      return (
        <AdminMaterialCard
          key={item.id}
          id={item.id}
          title={title}
          description={description}
          tag={tag}
          fileUrl={item.file_url}
          onDownload={handleDownload}
          onDelete={getDeleteFn(item.category)}
          icon={icon}
          tagSeparator=" - "
          selected={isItemSelected(item)}
          onToggleSelect={() => toggleItem(item)}
          isActive={item.is_active}
        />
      );
    }
    return (
      <MaterialCard
        key={item.id}
        title={title}
        description={description}
        tag={tag}
        fileUrl={item.file_url}
        onDownload={handleDownload}
        icon={icon}
        tagSeparator=" - "
      />
    );
  }

  return (
    <div className="space-y-4">
      <ResourceSubTabs activeTab={activeTab} onTabChange={onTabChange} counts={counts} />

      <ActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search resources by title or tag…"
      />

      {isAdmin && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => totalSelected === filtered.length ? clearAll() : selectAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--bg)]"
          >
            <CheckSquare className="h-4 w-4" />
            {totalSelected === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}

      {isAdmin && totalSelected > 0 && (
        <AdminBulkBar
          selectedCount={totalSelected}
          onClear={clearAll}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          className="py-24"
          icon={
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--border)]">
              <FileText className="h-8 w-8 text-[var(--text3)]" />
            </div>
          }
          message={q ? "No results found" : "No resources available"}
          description={q ? "Try a different search term" : "Resources will appear here once added"}
        />
      ) : categoryFilter ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(renderCard)}
        </div>
      ) : (
        <div className="space-y-10">
          {CATEGORY_ORDER.map((cat) => {
            const group = filtered.filter((i) => i.category === cat);
            if (group.length === 0) return null;
            return (
              <MaterialsSection key={cat} title={getCategoryLabel(cat)}>
                {group.map(renderCard)}
              </MaterialsSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
