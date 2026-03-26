"use client";

import { useAppSelector } from "@/store/hooks";
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Building2,
  Presentation,
  ScrollText,
} from "lucide-react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { HospitalOnboardingMaterial } from "@/lib/interfaces/hospital-onboarding";
import { getSignedDownloadUrl } from "../(services)/actions";

type DisplayKind =
  | "onboarding-guide"
  | "orientation"
  | "credentialing"
  | "facility-guide"
  | "checklist"
  | "policy-form"
  | "presentation"
  | "document";

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getSearchText(item: HospitalOnboardingMaterial) {
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

function getDisplayKind(item: HospitalOnboardingMaterial): DisplayKind {
  const text = getSearchText(item);

  if (text.includes("onboarding")) return "onboarding-guide";
  if (text.includes("orientation")) return "orientation";
  if (text.includes("credential")) return "credentialing";
  if (text.includes("facility")) return "facility-guide";
  if (text.includes("checklist")) return "checklist";

  if (text.includes("policy") || text.includes("form")) {
    return "policy-form";
  }

  if (
    text.includes("presentation") ||
    text.includes("slide") ||
    text.includes("deck")
  ) {
    return "presentation";
  }

  return "document";
}

function getDisplayBadge(item: HospitalOnboardingMaterial) {
  const kind = getDisplayKind(item);

  switch (kind) {
    case "onboarding-guide":
      return "PDF - Onboarding Guide";
    case "orientation":
      return "PDF - Orientation";
    case "credentialing":
      return "PDF - Credentialing";
    case "facility-guide":
      return "PDF - Facility Guide";
    case "checklist":
      return "PDF - Checklist";
    case "policy-form":
      return "PDF - Policy / Form";
    case "presentation":
      return "PDF - Presentation";
    default:
      return "PDF - Document";
  }
}

function getHospitalOnboardingIcon(item: HospitalOnboardingMaterial) {
  const kind = getDisplayKind(item);

  switch (kind) {
    case "onboarding-guide":
    case "orientation":
      return <BookOpen className="w-6 h-6 text-white" />;
    case "credentialing":
      return <ScrollText className="w-6 h-6 text-white" />;
    case "facility-guide":
      return <Building2 className="w-6 h-6 text-white" />;
    case "checklist":
      return <ClipboardCheck className="w-6 h-6 text-white" />;
    case "presentation":
      return <Presentation className="w-6 h-6 text-white" />;
    default:
      return <FileText className="w-6 h-6 text-white" />;
  }
}

function prettifyTitle(raw?: string | null) {
  const title = (raw ?? "").trim();
  if (!title) return "";

  return title
    .replace(/\bHipaa\b/g, "HIPAA")
    .replace(/\bPhi\b/g, "PHI")
    .replace(/\bNda\b/g, "NDA")
    .replace(/\bOcm\b/g, "OCM")
    .replace(/\bCgs\b/g, "CGS")
    .replace(/\bNgs\b/g, "NGS");
}

function getDisplayDescription(item: HospitalOnboardingMaterial) {
  if (item.description?.trim()) {
    return item.description;
  }

  const kind = getDisplayKind(item);

  switch (kind) {
    case "onboarding-guide":
      return "Hospital onboarding guide covering setup, requirements, and implementation readiness.";
    case "orientation":
      return "Orientation material for hospital onboarding, workflows, and program introduction.";
    case "credentialing":
      return "Credentialing document supporting provider, staff, or facility onboarding requirements.";
    case "facility-guide":
      return "Facility onboarding guide with operational, administrative, or implementation information.";
    case "checklist":
      return "Checklist document for onboarding completion, readiness, and compliance tracking.";
    case "policy-form":
      return "Policy or form document used for hospital onboarding workflows and documentation.";
    case "presentation":
      return "Presentation material supporting hospital onboarding, implementation, and training review.";
    default:
      return "Hospital onboarding document containing operational, educational, or supporting information.";
  }
}

function getGroup(item: HospitalOnboardingMaterial): string {
  const kind = getDisplayKind(item);

  if (
    kind === "onboarding-guide" ||
    kind === "orientation" ||
    kind === "facility-guide"
  ) {
    return "Onboarding Guides";
  }

  if (
    kind === "credentialing" ||
    kind === "checklist" ||
    kind === "policy-form"
  ) {
    return "Credentialing & Documents";
  }

  return "Presentations & Resources";
}

const GROUP_ORDER = [
  "Onboarding Guides",
  "Credentialing & Documents",
  "Presentations & Resources",
];

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);

  if (!signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedUrl;
}

export default function HospitalOnboardingCards() {
  const items = useAppSelector(
    (state) => state.hospitalOnboarding.items,
  ) as HospitalOnboardingMaterial[];

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-300" />
          </div>
        }
        message="No hospital onboarding materials available"
        description="Hospital onboarding materials will appear here once added"
      />
    );
  }

  const grouped = GROUP_ORDER.reduce<
    Record<string, HospitalOnboardingMaterial[]>
  >((acc, group) => {
    acc[group] = items.filter((item) => getGroup(item) === group);
    return acc;
  }, {});

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
                icon={getHospitalOnboardingIcon(card)}
                tagSeparator=" - "
              />
            ))}
          </MaterialsSection>
        ),
      )}
    </div>
  );
}
