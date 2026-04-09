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
    <div className="bg-[var(--surface)] rounded-[var(--r)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-[0.8rem] border-b border-[var(--border)] bg-[var(--bg)]">
        <div>
          <p className="text-[13px] font-semibold text-[var(--navy)]">{title}</p>
          {countLabel && (
            <p className="text-[11px] text-[var(--text3)] mt-0.5">{countLabel}</p>
          )}
        </div>
        {onAdd && addLabel && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white text-[12px] font-medium h-8 px-3 rounded-[7px] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </button>
        )}
      </div>

      {children}

      {footer && (
        <div className="px-4 py-3 border-t border-[var(--border)] text-[11px] text-[var(--text3)]">
          {footer}
        </div>
      )}
    </div>
  );
}
