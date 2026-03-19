"use client";

import { useState } from "react";
import { syncAllProductsToQuickBooks } from "../../products/(services)/quickbooks-actions";
import {
  Building2,
  Package,
  FileText,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { syncAllFacilitiesToQuickBooks } from "../../facilities/(services)/quickbook-actions";
import { syncAllOrdersToQuickBooks } from "../actions";

interface SyncResult {
  success: number;
  failed: number;
  messages: string[];
}

interface SyncCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onSync: () => Promise<SyncResult>;
}

function SyncCard({ icon, title, description, onSync }: SyncCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setResult(null);
    try {
      const res = await onSync();
      setResult(res);
    } catch {
      setResult({
        success: 0,
        failed: 1,
        messages: ["Unexpected error occurred"],
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
      {/* ↓ flex-wrap so button drops below on very small screens */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2db0b0]/10 flex items-center justify-center shrink-0">
            <span className="text-[#2db0b0]">{icon}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 text-xs font-medium text-[#2db0b0] hover:text-[#249191] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Re-sync All
            </>
          )}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg p-3 text-xs space-y-1 ${result.failed === 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {result.failed === 0 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-700">
                  {result.success} synced successfully
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600">
                  {result.success} synced · {result.failed} failed
                </span>
              </>
            )}
          </div>
          {result.messages.slice(0, 5).map((msg, i) => (
            <p key={i} className="text-slate-500 pl-5">
              {msg}
            </p>
          ))}
          {result.messages.length > 5 && (
            <p className="text-slate-400 pl-5">
              +{result.messages.length - 5} more...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BulkSync() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-700">Bulk Re-sync</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Use these to recover from sync failures or after token refresh.
        </p>
      </div>

      <SyncCard
        icon={<Building2 className="w-4 h-4" />}
        title="Facilities"
        description="Re-sync all facilities as QB Customers"
        onSync={syncAllFacilitiesToQuickBooks}
      />
      <SyncCard
        icon={<Package className="w-4 h-4" />}
        title="Products"
        description="Re-sync all products as QB Items"
        onSync={syncAllProductsToQuickBooks}
      />
      <SyncCard
        icon={<FileText className="w-4 h-4" />}
        title="Orders"
        description="Create QB invoices for all unsynced orders"
        onSync={syncAllOrdersToQuickBooks}
      />
    </div>
  );
}
