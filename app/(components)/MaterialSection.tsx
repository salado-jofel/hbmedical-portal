import { ReactNode } from "react";
import { cn } from "@/utils/utils";
import type { MaterialCategory } from "@/app/(components)/MaterialCard";

interface MaterialsSectionProps {
  title: string;
  category?: MaterialCategory;
  children: ReactNode;
}

const CATEGORY_DOT: Record<MaterialCategory, string> = {
  marketing:  "bg-[var(--blue)]",
  contracts:  "bg-[var(--purple)]",
  training:   "bg-[var(--gold)]",
  onboarding: "bg-[var(--teal)]",
};

export function MaterialsSection({ title, category, children }: MaterialsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {category && (
          <span className={cn("h-2 w-2 rounded-full shrink-0", CATEGORY_DOT[category])} />
        )}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
          {title}
        </h2>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {children}
      </div>
    </div>
  );
}
