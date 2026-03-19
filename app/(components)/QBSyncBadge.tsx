import { formatDate } from "@/utils/formatter";
import { CheckCircle } from "lucide-react";

interface QBSyncBadgeProps {
  syncedAt?: string | null;
}

export function QBSyncBadge({ syncedAt }: QBSyncBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle className="w-3.5 h-3.5 text-[#2db0b0]" />
      <span className="text-xs font-semibold text-[#2db0b0]">QB Synced</span>
      {syncedAt && (
        <span className="text-xs text-slate-400">· {formatDate(syncedAt)}</span>
      )}
    </div>
  );
}
