import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon,
  message,
  description,
  className = "py-16",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <div className="text-[var(--border)]">{icon}</div>
      <p className="text-sm font-medium text-[var(--text3)]">{message}</p>
      {description && (
        <p className="text-xs text-[var(--text3)] mt-1">{description}</p>
      )}
    </div>
  );
}
