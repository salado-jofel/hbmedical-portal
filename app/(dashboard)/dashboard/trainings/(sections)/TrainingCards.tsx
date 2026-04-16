"use client";

import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import {
  FileText,
  Presentation,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  ScrollText,
  CheckSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { AdminUploadButton } from "@/app/(components)/AdminUploadButton";
import { AdminBulkBar } from "@/app/(components)/AdminBulkBar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { TrainingMaterial } from "@/utils/interfaces/trainings";
import { getMaterialSearchText, normalizeMaterialText, prettifyMaterialTitle } from "@/utils/helpers/material-display";
import {
  toggleSelectTrainingItem,
  selectAllTrainingItems,
  clearTrainingSelection,
} from "../(redux)/trainings-slice";
import {
  getSignedDownloadUrl,
  deleteTrainingMaterial,
  bulkDeleteTrainingMaterials,
} from "../(services)/actions";
import { uploadTrainingMaterial } from "../(services)/client-upload";
import { AdminMaterialCard } from "@/app/(components)/AdminMaterialCard";

type DisplayKind =
  | "onboarding-guide"
  | "training-deck"
  | "clinical-training"
  | "instructions-for-use"
  | "training-checklist"
  | "document";

const TRAINING_ACRONYMS: Array<[RegExp, string]> = [
  [/\bIfu\b/g, "IFU"],
  [/\bHipaa\b/g, "HIPAA"],
  [/\bOcm\b/g, "OCM"],
  [/\bCgs\b/g, "CGS"],
  [/\bNgs\b/g, "NGS"],
];

function getDisplayKind(item: TrainingMaterial): DisplayKind {
  const text = getMaterialSearchText(item);
  if (text.includes("onboarding") || text.includes("orientation"))
    return "onboarding-guide";
  if (
    text.includes("slide") ||
    text.includes("deck") ||
    text.includes("presentation")
  )
    return "training-deck";
  if (
    text.includes("clinical") ||
    text.includes("study") ||
    text.includes("reference")
  )
    return "clinical-training";
  if (text.includes("instruction") || text.includes("ifu"))
    return "instructions-for-use";
  if (text.includes("checklist") || text.includes("competency"))
    return "training-checklist";
  return "document";
}

function getDisplayBadge(item: TrainingMaterial) {
  const kind = getDisplayKind(item);
  switch (kind) {
    case "onboarding-guide":
      return "PDF - Onboarding Guide";
    case "training-deck":
      return "PDF - Training Deck";
    case "clinical-training":
      return "PDF - Clinical Training";
    case "instructions-for-use":
      return "PDF - Instructions For Use";
    case "training-checklist":
      return "PDF - Training Checklist";
    default:
      return "PDF - Document";
  }
}

function getTrainingIcon(item: TrainingMaterial) {
  const kind = getDisplayKind(item);
  switch (kind) {
    case "training-deck":
      return <Presentation className="w-5 h-5" />;
    case "clinical-training":
      return <FlaskConical className="w-5 h-5" />;
    case "onboarding-guide":
      return <BookOpen className="w-5 h-5" />;
    case "training-checklist":
      return <ClipboardCheck className="w-5 h-5" />;
    case "instructions-for-use":
      return <ScrollText className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
}

function prettifyTitle(raw?: string | null) {
  return prettifyMaterialTitle(raw, TRAINING_ACRONYMS);
}

function getDisplayDescription(item: TrainingMaterial) {
  if (item.description?.trim()) return item.description;
  const kind = getDisplayKind(item);
  switch (kind) {
    case "onboarding-guide":
      return "Onboarding guide for training, setup, and operational readiness.";
    case "training-deck":
      return "Training slide deck for education, walkthroughs, and internal learning.";
    case "clinical-training":
      return "Clinical training material with educational and reference information.";
    case "instructions-for-use":
      return "Instructions for use document with training and application guidance.";
    case "training-checklist":
      return "Checklist document for training completion, readiness, or compliance review.";
    default:
      return "Training-related document containing educational, operational, or supporting information.";
  }
}

function getGroup(item: TrainingMaterial): string {
  const kind = getDisplayKind(item);
  if (kind === "clinical-training") return "Clinical Training";
  if (
    kind === "onboarding-guide" ||
    kind === "training-checklist" ||
    kind === "instructions-for-use"
  )
    return "Training Guides";
  return "Training Materials";
}

const GROUP_ORDER = [
  "Training Materials",
  "Clinical Training",
  "Training Guides",
];

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);
  if (!signedUrl) throw new Error("Failed to generate download URL");
  return signedUrl;
}

