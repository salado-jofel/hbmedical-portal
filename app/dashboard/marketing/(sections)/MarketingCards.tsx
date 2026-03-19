"use client";

import { useAppSelector } from "@/store/hooks";
import type { MarketingMaterial } from "@/app/(interfaces)/marketing";
import {
  FileText,
  Presentation,
  BookOpen,
  FlaskConical,
  FileBarChart2,
  ScrollText,
} from "lucide-react";
import { getSignedDownloadUrl } from "../(services)/actions";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsSection } from "@/app/(components)/MaterialSection";

function getMarketingIcon(tag?: string | null) {
  const t = tag?.toLowerCase() ?? "";
  if (t.includes("presentation") || t.includes("powerpoint"))
    return <Presentation className="w-6 h-6 text-white" />;
  if (t.includes("clinical") || t.includes("study") || t.includes("reference"))
    return <FlaskConical className="w-6 h-6 text-white" />;
  if (t.includes("brochure") || t.includes("comparison"))
    return <BookOpen className="w-6 h-6 text-white" />;
  if (t.includes("report") || t.includes("data"))
    return <FileBarChart2 className="w-6 h-6 text-white" />;
  if (t.includes("contract") || t.includes("agreement"))
    return <ScrollText className="w-6 h-6 text-white" />;
  return <FileText className="w-6 h-6 text-white" />;
}

function getGroup(tag?: string): string {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("reimbursement")) return "Reimbursement Guides";
  if (t.includes("product document")) return "Product Documents";
  return "Marketing Materials";
}

const GROUP_ORDER = [
  "Marketing Materials",
  "Reimbursement Guides",
  "Product Documents",
];

export default function MarketingCards() {
  const items = useAppSelector((state) => state.marketing.items);

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
        }
        message="No materials available"
        description="Materials will appear here once added"
      />
    );
  }

  const grouped = GROUP_ORDER.reduce<Record<string, MarketingMaterial[]>>(
    (acc, group) => {
      acc[group] = items.filter((item) => getGroup(item.tag) === group);
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
                title={card.title}
                description={card.description}
                tag={card.tag}
                fileUrl={card.file_url}
                onDownload={getSignedDownloadUrl}
                icon={getMarketingIcon(card.tag)}
                tagSeparator="+"
              />
            ))}
          </MaterialsSection>
        ),
      )}
    </div>
  );
}
