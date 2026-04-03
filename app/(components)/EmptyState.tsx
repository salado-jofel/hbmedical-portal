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
      <div className="text-[#E2E8F0]">{icon}</div>
      <p className="text-sm font-medium text-[#94A3B8]">{message}</p>
      {description && (
        <p className="text-xs text-[#94A3B8] mt-1">{description}</p>
      )}
    </div>
  );
}
