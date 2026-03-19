"use client";

import { useAppSelector } from "@/store/hooks";
import {
  BookOpen,
  GraduationCap,
  Presentation,
  ClipboardList,
  FileText,
} from "lucide-react";
import { getSignedDownloadUrl } from "../(services)/actions";
import { MaterialCard } from "@/app/(components)/MaterialCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { MaterialsGrid } from "@/app/(components)/MaterialGrid";

function getTrainingIcon(tag?: string | null) {
  const t = tag?.toLowerCase() ?? "";
  if (t.includes("sales"))
    return <Presentation className="w-6 h-6 text-white" />;
  if (t.includes("guide") || t.includes("handbook"))
    return <BookOpen className="w-6 h-6 text-white" />;
  if (t.includes("certification") || t.includes("course"))
    return <GraduationCap className="w-6 h-6 text-white" />;
  if (t.includes("checklist") || t.includes("protocol"))
    return <ClipboardList className="w-6 h-6 text-white" />;
  return <FileText className="w-6 h-6 text-white" />;
}

export default function TrainingCards() {
  const items = useAppSelector((state) => state.trainings.items);

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-slate-300" />
          </div>
        }
        message="No training materials available"
        description="Materials will appear here once added"
      />
    );
  }

  return (
    <MaterialsGrid isEmpty={false}>
      {items.map((card) => (
        <MaterialCard
          key={card.id}
          title={card.title}
          description={card.description}
          tag={card.tag}
          fileUrl={card.file_url}
          onDownload={getSignedDownloadUrl}
          icon={getTrainingIcon(card.tag)}
        />
      ))}
    </MaterialsGrid>
  );
}
