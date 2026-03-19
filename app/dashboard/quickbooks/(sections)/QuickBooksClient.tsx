"use client";

import { useState } from "react";
import BulkSync from "./BulkSync";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Building2,
  Calendar,
  Shield,
  Loader2,
  Plug,
  Unplug,
  Receipt,
} from "lucide-react";
import { disconnectQuickBooks } from "../actions";

interface QuickBooksConnection {
  id: string;
  realm_id: string;
  company_name: string;
  environment: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  connectAction: () => Promise<never>;
  connection: QuickBooksConnection | null;
}

export default function QuickBooksClient({ connectAction, connection }: Props) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await disconnectQuickBooks();
    } catch (err) {
      console.error("[handleDisconnect] Error:", err);
      setIsDisconnecting(false);
    }
  }

  // ─── Not Connected ────────────────────────────────────────────────
  if (!connection) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-[#2db0b0]/10 rounded-2xl flex items-center justify-center shrink-0">
              <Receipt className="w-7 h-7 text-[#2db0b0]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                QuickBooks Online
              </h2>
              <div className="flex items-center gap-1.5 mt-1">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">
                  Not Connected
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {[
              "Automatically create invoices when orders are delivered",
              "Sync facilities as QuickBooks customers",
              "Sync products as QuickBooks items",
              "Track payment status directly in the dashboard",
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-600">{feature}</span>
              </div>
            ))}
          </div>

          <form action={connectAction}>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full h-12 bg-[#2CA01C] hover:bg-[#248518] text-white font-semibold rounded-xl transition-colors"
            >
              <Plug className="w-4 h-4" />
              Connect QuickBooks
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </form>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-700 mb-1">
                Secure OAuth 2.0 Connection
              </p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Your QuickBooks credentials are never stored. We use OAuth 2.0
                to securely connect your account. You can disconnect at any
                time.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connected ────────────────────────────────────────────────────
  const accessExpiry = new Date(connection.access_token_expires_at);
  const refreshExpiry = new Date(connection.refresh_token_expires_at);
  const isAccessExpired = accessExpiry < new Date();
  const lastUpdated = new Date(connection.updated_at).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Connected Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#2db0b0]/10 rounded-2xl flex items-center justify-center shrink-0">
              <Receipt className="w-7 h-7 text-[#2db0b0]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                QuickBooks Online
              </h2>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-500 font-medium">
                  Connected
                </span>
              </div>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${
              connection.environment === "sandbox"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {connection.environment}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Company</p>
              <p className="text-sm font-semibold text-slate-700">
                {connection.company_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Shield className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Token Status</p>
              <p
                className={`text-sm font-semibold ${isAccessExpired ? "text-red-500" : "text-emerald-600"}`}
              >
                {isAccessExpired ? "Expired — needs refresh" : "Active"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Last Synced</p>
              <p className="text-sm font-semibold text-slate-700">
                {lastUpdated}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <RefreshCw className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Refresh Token Expires</p>
              <p className="text-sm font-semibold text-slate-700">
                {refreshExpiry.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center justify-center gap-2 w-full h-11 border border-red-200 text-red-500 hover:bg-red-50 font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isDisconnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Disconnecting...
            </>
          ) : (
            <>
              <Unplug className="w-4 h-4" />
              Disconnect QuickBooks
            </>
          )}
        </button>
      </div>

      {/* Sandbox Warning */}
      {connection.environment === "sandbox" && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-700 mb-1">
                Sandbox Mode
              </p>
              <p className="text-xs text-yellow-600 leading-relaxed">
                You are connected to a QuickBooks sandbox environment. No real
                financial data will be affected. Switch to Production when ready
                to go live.
              </p>
            </div>
          </div>
        </div>
      )}

      <BulkSync />
    </div>
  );
}
