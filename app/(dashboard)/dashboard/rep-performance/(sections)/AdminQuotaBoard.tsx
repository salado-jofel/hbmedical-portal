"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PillBadge } from "@/app/(components)/PillBadge";
import { useAppSelector } from "@/store/hooks";
import { setQuota } from "../(services)/actions";
import { formatAmount } from "@/utils/helpers/formatter";
import type { IQuotaFormState } from "@/utils/interfaces/quotas";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type AttainVariant = "green" | "teal" | "gold" | "red";

function attainVariant(pct: number | null): AttainVariant {
  if (pct === null) return "gold";
  if (pct >= 100)   return "green";
  if (pct >= 75)    return "teal";
  if (pct >= 25)    return "gold";
  return "red";
}

export default function AdminQuotaBoard() {
  const router  = useRouter();
  const summary = useAppSelector((s) => s.repPerformance.summary);
  const reps    = summary?.subRepPerformance ?? [];
  const period  = summary?.currentPeriod ?? "";

  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<IQuotaFormState | null, FormData>(setQuota, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Quota set.");
      setOpen(false);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[0.8rem]">
          <div>
            <p className="text-[13px] font-semibold text-[var(--navy)]">Rep Quota Board</p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">
              {period} — all rep performance
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-[12px]" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Set Quota
          </Button>
        </div>

        {reps.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text3)]">No reps found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  {["Rep", "Revenue", "Quota", "Attainment", "Commission", "Orders", "Avg Order"].map((h) => (
                    <th key={h} className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => {
                  const pct    = rep.attainmentPct;
                  const capped = Math.min(pct ?? 0, 100);
                  return (
                    <tr key={rep.repId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
                      <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]">{rep.repName}</td>
                      <td className="px-4 py-[10px] text-[13px]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>{formatAmount(rep.actualRevenue)}</td>
                      <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>
                        {rep.quota != null ? formatAmount(rep.quota) : <span className="text-[var(--text3)]">—</span>}
                      </td>
                      <td className="px-4 py-[10px]">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-[6px] w-[56px] overflow-hidden rounded-full bg-[var(--border2)]">
                              <div className="h-full rounded-full bg-[var(--teal-mid)]" style={{ width: `${capped}%` }} />
                            </div>
                            <PillBadge label={`${pct.toFixed(1)}%`} variant={attainVariant(pct)} />
                          </div>
                        ) : <span className="text-[12px] text-[var(--text3)]">—</span>}
                      </td>
                      <td className="px-4 py-[10px] text-[13px]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>{formatAmount(rep.commissionEarned)}</td>
                      <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">{rep.paidOrders}</td>
                      <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]" style={{ fontFamily: "var(--font-dm-mono), monospace" }}>{formatAmount(rep.avgOrderValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set Quota dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Set Sales Quota</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">Upserts quota for the selected rep and period</p>
          </div>
          <form action={formAction}>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Sales Rep <span className="text-red-400">*</span></Label>
                <select
                  name="rep_id"
                  required
                  className="h-9 w-full rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Select a rep…</option>
                  {reps.map((r) => (
                    <option key={r.repId} value={r.repId}>{r.repName}</option>
                  ))}
                </select>
                {state?.fieldErrors?.rep_id && <p className="text-[11px] text-red-500">{state.fieldErrors.rep_id}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Period (YYYY-MM) <span className="text-red-400">*</span></Label>
                <Input name="period" defaultValue={period} placeholder="2026-04" className="h-9 text-sm" required />
                {state?.fieldErrors?.period && <p className="text-[11px] text-red-500">{state.fieldErrors.period}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Target Amount ($) <span className="text-red-400">*</span></Label>
                <Input name="target_amount" type="number" min={0} step={100} placeholder="50000" className="h-9 text-sm" required />
                {state?.fieldErrors?.target_amount && <p className="text-[11px] text-red-500">{state.fieldErrors.target_amount}</p>}
              </div>
              {state?.error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-500">{state.error}</p>
              )}
            </div>
            <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={isPending} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="flex-1 bg-[var(--navy)] hover:bg-[#1a3f60]" disabled={isPending}>
                {isPending ? "Saving…" : "Save Quota"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
