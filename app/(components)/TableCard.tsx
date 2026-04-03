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
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
          {countLabel && (
            <p className="text-xs text-[#15689E] mt-0.5">{countLabel}</p>
          )}
        </div>
        {onAdd && addLabel && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 bg-[#15689E] hover:bg-[#125d8e] text-white text-xs font-medium h-9 px-4 rounded-lg transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </button>
        )}
      </div>

      {children}

      {footer && (
        <div className="px-4 py-3 border-t border-[#E2E8F0] text-xs text-[#15689E]">
          {footer}
        </div>
      )}
    </div>
  );
}
