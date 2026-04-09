import { cn } from "@/utils/utils";

const VARIANT_STYLES: Record<string, string> = {
  green:  "bg-[var(--green-lt)]  text-[var(--green)]",
  blue:   "bg-[var(--blue-lt)]   text-[var(--blue)]",
  gold:   "bg-[var(--gold-lt)]   text-[var(--gold)]",
  red:    "bg-[var(--red-lt)]    text-[var(--red)]",
  teal:   "bg-[var(--teal-lt)]   text-[var(--teal)]",
  purple: "bg-[var(--purple-lt)] text-[var(--purple)]",
};

export function PillBadge({
  label,
  variant,
}: {
  label: string;
  variant: "green" | "blue" | "gold" | "red" | "teal" | "purple";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-medium",
        VARIANT_STYLES[variant],
      )}
    >
      {label}
    </span>
  );
}
