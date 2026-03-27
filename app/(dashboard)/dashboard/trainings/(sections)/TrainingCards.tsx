"use client";

import { useAppSelector } from "@/store/hooks";
import {
  FileText,
  Presentation,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  ScrollText,
} from "lucide-react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { TrainingMaterial } from "@/utils/interfaces/trainings";
import { getSignedDownloadUrl } from "../(services)/actions";

type DisplayKind =
  | "onboarding-guide"
  | "training-deck"
  | "clinical-training"
  | "instructions-for-use"
  | "training-checklist"
  | "document";

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getSearchText(item: TrainingMaterial) {
  return [
    item.title,
    item.tag,
    item.description,
    item.file_name,
    item.file_path,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDisplayKind(item: TrainingMaterial): DisplayKind {
  const text = getSearchText(item);

  if (text.includes("onboarding") || text.includes("orientation")) {
    return "onboarding-guide";
  }

  if (
    text.includes("slide") ||
    text.includes("deck") ||
    text.includes("presentation")
  ) {
    return "training-deck";
  }

  if (
    text.includes("clinical") ||
    text.includes("study") ||
    text.includes("reference")
  ) {
    return "clinical-training";
  }

  if (text.includes("instruction") || text.includes("ifu")) {
    return "instructions-for-use";
  }

  if (text.includes("checklist") || text.includes("competency")) {
    return "training-checklist";
  }

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
      return <Presentation className="w-6 h-6 text-white" />;
    case "clinical-training":
      return <FlaskConical className="w-6 h-6 text-white" />;
    case "onboarding-guide":
      return <BookOpen className="w-6 h-6 text-white" />;
    case "training-checklist":
      return <ClipboardCheck className="w-6 h-6 text-white" />;
    case "instructions-for-use":
      return <ScrollText className="w-6 h-6 text-white" />;
    default:
      return <FileText className="w-6 h-6 text-white" />;
  }
}

function prettifyTitle(raw?: string | null) {
  const title = (raw ?? "").trim();
  if (!title) return "";

  return title
    .replace(/\bIfu\b/g, "IFU")
    .replace(/\bHipaa\b/g, "HIPAA")
    .replace(/\bOcm\b/g, "OCM")
    .replace(/\bCgs\b/g, "CGS")
    .replace(/\bNgs\b/g, "NGS");
}

function getDisplayDescription(item: TrainingMaterial) {
  if (item.description?.trim()) {
    return item.description;
  }

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
  ) {
    return "Training Guides";
  }

  return "Training Materials";
}

const GROUP_ORDER = [
  "Training Materials",
  "Clinical Training",
  "Training Guides",
];

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);

  if (!signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedUrl;
}

export default function TrainingsCards() {
  const items = useAppSelector(
    (state) => state.trainings.items,
  ) as TrainingMaterial[];

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
        }
        message="No training materials available"
        description="Training materials will appear here once added"
      />
    );
  }

  const grouped = GROUP_ORDER.reduce<Record<string, TrainingMaterial[]>>(
    (acc, group) => {
      acc[group] = items.filter((item) => getGroup(item) === group);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-10">
      {GROUP_ORDER.map((group) =>
        grouped[group].length === 0 ? null : (
          <MaterialsSection key={group} title={group}>
            {grouped[group].map((card) => (
              <MaterialCard
                key={card.id}
                title={prettifyTitle(card.title)}
                description={getDisplayDescription(card)}
                tag={getDisplayBadge(card)}
                fileUrl={card.file_url}
                onDownload={handleDownload}
                icon={getTrainingIcon(card)}
                tagSeparator=" - "
              />
            ))}
          </MaterialsSection>
        ),
      )}
    </div>
  );
}
