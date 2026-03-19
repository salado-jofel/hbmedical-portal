import { ReactNode } from "react";
import { Plus } from "lucide-react";

interface TableCardProps {
  title: string;
  countLabel?: string;
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function TableCard({
  title,
  countLabel,
  addLabel,
  onAdd,
  children,
  footer,
}: TableCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {countLabel && (
            <p className="text-xs text-[#2db0b0] mt-0.5">{countLabel}</p>
          )}
        </div>
        {onAdd && addLabel && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 bg-[#2db0b0] hover:bg-[#259999] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </button>
        )}
      </div>

      {children}

      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-[#2db0b0]">
          {footer}
        </div>
      )}
    </div>
  );
}
