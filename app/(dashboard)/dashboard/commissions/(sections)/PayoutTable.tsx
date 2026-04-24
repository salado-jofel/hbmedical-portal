"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { PillBadge } from "@/app/(components)/PillBadge";
import { Button } from "@/components/ui/button";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updatePayoutInStore } from "../(redux)/commissions-slice";
import { generatePayout, markPayoutPaid } from "../(services)/actions";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import { isAdmin } from "@/utils/helpers/role";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";
import type { UserRole } from "@/utils/helpers/role";
import type { IPayout } from "@/utils/interfaces/commissions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type PayoutStatusVariant = "green" | "gold" | "blue";

const STATUS_VARIANT: Record<string, PayoutStatusVariant> = {
  paid:     "green",
  approved: "blue",
  draft:    "gold",
};

const AVATAR_COLORS = [
  "bg-[var(--teal-lt)] text-[var(--teal)]",
  "bg-[var(--blue-lt)] text-[var(--blue)]",
  "bg-[var(--gold-lt)] text-[var(--gold)]",
  "bg-[#dde8f5] text-[var(--navy)]",
  "bg-[var(--purple-lt)] text-[var(--purple)]",
];

function initials(name: string): string {
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function PayoutTable() {
  const dispatch = useAppDispatch();
  const payouts = useAppSelector((s) => s.commissions.payouts);
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const admin = isAdmin(role);

  const commissions = useAppSelector((s) => s.commissions.commissions);
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [confirmPayout, setConfirmPayout] = useState<IPayout | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Keep the payout table live when another admin generates or marks paid
  // a payout for any rep in the same period.
  useTableRealtimeRefresh("payouts");

  useEffect(() => setMounted(true), []);

  // Reps who have approved commissions in the current period — eligible for payout generation
  const repsWithApproved = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of commissions) {
      if (c.status === "approved" && c.payoutPeriod === currentPeriod && !seen.has(c.repId)) {
        seen.set(c.repId, c.repName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [commissions]);

  function handleMarkPaid(payoutId: string) {
    setConfirmPayout(null);
    setPendingId(payoutId);
    startTransition(async () => {
      const result = await markPayoutPaid(payoutId);
      setPendingId(null);
      if (result.success) {
        const updated = payouts.find((p) => p.id === payoutId);
        if (updated) dispatch(updatePayoutInStore({ ...updated, status: "paid" }));
        toast.success("Payout marked as paid.");
      } else {
        toast.error(result.error ?? "Failed to mark payout as paid.");
      }
    });
  }

  function handleGeneratePayout() {
    if (!selectedRepId) return;
    startTransition(async () => {
      const result = await generatePayout(selectedRepId, currentPeriod);
      if (result.success) {
        toast.success("Payout generated.");
        setSelectedRepId("");
      } else {
        toast.error(result.error ?? "Failed to generate payout.");
      }
    });
  }

  if (!mounted) return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="animate-pulse px-4 py-[0.8rem]">
        <div className="h-4 w-24 rounded bg-[var(--border2)]" />
        <div className="mt-1.5 h-3 w-36 rounded bg-[var(--border2)]" />
      </div>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[0.8rem]">
          <div>
            <p className="text-[13px] font-semibold text-[var(--navy)]">Payouts</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">Monthly payout batches</p>
          </div>
          {admin && (
            <div className="flex items-center gap-2">
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="h-8 rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text2)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select rep…</option>
                {repsWithApproved.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[12px]"
                disabled={isPending || !selectedRepId}
                onClick={handleGeneratePayout}
              >
                Generate Payout
              </Button>
            </div>
          )}
        </div>

        {payouts.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text3)]">
            No payouts yet
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] px-4">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between py-[9px]">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(payout.repName)}`}
                  >
                    {initials(payout.repName)}
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--navy)]">
                      {payout.repName.split(" ")[0]}
                    </span>
                    <span className="ml-1.5 text-[10px] text-[var(--text3)]">{payout.period}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[13px] font-semibold text-[var(--teal)]"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {formatAmount(payout.totalAmount)}
                  </span>
                  <PillBadge
                    label={payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    variant={STATUS_VARIANT[payout.status] ?? "gold"}
                  />
                  {payout.status === "paid" && payout.paidAt && (
                    <span className="text-[11px] text-[var(--text3)]">{formatDate(payout.paidAt)}</span>
                  )}
                  {admin && payout.status !== "paid" && (
                    <button
                      type="button"
                      disabled={isPending && pendingId === payout.id}
                      onClick={() => setConfirmPayout(payout)}
                      className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--navy)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:opacity-50"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm mark-paid dialog */}
      <Dialog open={!!confirmPayout} onOpenChange={(v) => { if (!v && !isPending) setConfirmPayout(null); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Mark Payout as Paid</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">
              {confirmPayout?.repName} — {confirmPayout?.period}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] text-[var(--text2)]">
              Mark this payout of{" "}
              <span className="font-semibold text-[var(--navy)]">{formatAmount(confirmPayout?.totalAmount)}</span>{" "}
              to <span className="font-semibold text-[var(--navy)]">{confirmPayout?.repName}</span> as paid?
            </p>
            <p className="mt-2 text-[12px] text-[var(--text3)]">
              This will also mark all linked commissions as paid.
            </p>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={() => setConfirmPayout(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-[var(--navy)] hover:bg-[#1a3f60]"
              disabled={isPending}
              onClick={() => confirmPayout && handleMarkPaid(confirmPayout.id)}
            >
              {isPending ? "Saving…" : "Mark Paid"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
