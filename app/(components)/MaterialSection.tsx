import { ReactNode } from "react";

interface MaterialsSectionProps {
  title: string;
  children: ReactNode;
}

export function MaterialsSection({ title, children }: MaterialsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">
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
