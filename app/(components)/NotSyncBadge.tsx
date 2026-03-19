import { X } from "lucide-react";

export function NotSyncedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <X className="w-3.5 h-3.5" />
      Not Synced
    </span>
  );
}