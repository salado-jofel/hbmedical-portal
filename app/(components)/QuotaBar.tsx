import { cn } from "@/utils/utils";

function getBarColor(percent: number): string {
  if (percent >= 100) return "bg-[var(--teal-mid)]";
  if (percent >= 70)  return "bg-[var(--gold)]";
  return "bg-[var(--red)]";
}

function getTextColor(percent: number): string {
  if (percent >= 100) return "text-[var(--teal-mid)]";
  if (percent >= 70)  return "text-[var(--gold)]";
  return "text-[var(--red)]";
}

export function QuotaBar({
  name,
  percent,
  amount,
}: {
  name: string;
  percent: number;
  amount: string;
}) {
  const capped = Math.min(percent, 100);
  const barColor  = getBarColor(percent);
  const textColor = getTextColor(percent);

  return (
    <div className="flex items-center gap-[10px] border-b border-[var(--border)] py-2 last:border-b-0">
      {/* Name */}
      <span className="w-[120px] shrink-0 truncate text-[12px] font-medium text-[var(--navy)]">
        {name}
      </span>

      {/* Bar */}
      <div className="h-[8px] flex-1 overflow-hidden rounded bg-[var(--bg)]">
        <div
          className={cn("h-full rounded transition-[width] duration-[400ms]", barColor)}
          style={{ width: `${capped}%` }}
        />
      </div>

      {/* Percentage */}
      <span className={cn("w-[36px] text-right text-[11px] font-semibold", textColor)}>
        {percent}%
      </span>

      {/* Amount */}
      <span
        className="w-[70px] text-right text-[11px] text-[var(--text3)]"
        style={{ fontFamily: "var(--font-dm-mono), monospace" }}
      >
        {amount}
      </span>
    </div>
  );
}
