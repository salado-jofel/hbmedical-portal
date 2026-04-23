"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveCommissions,
  voidCommission,
} from "@/app/(dashboard)/dashboard/commissions/(services)/actions";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderQuickView from "./OrderQuickView";

export interface PendingCommission {
  id: string;
  orderId: string;
  orderNumber: string;
  finalAmount: number;
  createdAt: string;
}

interface AdminApprovalsCardProps {
  pending: PendingCommission[];
  pendingTotal: number;
}

export default function AdminApprovalsCard({ pending, pendingTotal }: AdminApprovalsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voidTarget, setVoidTarget] = useState<PendingCommission | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [quickViewOrderId, setQuickViewOrderId] = useState<string | null>(null);

  // Empty state (no pending)
  if (pending.length === 0) {
    return (
      <section className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <CheckSquare className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">Nothing pending</p>
            <p className="text-xs text-[var(--text3)]">No commissions waiting for your approval.</p>
          </div>
        </div>
      </section>
    );
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedTotal = useMemo(
    () =>
      pending
        .filter((p) => selected.has(p.id))
        .reduce((sum, p) => sum + p.finalAmount, 0),
    [pending, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)),
    );
  }

  function runApprove(ids: string[]) {
    startTransition(async () => {
      const result = await approveCommissions(ids);
      if (result.success) {
        toast.success(`Approved ${ids.length} commission${ids.length === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to approve commissions.");
      }
    });
  }

  function openVoid(c: PendingCommission) {
    setVoidTarget(c);
    setVoidReason("");
  }

  function confirmVoid() {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for voiding this commission.");
      return;
    }
    startTransition(async () => {
      const result = await voidCommission(voidTarget.id, reason);
      if (result.success) {
        toast.success("Commission voided.");
        setVoidTarget(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(voidTarget.id);
          return next;
        });
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to void commission.");
      }
    });
  }

  // Single pending — compact card (no table overhead)
  if (pending.length === 1) {
    const only = pending[0];
    return (
      <section className="rounded-[var(--r)] border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            <CheckSquare className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--navy)]">
              1 commission pending your approval
            </p>
            <p className="mt-0.5 text-xs text-[var(--text2)]">
              <button
                type="button"
                onClick={() => setQuickViewOrderId(only.orderId)}
                className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
              >
                Order {only.orderNumber}
              </button>
              {" · "}
              <span className="font-semibold text-[var(--navy)]">{formatAmount(only.finalAmount)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => openVoid(only)}
              className="h-9 gap-1.5 text-[var(--text2)] hover:border-red-300 hover:text-red-600 hover:bg-red-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Void
            </Button>
            <Button
              size="sm"
              onClick={() => runApprove([only.id])}
              disabled={isPending}
              className="h-9 gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
              Approve
            </Button>
          </div>
        </div>

        <VoidDialog
          target={voidTarget}
          reason={voidReason}
          onReasonChange={setVoidReason}
          isPending={isPending}
          onCancel={() => setVoidTarget(null)}
          onConfirm={confirmVoid}
        />
        <OrderQuickView
          orderId={quickViewOrderId}
          onClose={() => setQuickViewOrderId(null)}
        />
      </section>
    );
  }

  // Multiple pending — expanded table with cherry-pick + approve-all
  const allSelected = selected.size === pending.length;
  return (
    <section className="rounded-[var(--r)] border border-amber-200 bg-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-amber-200">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            <CheckSquare className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">
              {pending.length} commissions pending your approval
            </p>
            <p className="mt-0.5 text-xs text-[var(--text2)]">
              Total: <span className="font-semibold text-[var(--navy)]">{formatAmount(pendingTotal)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runApprove(selectedIds)}
              className="h-9 gap-1.5"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
              Approve selected ({selected.size}) · {formatAmount(selectedTotal)}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => runApprove(pending.map((p) => p.id))}
            disabled={isPending}
            className="h-9 gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
            Approve all
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/40 border-b border-amber-200">
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-[var(--teal)] cursor-pointer"
                  aria-label="Select all pending"
                />
              </th>
              {["Order", "Amount", "Created", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id} className="border-b border-amber-200 last:border-0 hover:bg-white/40">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="accent-[var(--teal)] cursor-pointer"
                    aria-label={`Select commission for ${p.orderNumber}`}
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setQuickViewOrderId(p.orderId)}
                    className="font-medium text-[var(--navy)] hover:underline underline-offset-2"
                    style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                  >
                    {p.orderNumber}
                  </button>
                </td>
                <td
                  className="px-4 py-3 text-sm font-medium text-[var(--navy)]"
                  style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                >
                  {formatAmount(p.finalAmount)}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text2)]">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openVoid(p)}
                      disabled={isPending}
                      className="rounded-[6px] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Void
                    </button>
                    <button
                      type="button"
                      onClick={() => runApprove([p.id])}
                      disabled={isPending}
                      className="rounded-[6px] bg-[var(--navy)] px-2 py-1 text-[11px] font-medium text-white transition hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <VoidDialog
        target={voidTarget}
        reason={voidReason}
        onReasonChange={setVoidReason}
        isPending={isPending}
        onCancel={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
      />
      <OrderQuickView
        orderId={quickViewOrderId}
        onClose={() => setQuickViewOrderId(null)}
      />
    </section>
  );
}

function VoidDialog({
  target,
  reason,
  onReasonChange,
  isPending,
  onCancel,
  onConfirm,
}: {
  target: PendingCommission | null;
  reason: string;
  onReasonChange: (v: string) => void;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Void Commission</DialogTitle>
          {target && (
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">
              Order {target.orderNumber} · {formatAmount(target.finalAmount)}
            </p>
          )}
        </div>
        <div className="space-y-3 p-5">
          <p className="text-[12px] text-[var(--text2)]">
            Voiding removes this commission from future payouts. This cannot be undone.
          </p>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Reason <span className="text-red-400">*</span></Label>
            <Input
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Order refunded, sale reversed..."
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white hover:bg-red-600"
          >
            Void
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
