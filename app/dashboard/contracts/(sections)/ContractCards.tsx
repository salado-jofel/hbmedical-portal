"use client";

import { useAppSelector } from "@/store/hooks";
import {
  FileText,
  ScrollText,
  FileBarChart2,
  ShieldCheck,
  FileSignature,
} from "lucide-react";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";
import { ContractMaterial } from "@/lib/interfaces/contracts";
import { getSignedDownloadUrl } from "../(services)/actions";

type DisplayKind =
  | "agreement"
  | "contract"
  | "nda"
  | "commercial-terms"
  | "policy-form"
  | "document";

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getSearchText(item: ContractMaterial) {
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

function getDisplayKind(item: ContractMaterial): DisplayKind {
  const text = getSearchText(item);

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
      return <FileSignature className="w-6 h-6 text-white" />;
    case "contract":
      return <ScrollText className="w-6 h-6 text-white" />;
    case "nda":
      return <ShieldCheck className="w-6 h-6 text-white" />;
    case "commercial-terms":
      return <FileBarChart2 className="w-6 h-6 text-white" />;
    case "policy-form":
      return <FileText className="w-6 h-6 text-white" />;
    default:
      return <FileText className="w-6 h-6 text-white" />;
  }
}

function prettifyTitle(raw?: string | null) {
  const title = (raw ?? "").trim();
  if (!title) return "";

  return title
    .replace(/\bNda\b/g, "NDA")
    .replace(/\bMsa\b/g, "MSA")
    .replace(/\bHipaa\b/g, "HIPAA")
    .replace(/\bBaa\b/g, "BAA")
    .replace(/\bPhi\b/g, "PHI")
    .replace(/\bOcm\b/g, "OCM");
}

function getDisplayDescription(item: ContractMaterial) {
  if (item.description?.trim()) {
    return item.description;
  }

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
];

async function handleDownload(fileUrl: string): Promise<string> {
  const signedUrl = await getSignedDownloadUrl(fileUrl);

  if (!signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedUrl;
}

export default function ContractsCards() {
  const items = useAppSelector(
    (state) => state.contracts.items,
  ) as ContractMaterial[];

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <ScrollText className="w-8 h-8 text-slate-300" />
          </div>
        }
        message="No contracts available"
        description="Contracts will appear here once added"
      />
    );
  }

  const grouped = GROUP_ORDER.reduce<Record<string, ContractMaterial[]>>(
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
                icon={getContractsIcon(card)}
                tagSeparator=" - "
              />
            ))}
          </MaterialsSection>
        ),
      )}
    </div>
  );
}
