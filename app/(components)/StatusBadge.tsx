import { StatusBadgeProps } from "@/app/(interfaces)/status-badge";

export function StatusBadge({ status }: StatusBadgeProps) {
  const s: string = status?.toLowerCase() ?? "";

  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    inactive: "bg-slate-100 text-slate-500 border border-slate-200",
    pending: "bg-yellow-50 text-yellow-600 border border-yellow-100",
  };

  const cls: string =
    styles[s] ?? "bg-slate-100 text-slate-500 border border-slate-200";

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
