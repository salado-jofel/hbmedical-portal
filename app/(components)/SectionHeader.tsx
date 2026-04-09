import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-[10px] flex items-center justify-between">
      <div>
        <p className="text-[13px] font-semibold text-[var(--navy)]">{title}</p>
        {subtitle && (
          <p className="mt-[1px] text-[11px] text-[var(--text3)]">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
