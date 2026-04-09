"use client";

import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import {
  FileText,
  Presentation,
  BookOpen,
  FlaskConical,
  FileBarChart2,
  CheckSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { AdminMaterialCard } from "@/app/(components)/AdminMaterialCard";
import { AdminUploadButton } from "@/app/(components)/AdminUploadButton";
import { AdminBulkBar } from "@/app/(components)/AdminBulkBar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { MarketingMaterial } from "@/utils/interfaces/marketing";
import { getMaterialSearchText, normalizeMaterialText } from "@/utils/helpers/material-display";
import {
  toggleSelectMarketingItem,
  selectAllMarketingItems,
  clearMarketingSelection,
} from "../(redux)/marketing-slice";
import {
  getSignedDownloadUrl,
  deleteMarketingMaterial,
  bulkDeleteMarketingMaterials,
} from "../(services)/actions";
import { uploadMarketingMaterial } from "../(services)/client-upload";

type DisplayKind =
  | "clinical-reference"
  | "document"
  | "sales-presentation"
  | "reimbursement-guide"
  | "brochure";

function getDisplayKind(item: MarketingMaterial): DisplayKind {
  const text = getMaterialSearchText(item);
  if (text.includes("reimbursement")) return "reimbursement-guide";
  if (
    text.includes("pitch deck") ||
    text.includes("slide deck") ||
    text.includes("presentation") ||
    text.includes("sales presentation") ||
    text.includes("podiatry")
  )
    return "sales-presentation";
  if (
    text.includes("clinical") ||
    text.includes("study") ||
    text.includes("reference")
  )
    return "clinical-reference";
  if (text.includes("brochure")) return "brochure";
  return "document";
}

function getDisplayBadge(item: MarketingMaterial) {
  const kind = getDisplayKind(item);
  switch (kind) {
    case "clinical-reference":
      return "PDF - Clinical Reference";
    case "sales-presentation":
      return "PDF - Sales Presentation";
    case "reimbursement-guide":
      return "PDF - Reimbursement Guide";
    case "brochure":
      return "PDF - Brochure";
    default:
      return "PDF - Document";
  }
}

function getMarketingIcon(item: MarketingMaterial) {
  const kind = getDisplayKind(item);
  switch (kind) {
    case "sales-presentation":
      return <Presentation className="w-6 h-6 text-white" />;
    case "clinical-reference":
      return <FlaskConical className="w-6 h-6 text-white" />;
    case "brochure":
      return <BookOpen className="w-6 h-6 text-white" />;
    case "reimbursement-guide":
      return <FileBarChart2 className="w-6 h-6 text-white" />;
    default:
      return <FileText className="w-6 h-6 text-white" />;
  }
}

function prettifyTitle(raw?: string | null) {
  const title = (raw ?? "").trim();
  if (!title) return "";
  const normalized = normalizeMaterialText(title);
  const exactTitleMap: Record<string, string> = {
    "file 1085": "FILE_1085",
    "file 7919": "FILE_7919",
    "ocm instructions for use": "OCM Instructions For Use",
    "vac pack ocm": "Vac Pack OCM",
    "non hydro collagen pitch deck": "Non Hydro Collagen Pitch Deck",
    "podiatry slide deck": "Podiatry Slide Deck",
    "brochure non hydrolyzed vs hydrolyzed collagen":
      "Brochure Non Hydrolyzed Vs Hydrolyzed Collagen",
  };
  return exactTitleMap[normalized] ?? title;
}

function getDisplayDescription(item: MarketingMaterial) {
  const title = normalizeMaterialText(item.title);
  const exactDescriptionMap: Record<string, string> = {
    "clinical ii collagen dressing":
      "Clinical reference document covering bioactive collagen dressings — indications, wound types, and evidence-based applications for surgical and chronic wound care.",
    "file 1085":
      "Supplementary reference document providing additional clinical data, product specifications, and supporting information for Spearhead Medical wound care solutions.",
    "non hydro collagen pitch deck":
      "Sales pitch deck for Non-Hydro Collagen — advanced bioactive scaffold for superior surgical wound healing and tissue regeneration for physician presentations.",
    "brochure non hydrolyzed vs hydrolyzed collagen":
      "Clinical comparison brochure explaining the key differences between Non-Hydrolyzed and Hydrolyzed Collagen for wound healing applications.",
    "podiatry slide deck":
      "Podiatry-focused sales slide deck — clinical overview and product presentation tailored for podiatry specialists, covering wound care options and treatment protocols.",
    "ocm instructions for use":
      "Instructions for use document with product application guidance, handling steps, and supporting reference information.",
    "vac pack ocm":
      "Product support document for VAC Pack OCM, including packaging, handling, and product reference details.",
  };
  if (exactDescriptionMap[title]) return exactDescriptionMap[title];
  const kind = getDisplayKind(item);
  switch (kind) {
    case "reimbursement-guide":
      return "Reimbursement guide covering billing codes, coverage policies, and submission guidance.";
    case "sales-presentation":
      return "Sales presentation deck for product overview, positioning, and clinical discussion.";
    case "clinical-reference":
      return "Clinical reference document with product evidence, usage context, and supporting information.";
    case "brochure":
      return "Marketing brochure for product overview and sales support.";
    default:
      return "Supplementary reference document providing product details and supporting information.";
  }
}

function getGroup(item: MarketingMaterial): string {
  const kind = getDisplayKind(item);
  if (kind === "reimbursement-guide") return "Reimbursement Guides";
  if (kind === "document") return "Product Documents";
  return "Marketing Materials";
}

const GROUP_ORDER = [
  "Marketing Materials",
  "Reimbursement Guides",
  "Product Documents",
];

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);
  if (!signedUrl) throw new Error("Failed to generate download URL");
  return signedUrl;
}

export default function MarketingCards() {
  const dispatch = useAppDispatch();
  const [mounted, setMounted] = useState(false);

  const items = useAppSelector((state) => state.marketing.items);
  const selectedIds = useAppSelector((state) => state.marketing.selectedIds);
  const isAdmin = checkIsAdmin(useAppSelector((state) => state.dashboard.role));

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAdminUi = mounted && isAdmin;

  const grouped = GROUP_ORDER.reduce<Record<string, MarketingMaterial[]>>(
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
            <AdminUploadButton onUpload={uploadMarketingMaterial} />
          </div>
        )}
        <EmptyState
          className="py-24"
          icon={
            <div className="w-16 h-16 rounded-2xl bg-[var(--border)] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[var(--border)]" />
            </div>
          }
          message="No materials available"
          description="Materials will appear here once added"
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
                ? dispatch(clearMarketingSelection())
                : dispatch(selectAllMarketingItems())
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--bg)]"
          >
            <CheckSquare className="h-4 w-4" />
            {selectedIds.length === items.length
              ? "Deselect All"
              : "Select All"}
          </button>
          <AdminUploadButton onUpload={uploadMarketingMaterial} />
        </div>
      )}

      {showAdminUi && selectedIds.length > 0 && (
        <AdminBulkBar
          selectedCount={selectedIds.length}
          onClear={() => dispatch(clearMarketingSelection())}
          onBulkDelete={async () => {
            await bulkDeleteMarketingMaterials(selectedIds);
            dispatch(clearMarketingSelection());
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
                    onDelete={deleteMarketingMaterial}
                    icon={getMarketingIcon(card)}
                    tagSeparator=" - "
                    selected={selectedIds.includes(card.id)}
                    onToggleSelect={(id) =>
                      dispatch(toggleSelectMarketingItem(id))
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
                    icon={getMarketingIcon(card)}
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