export default function TrainingsCards() {
  const dispatch = useAppDispatch();
  const [mounted, setMounted] = useState(false);

  const items = useAppSelector(
    (state) => state.trainings.items,
  ) as TrainingMaterial[];
  const selectedIds = useAppSelector((state) => state.trainings.selectedIds);
  const isAdmin = checkIsAdmin(useAppSelector((state) => state.dashboard.role));

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAdminUi = mounted && isAdmin;

  const grouped = GROUP_ORDER.reduce<Record<string, TrainingMaterial[]>>(
    (acc, group) => {
      acc[group] = items.filter((item) => getGroup(item) === group);
      return acc;
    },
    {},
  );

  if (items.length === 0) {
    return (
      <>
        {showAdminUi && (
          <div className="flex justify-end">
            <AdminUploadButton onUpload={uploadTrainingMaterial} />
          </div>
        )}
        <EmptyState
          className="py-24"
          icon={
            <div className="w-16 h-16 rounded-2xl bg-[var(--border)] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[var(--border)]" />
            </div>
          }
          message="No training materials available"
          description="Training materials will appear here once added"
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {showAdminUi && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              selectedIds.length === items.length
                ? dispatch(clearTrainingSelection())
                : dispatch(selectAllTrainingItems())
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--bg)]"
          >
            <CheckSquare className="h-4 w-4" />
            {selectedIds.length === items.length
              ? "Deselect All"
              : "Select All"}
          </button>
          <AdminUploadButton onUpload={uploadTrainingMaterial} />
        </div>
      )}

      {showAdminUi && selectedIds.length > 0 && (
        <AdminBulkBar
          selectedCount={selectedIds.length}
          onClear={() => dispatch(clearTrainingSelection())}
          onBulkDelete={async () => {
            await bulkDeleteTrainingMaterials(selectedIds);
            dispatch(clearTrainingSelection());
          }}
        />
      )}

      <div className="space-y-10">
        {GROUP_ORDER.map((group) =>
          grouped[group].length === 0 ? null : (
            <MaterialsSection key={group} title={group}>
              {grouped[group].map((card) =>
                showAdminUi ? (
                  <AdminMaterialCard
                    key={card.id}
                    id={card.id}
                    title={prettifyTitle(card.title)}
                    description={getDisplayDescription(card)}
                    tag={getDisplayBadge(card)}
                    fileUrl={card.file_url}
                    onDownload={handleDownload}
                    onDelete={deleteTrainingMaterial}
                    icon={getTrainingIcon(card)}
                    tagSeparator=" - "
                    selected={selectedIds.includes(card.id)}
                    onToggleSelect={(id) =>
                      dispatch(toggleSelectTrainingItem(id))
                    }
                    isActive={card.is_active}
                    category="training"
                  />
                ) : (
                  <MaterialCard
                    key={card.id}
                    title={prettifyTitle(card.title)}
                    description={getDisplayDescription(card)}
                    tag={getDisplayBadge(card)}
                    fileUrl={card.file_url}
                    onDownload={handleDownload}
                    icon={getTrainingIcon(card)}
                    tagSeparator=" - "
                    category="training"
                  />
                ),
              )}
            </MaterialsSection>
          ),
        )}
      </div>
    </div>
  );
}
