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
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {icon}
      <p className="text-sm font-medium text-slate-400">{message}</p>
      {description && (
        <p className="text-xs text-slate-300 mt-1">{description}</p>
      )}
    </div>
  );
}
