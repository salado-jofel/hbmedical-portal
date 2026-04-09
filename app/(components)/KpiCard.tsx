import { cn } from "@/utils/utils";

const ACCENT_BAR_COLORS: Record<string, string> = {
  teal:   "bg-[var(--teal-mid)]",
  gold:   "bg-[var(--gold)]",
  blue:   "bg-[var(--blue)]",
  purple: "bg-[var(--purple)]",
  green:  "bg-[var(--green)]",
  red:    "bg-[var(--red)]",
};

const DELTA_STYLES: Record<"up" | "warn" | "down", string> = {
  up:   "bg-[var(--green-lt)] text-[var(--green)]",
  warn: "bg-[var(--gold-lt)]  text-[var(--gold)]",
  down: "bg-[var(--red-lt)]   text-[var(--red)]",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaType,
  accentColor = "teal",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "up" | "warn" | "down";
  accentColor?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-[1.1rem] py-4"
    >
      <p
        className="mb-[5px] text-[10px] font-medium uppercase text-[var(--text3)]"
        style={{ letterSpacing: "0.7px" }}
      >
        {label}
      </p>

      <p className="text-[22px] font-semibold leading-none text-[var(--navy)]">
        {value}
      </p>

      {delta && deltaType && (
        <span
          className={cn(
            "mt-[6px] inline-block rounded-full px-[7px] py-[2px] text-[11px] font-medium",
            DELTA_STYLES[deltaType],
          )}
        >
          {delta}
        </span>
      )}

      {/* Accent bar */}
      <span
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[3px]",
          ACCENT_BAR_COLORS[accentColor] ?? "bg-[var(--teal-mid)]",
        )}
      />
    </div>
  );
}
