import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/utils/utils";

const VARIANT_STYLES: Record<
  "warn" | "red" | "green",
  { wrapper: string; icon: string }
> = {
  warn: {
    wrapper: "bg-[var(--gold-lt)] border border-[var(--gold-border)] text-[#92580a]",
    icon:    "text-[#92580a]",
  },
  red: {
    wrapper: "bg-[var(--red-lt)] border border-[#fca5a5] text-[#991b1b]",
    icon:    "text-[#991b1b]",
  },
  green: {
    wrapper: "bg-[var(--green-lt)] border border-[#86efac] text-[#14532d]",
    icon:    "text-[#14532d]",
  },
};

export function AlertBanner({
  message,
  variant,
  actionLabel,
  onAction,
}: {
  message: string;
  variant: "warn" | "red" | "green";
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = VARIANT_STYLES[variant];
  const Icon = variant === "green" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        "mb-[10px] flex items-center gap-[10px] rounded-[9px] px-[14px] py-[10px] text-[13px]",
        styles.wrapper,
      )}
    >
      <Icon className={cn("h-[15px] w-[15px] shrink-0", styles.icon)} />

      <span className="flex-1 font-medium">{message}</span>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer whitespace-nowrap text-[11px] font-semibold underline opacity-80 hover:opacity-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
