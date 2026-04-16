"use client";

import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import {
  FileText,
  ScrollText,
  FileBarChart2,
  ShieldCheck,
  FileSignature,
  CheckSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { AdminUploadButton } from "@/app/(components)/AdminUploadButton";
import { AdminBulkBar } from "@/app/(components)/AdminBulkBar";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { ContractMaterial } from "@/utils/interfaces/contracts";
import { getMaterialSearchText, prettifyMaterialTitle } from "@/utils/helpers/material-display";
import {
  toggleSelectContractItem,
  selectAllContractItems,
  clearContractSelection,
} from "../(redux)/contracts-slice";
import {
  getSignedDownloadUrl,
  deleteContractMaterial,
  bulkDeleteContractMaterials,
} from "../(services)/actions";
import { uploadContractMaterial } from "../(services)/client-upload";
import { AdminMaterialCard } from "@/app/(components)/AdminMaterialCard";

type DisplayKind =
  | "agreement"
  | "contract"
  | "nda"
  | "commercial-terms"
  | "policy-form"
  | "document";

const CONTRACT_ACRONYMS: Array<[RegExp, string]> = [
  [/\bNda\b/g, "NDA"],
  [/\bMsa\b/g, "MSA"],
  [/\bHipaa\b/g, "HIPAA"],
  [/\bBaa\b/g, "BAA"],
  [/\bPhi\b/g, "PHI"],
  [/\bOcm\b/g, "OCM"],
];

function getDisplayKind(item: ContractMaterial): DisplayKind {
  const text = getMaterialSearchText(item);

  if (text.includes("nda") || text.includes("confidential")) {
    return "nda";
  }

  if (
    text.includes("pricing") ||
    text.includes("term") ||
    text.includes("rate") ||
    text.includes("fee schedule")
  ) {
    return "commercial-terms";
  }

  if (
    text.includes("policy") ||
    text.includes("form") ||
    text.includes("checklist")
  ) {
    return "policy-form";
  }

  if (
    text.includes("agreement") ||
    text.includes("msa") ||
    text.includes("service agreement")
  ) {
    return "agreement";
  }

  if (text.includes("contract")) {
    return "contract";
  }

  return "document";
}

function getDisplayBadge(item: ContractMaterial) {
  const kind = getDisplayKind(item);

  switch (kind) {
    case "agreement":
      return "PDF - Agreement";
    case "contract":
      return "PDF - Contract";
    case "nda":
      return "PDF - NDA";
    case "commercial-terms":
      return "PDF - Commercial Terms";
    case "policy-form":
      return "PDF - Policy / Form";
    default:
      return "PDF - Document";
  }
}

function getContractsIcon(item: ContractMaterial) {
  const kind = getDisplayKind(item);

  switch (kind) {
    case "agreement":
      return <FileSignature className="w-5 h-5" />;
    case "contract":
      return <ScrollText className="w-5 h-5" />;
    case "nda":
      return <ShieldCheck className="w-5 h-5" />;
    case "commercial-terms":
      return <FileBarChart2 className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
}

function prettifyTitle(raw?: string | null) {
  return prettifyMaterialTitle(raw, CONTRACT_ACRONYMS);
}

function getDisplayDescription(item: ContractMaterial) {
  if (item.description?.trim()) return item.description;

  const kind = getDisplayKind(item);

  switch (kind) {
    case "agreement":
      return "Agreement document outlining responsibilities, terms, and business arrangements.";
    case "contract":
      return "Contract document containing legal terms, obligations, and execution details.";
    case "nda":
      return "Confidentiality agreement defining permitted use and protection of shared information.";
    case "commercial-terms":
      return "Commercial terms document with pricing, rates, conditions, or fee schedule information.";
    case "policy-form":
      return "Operational or support document used for compliance, approvals, or contract processing.";
    default:
      return "Contract-related document containing legal, commercial, or supporting information.";
  }
}

function getGroup(item: ContractMaterial): string {
  const kind = getDisplayKind(item);

  if (kind === "agreement" || kind === "contract" || kind === "nda") {
    return "Contracts & Agreements";
  }

  if (kind === "commercial-terms") {
    return "Commercial Terms";
  }

  return "Policies & Forms";
}

const GROUP_ORDER = [
  "Contracts & Agreements",
  "Commercial Terms",
  "Policies & Forms",
] as const;

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);

  if (!signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedUrl;
}

export default function ContractsCards() {
  const dispatch = useAppDispatch();
  const [mounted, setMounted] = useState(false);

  const items = useAppSelector(
    (state) => state.contracts.items,
  ) as ContractMaterial[];

  const selectedIds = useAppSelector((state) => state.contracts.selectedIds);
  const isAdmin = checkIsAdmin(useAppSelector((state) => state.dashboard.role));

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAdminUi = mounted && isAdmin;

  const grouped = GROUP_ORDER.reduce<Record<string, ContractMaterial[]>>(
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
            <AdminUploadButton onUpload={uploadContractMaterial} />
          </div>
        )}

        <EmptyState
          className="py-24"
          icon={
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--border)]">
              <ScrollText className="h-8 w-8 text-[var(--border)]" />
            </div>
          }
          message="No contracts available"
          description="Contracts will appear here once added"
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
                ? dispatch(clearContractSelection())
                : dispatch(selectAllContractItems())
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--bg)]"
          >
            <CheckSquare className="h-4 w-4" />
            {selectedIds.length === items.length
              ? "Deselect All"
              : "Select All"}
          </button>

          <AdminUploadButton onUpload={uploadContractMaterial} />
        </div>
      )}

      {showAdminUi && selectedIds.length > 0 && (
        <AdminBulkBar
          selectedCount={selectedIds.length}
          onClear={() => dispatch(clearContractSelection())}
          onBulkDelete={async () => {
            await bulkDeleteContractMaterials(selectedIds);
            dispatch(clearContractSelection());
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
                    onDelete={deleteContractMaterial}
                    icon={getContractsIcon(card)}
                    tagSeparator=" - "
                    selected={selectedIds.includes(card.id)}
                    onToggleSelect={(id) =>
                      dispatch(toggleSelectContractItem(id))
                    }
                    isActive={card.is_active}
                    category="contracts"
                  />
                ) : (
                  <MaterialCard
                    key={card.id}
                    title={prettifyTitle(card.title)}
                    description={getDisplayDescription(card)}
                    tag={getDisplayBadge(card)}
                    fileUrl={card.file_url}
                    onDownload={handleDownload}
                    icon={getContractsIcon(card)}
                    tagSeparator=" - "
                    category="contracts"
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
