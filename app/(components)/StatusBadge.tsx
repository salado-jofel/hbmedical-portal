import { StatusBadgeProps } from "@/utils/interfaces/status-badge";

export function StatusBadge({ status }: StatusBadgeProps) {
  const s: string = status?.toLowerCase() ?? "";

  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    inactive: "bg-[#F1F5F9] text-[#64748B]",
    pending: "bg-amber-50 text-amber-700",
  };

  const cls: string =
    styles[s] ?? "bg-[#F1F5F9] text-[#64748B]";

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${cls}`}>
      {status}
    </span>
  );
}
