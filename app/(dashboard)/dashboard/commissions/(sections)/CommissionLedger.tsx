"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Download, CheckSquare } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PillBadge } from "@/app/(components)/PillBadge";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateCommissionInStore } from "../(redux)/commissions-slice";
import { approveCommissions, adjustCommission, voidCommission } from "../(services)/actions";
import { formatAmount } from "@/utils/helpers/formatter";
import { isAdmin } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ICommission } from "@/utils/interfaces/commissions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type StatusVariant = "green" | "gold" | "blue" | "red";
const STATUS_VARIANT: Record<string, StatusVariant> = {
  pending:  "gold",
  approved: "blue",
  paid:     "green",
  void:     "red",
};

function initials(name: string): string {
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function exportCSV(rows: ICommission[]) {
  const headers = ["Rep", "Order #", "Type", "Sale Amt", "Rate %", "Base Commission", "Adjustment", "Commission (Final)", "Override", "Status", "Period"];
  const lines = rows.map((r) => {
    const final = r.finalAmount ?? r.commissionAmount + r.adjustment;
    return [
      r.repName,
      r.orderNumber,
      r.type,
      r.orderAmount.toFixed(2),
      r.ratePercent.toFixed(2),
      r.commissionAmount.toFixed(2),
      r.adjustment.toFixed(2),
      final.toFixed(2),
      r.type === "override" ? r.commissionAmount.toFixed(2) : "",
      r.status,
      r.payoutPeriod ?? "",
    ].join(",");
  });
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commissions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommissionLedger() {
  const dispatch = useAppDispatch();
  const commissions = useAppSelector((s) => s.commissions.commissions);
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const admin = isAdmin(role);

  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adjustTarget, setAdjustTarget] = useState<ICommission | null>(null);
  const [adjValue, setAdjValue] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [voidTarget, setVoidTarget] = useState<ICommission | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const c of commissions) if (c.payoutPeriod) set.add(c.payoutPeriod);
    return Array.from(set).sort().reverse();
  }, [commissions]);

  const filtered = useMemo(
    () => selectedPeriod === "all" ? commissions : commissions.filter((c) => c.payoutPeriod === selectedPeriod),
    [commissions, selectedPeriod],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleApprove() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        const result = await approveCommissions(ids);
        if (result.success) {
          ids.forEach((id) => {
            const c = commissions.find((x) => x.id === id);
            if (c) dispatch(updateCommissionInStore({ ...c, status: "approved" }));
          });
          setSelectedIds(new Set());
          toast.success(`${ids.length} commission(s) approved.`);
        } else {
          toast.error(result.error ?? "Failed to approve commissions.");
        }
      } catch (err) {
        console.error("[CommissionLedger] approveCommissions error:", err);
        toast.error("Failed to approve commissions.");
      }
    });
  }

  function openAdjust(c: ICommission) {
    setAdjustTarget(c);
    setAdjValue(String(c.adjustment));
    setAdjNotes(c.notes ?? "");
  }

  function handleAdjust() {
    if (!adjustTarget) return;
    const adj = parseFloat(adjValue) || 0;
    startTransition(async () => {
      const result = await adjustCommission(adjustTarget.id, adj, adjNotes);
      if (result.success) {
        dispatch(updateCommissionInStore({ ...adjustTarget, adjustment: adj, notes: adjNotes }));
        setAdjustTarget(null);
        toast.success("Commission adjusted.");
      } else {
        toast.error(result.error ?? "Failed to adjust commission.");
      }
    });
  }

  function handleReset() {
    if (!adjustTarget) return;
    startTransition(async () => {
      const result = await adjustCommission(adjustTarget.id, 0, "");
      if (result.success) {
        dispatch(updateCommissionInStore({ ...adjustTarget, adjustment: 0, notes: "" }));
        setAdjustTarget(null);
        toast.success("Adjustment reset.");
      } else {
        toast.error(result.error ?? "Failed to reset adjustment.");
      }
    });
  }

  function openVoid(c: ICommission) {
    setVoidTarget(c);
    setVoidReason("");
  }

  function handleVoid() {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for voiding this commission.");
      return;
    }
    startTransition(async () => {
      const result = await voidCommission(voidTarget.id, reason);
      if (result.success) {
        dispatch(updateCommissionInStore({ ...voidTarget, status: "void", notes: reason }));
        setVoidTarget(null);
        toast.success("Commission voided.");
      } else {
        toast.error(result.error ?? "Failed to void commission.");
      }
    });
  }

  const pendingSelected = Array.from(selectedIds).filter(
    (id) => commissions.find((c) => c.id === id)?.status === "pending",
  );

  if (!mounted) return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="animate-pulse px-4 py-[0.8rem]">
        <div className="h-4 w-36 rounded bg-[var(--border2)]" />
        <div className="mt-1.5 h-3 w-44 rounded bg-[var(--border2)]" />
      </div>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-[0.8rem]">
          <div>
            <p className="text-[13px] font-semibold text-[var(--navy)]">Commission Ledger</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">All earned commissions</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Period filter */}
            <select
              value={selectedPeriod}
              onChange={(e) => { setSelectedPeriod(e.target.value); setSelectedIds(new Set()); }}
              className="h-8 rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text2)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All periods</option>
              {periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Bulk approve (admin, pending selected) */}
            {admin && pendingSelected.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[12px]"
                disabled={isPending}
                onClick={handleApprove}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Approve ({pendingSelected.length})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[12px]"
              onClick={() => exportCSV(filtered)}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text3)]">No commissions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  {admin && <th className="w-8 px-4 py-[9px]" />}
                  {["Rep", "Order #", "Sale Amt", "Rate", "Commission", "Adj", "Override", "Status", ...(admin ? [""] : [])].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
                    {admin && (
                      <td className="px-4 py-[10px]">
                        {row.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            className="accent-[var(--teal)] cursor-pointer"
                          />
                        )}
                      </td>
                    )}
                    {/* Rep avatar + name */}
                    <td className="px-4 py-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--teal-lt)] text-[10px] font-semibold text-[var(--teal)]">
                          {initials(row.repName)}
                        </div>
                        <span className="text-[13px] font-medium text-[var(--navy)]">{row.repName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-[10px] text-[12px] text-[var(--text2)]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
                      {row.orderNumber}
                    </td>
                    <td className="px-4 py-[10px] text-[13px]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
                      {formatAmount(row.orderAmount)}
                    </td>
                    <td className="px-4 py-[10px] text-[13px]">{row.ratePercent}%</td>
                    <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--teal)]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
                      {formatAmount(row.finalAmount ?? row.commissionAmount + row.adjustment)}
                    </td>
                    <td className="px-4 py-[10px] text-[13px]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
                      {row.adjustment === 0 ? (
                        <span className="text-[var(--text3)]">—</span>
                      ) : row.adjustment > 0 ? (
                        <span className="text-emerald-600">+{formatAmount(row.adjustment)}</span>
                      ) : (
                        <span className="text-red-500">-{formatAmount(Math.abs(row.adjustment))}</span>
                      )}
                    </td>
                    <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">
                      {row.type === "override" ? formatAmount(row.commissionAmount) : "—"}
                    </td>
                    <td className="px-4 py-[10px]">
                      <PillBadge
                        label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        variant={STATUS_VARIANT[row.status] ?? "gold"}
                      />
                    </td>
                    {admin && (
                      <td className="px-4 py-[10px]">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAdjust(row)}
                            className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                          >
                            Adjust
                          </button>
                          {(row.status === "pending" || row.status === "approved") && (
                            <button
                              type="button"
                              onClick={() => openVoid(row)}
                              className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust modal */}
      <Dialog open={!!adjustTarget} onOpenChange={(v) => { if (!v) setAdjustTarget(null); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Adjust Commission</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">{adjustTarget?.orderNumber} — {adjustTarget?.repName}</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Adjustment ($)</Label>
              <Input
                type="number"
                value={adjValue}
                onChange={(e) => setAdjValue(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Notes</Label>
              <Input
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                placeholder="Reason for adjustment..."
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            {adjustTarget && adjustTarget.adjustment !== 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleReset}
                className="border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                Reset
              </Button>
            )}
            <Button size="sm" className="flex-1 bg-[var(--navy)] hover:bg-[#1a3f60]" disabled={isPending} onClick={handleAdjust}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void modal */}
      <Dialog open={!!voidTarget} onOpenChange={(v) => { if (!v) setVoidTarget(null); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Void Commission</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">
              {voidTarget?.orderNumber} — {voidTarget?.repName} — {voidTarget ? formatAmount(voidTarget.finalAmount ?? voidTarget.commissionAmount + voidTarget.adjustment) : ""}
            </p>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-[12px] text-[var(--text2)]">
              Voiding this commission removes it from future payouts. This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Reason <span className="text-red-400">*</span></Label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Order refunded, sale reversed..."
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleVoid}
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
            >
              Void
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
