"use client";

import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Building2,
  Presentation,
  ScrollText,
  CheckSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { AdminUploadButton } from "@/app/(components)/AdminUploadButton";
import { AdminBulkBar } from "@/app/(components)/AdminBulkBar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { HospitalOnboardingMaterial } from "@/utils/interfaces/hospital-onboarding";
import { getMaterialSearchText, prettifyMaterialTitle } from "@/utils/helpers/material-display";
import {
  toggleSelectHospitalOnboardingItem,
  selectAllHospitalOnboardingItems,
  clearHospitalOnboardingSelection,
} from "../(redux)/hospital-onboarding-slice";
import {
  getSignedDownloadUrl,
  deleteHospitalOnboardingMaterial,
  bulkDeleteHospitalOnboardingMaterials,
} from "../(services)/actions";
import { uploadHospitalOnboardingMaterial } from "../(services)/client-upload";
import { AdminMaterialCard } from "@/app/(components)/AdminMaterialCard";

type DisplayKind =
  | "onboarding-guide"
  | "orientation"
  | "credentialing"
  | "facility-guide"
  | "checklist"
  | "policy-form"
  | "presentation"
  | "document";

const HOSPITAL_ACRONYMS: Array<[RegExp, string]> = [
  [/\bHipaa\b/g, "HIPAA"],
  [/\bPhi\b/g, "PHI"],
  [/\bNda\b/g, "NDA"],
  [/\bOcm\b/g, "OCM"],
  [/\bCgs\b/g, "CGS"],
  [/\bNgs\b/g, "NGS"],
];

function getDisplayKind(item: HospitalOnboardingMaterial): DisplayKind {
  const text = getMaterialSearchText(item);

  if (text.includes("onboarding")) return "onboarding-guide";
  if (text.includes("orientation")) return "orientation";
  if (text.includes("credential")) return "credentialing";
  if (text.includes("facility")) return "facility-guide";
  if (text.includes("checklist")) return "checklist";
  if (text.includes("policy") || text.includes("form")) return "policy-form";
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
  return prettifyMaterialTitle(raw, HOSPITAL_ACRONYMS);
}

function getDisplayDescription(item: HospitalOnboardingMaterial) {
  if (item.description?.trim()) return item.description;

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
] as const;

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);

  if (!signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedUrl;
}

export default function HospitalOnboardingCards() {
  const dispatch = useAppDispatch();
  const [mounted, setMounted] = useState(false);

  const items = useAppSelector(
    (state) => state.hospitalOnboarding.items,
  ) as HospitalOnboardingMaterial[];

  const selectedIds = useAppSelector(
    (state) => state.hospitalOnboarding.selectedIds,
  );

  const isAdmin = checkIsAdmin(useAppSelector((state) => state.dashboard.role));

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAdminUi = mounted && isAdmin;

  const grouped = GROUP_ORDER.reduce<
    Record<string, HospitalOnboardingMaterial[]>
  >((acc, group) => {
    acc[group] = items.filter((item) => getGroup(item) === group);
    return acc;
  }, {});

  if (items.length === 0) {
    return (
      <>
        {showAdminUi && (
          <div className="flex justify-end">
            <AdminUploadButton onUpload={uploadHospitalOnboardingMaterial} />
          </div>
        )}

        <EmptyState
          className="py-24"
          icon={
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--border)]">
              <Building2 className="h-8 w-8 text-[var(--border)]" />
            </div>
          }
          message="No hospital onboarding materials available"
          description="Hospital onboarding materials will appear here once added"
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
                ? dispatch(clearHospitalOnboardingSelection())
                : dispatch(selectAllHospitalOnboardingItems())
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--bg)]"
          >
            <CheckSquare className="h-4 w-4" />
            {selectedIds.length === items.length
              ? "Deselect All"
              : "Select All"}
          </button>

          <AdminUploadButton onUpload={uploadHospitalOnboardingMaterial} />
        </div>
      )}

      {showAdminUi && selectedIds.length > 0 && (
        <AdminBulkBar
          selectedCount={selectedIds.length}
          onClear={() => dispatch(clearHospitalOnboardingSelection())}
          onBulkDelete={async () => {
            await bulkDeleteHospitalOnboardingMaterials(selectedIds);
            dispatch(clearHospitalOnboardingSelection());
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
                    onDelete={deleteHospitalOnboardingMaterial}
                    icon={getHospitalOnboardingIcon(card)}
                    tagSeparator=" - "
                    selected={selectedIds.includes(card.id)}
                    onToggleSelect={(id) =>
                      dispatch(toggleSelectHospitalOnboardingItem(id))
                    }
                    isActive={card.is_active}
                  />
                ) : (
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
                ),
              )}
            </MaterialsSection>
          ),
        )}
      </div>
    </div>
  );
}
