"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Banknote, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import {
  createConnectOnboardingLink,
  createConnectLoginLink,
  type ConnectStatus,
  type LastPayout,
} from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";

interface PayoutsTabProps {
  status: ConnectStatus;
  lastPayout?: LastPayout | null;
}

export function PayoutsTab({ status, lastPayout = null }: PayoutsTabProps) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"setup" | "manage" | null>(null);

  function handleSetup() {
    setBusy("setup");
    startTransition(async () => {
      const res = await createConnectOnboardingLink();
      if (!res.success || !res.url) {
        toast.error(res.error ?? "Failed to start payout setup.");
        setBusy(null);
        return;
      }
      window.location.href = res.url;
    });
  }

  function handleManage() {
    setBusy("manage");
    startTransition(async () => {
      const res = await createConnectLoginLink();
      if (!res.success || !res.url) {
        toast.error(res.error ?? "Failed to open payout dashboard.");
        setBusy(null);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
      setBusy(null);
    });
  }

  const ready = status.hasAccount && status.payoutsEnabled && status.detailsSubmitted;
  const inProgress = status.hasAccount && !ready;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--teal-lt)] flex items-center justify-center shrink-0">
          <Banknote className="w-4 h-4 text-[var(--teal)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--navy)]">Commission payouts</h3>
          <p className="text-xs text-[var(--text2)] mt-0.5">
            Connect a bank account via Stripe to receive your commission payouts.
          </p>
        </div>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          {ready ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Payouts enabled</span>
            </>
          ) : inProgress ? (
            <>
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Setup incomplete</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-[var(--text3)]" />
              <span className="text-sm font-medium text-[var(--text2)]">Not set up</span>
            </>
          )}
        </div>

        <p className="text-xs text-[var(--text2)] leading-relaxed">
          {ready
            ? "Your Stripe payout account is connected and verified. Commissions will be deposited to your bank account according to your payout schedule."
            : inProgress
              ? "You started payout setup but haven't finished. Stripe needs a few more details before they can send commissions to your bank."
              : "You haven't connected a bank account yet. Click below to set up your payout account with Stripe — it takes about 5 minutes."}
        </p>

        <div className="flex gap-2 pt-1">
          {ready ? (
            <Button
              type="button"
              size="sm"
              onClick={handleManage}
              disabled={isPending}
              className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg"
            >
              {busy === "manage" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              Manage on Stripe
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSetup}
              disabled={isPending}
              className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg"
            >
              {busy === "setup" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {inProgress ? "Continue setup" : "Set up payouts"}
            </Button>
          )}
        </div>
      </div>

      {/* Last payout summary — only when payouts enabled and there's a history */}
      {ready && lastPayout && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Last payout</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-lg font-semibold text-[var(--navy)]">
              {formatAmount(lastPayout.totalAmount)}
            </p>
            <p className="text-xs text-[var(--text2)]">
              on {lastPayout.paidAt ? formatDate(lastPayout.paidAt) : lastPayout.period}
            </p>
          </div>
          <Link
            href="/dashboard/commissions"
            className="mt-2 inline-block text-xs text-[var(--text2)] underline underline-offset-2 hover:text-[var(--navy)]"
          >
            View full payout history →
          </Link>
        </div>
      )}

      <p className="text-[11px] text-[var(--text3)]">
        Payouts are processed by Stripe. Meridian never sees or stores your bank account details.
      </p>
    </div>
  );
}
