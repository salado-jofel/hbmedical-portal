"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { payRepCommissions } from "@/app/(dashboard)/dashboard/my-team/(services)/payout-actions";
import { formatAmount } from "@/utils/helpers/formatter";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

interface AdminPayoutCardProps {
  repId: string;
  repName: string;
  period: string;          // YYYY-MM
  approvedTotal: number;   // $ ready to pay
  approvedCount: number;
  payoutsEnabled: boolean;
  hasPayoutAccount: boolean;
}

export default function AdminPayoutCard({
  repId,
  repName,
  period,
  approvedTotal,
  approvedCount,
  payoutsEnabled,
  hasPayoutAccount,
}: AdminPayoutCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Refresh server data when a payout row for this rep changes — e.g. the
  // payout this card represents gets marked paid by another admin.
  useTableRealtimeRefresh("payouts");

  // Nothing approved in this period — hide entirely.
  if (approvedTotal <= 0) return null;

  const canPay = hasPayoutAccount && payoutsEnabled;

  function handleConfirm() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await payRepCommissions(repId, period);
      if (result.success) {
        // Soft-warning case: Stripe transfer went through but a local DB
        // write failed. Use a long-duration warning toast so the admin notices
        // and copies the transfer ID for manual reconciliation. Do NOT use
        // toast.success — the green checkmark would mask the issue.
        if (result.warning) {
          toast(result.warning, {
            duration: 15000,
            icon: "⚠️",
            style: { border: "1px solid #f59e0b", background: "#fffbeb", color: "#78350f" },
          });
        } else {
          toast.success(
            `Paid ${formatAmount(result.amountPaid ?? 0)} to ${repName}. ${result.commissionsPaid} commission${result.commissionsPaid === 1 ? "" : "s"} settled.`,
          );
        }
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to pay rep.");
      }
    });
  }

  return (
    <section className="rounded-[var(--r)] border border-emerald-200 bg-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">
              {formatAmount(approvedTotal)} approved and ready to pay
            </p>
            <p className="mt-0.5 text-xs text-[var(--text2)]">
              {approvedCount} commission{approvedCount === 1 ? "" : "s"} for {periodLabel(period)}
            </p>
            {!canPay && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">
                <AlertCircle className="h-3 w-3" />
                {!hasPayoutAccount
                  ? "Rep hasn't set up a Stripe payout account yet."
                  : "Stripe hasn't enabled payouts for this account yet."}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          disabled={!canPay || isPending}
          onClick={() => setConfirmOpen(true)}
          className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
          Pay {formatAmount(approvedTotal)}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!isPending) setConfirmOpen(v); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Pay commissions?</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">
              Sends real money via Stripe Connect.
            </p>
          </div>
          <div className="space-y-3 p-5 text-[12px] text-[var(--text2)]">
            <p>
              You&apos;re about to pay{" "}
              <span className="font-semibold text-[var(--navy)]">{formatAmount(approvedTotal)}</span>{" "}
              to <span className="font-semibold text-[var(--navy)]">{repName}</span> for {periodLabel(period)}.
            </p>
            <p>
              This covers {approvedCount} approved commission{approvedCount === 1 ? "" : "s"}. Stripe will
              debit your platform balance and deposit to the rep&apos;s connected account on their
              standard payout schedule.
            </p>
            <p className="text-[11px] text-[var(--text3)]">
              Idempotent — if you click twice or network retries, only one transfer is sent.
            </p>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Pay {formatAmount(approvedTotal)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
