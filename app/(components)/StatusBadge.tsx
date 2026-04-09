import { StatusBadgeProps } from "@/utils/interfaces/status-badge";

export function StatusBadge({ status }: StatusBadgeProps) {
  const s: string = status?.toLowerCase() ?? "";

  const styles: Record<string, string> = {
    active: "bg-[var(--green-lt)] text-[var(--green)]",
    inactive: "bg-[var(--border)] text-[var(--text3)]",
    pending: "bg-[var(--gold-lt)] text-[var(--gold)]",
  };

  const cls: string =
    styles[s] ?? "bg-[var(--border)] text-[var(--text3)]";

  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 ${cls}`}>
      {status}
    </span>
  );
}
