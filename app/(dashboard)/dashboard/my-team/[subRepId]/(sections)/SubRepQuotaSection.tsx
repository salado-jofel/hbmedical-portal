"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/store/hooks";
import { setQuota } from "@/app/(dashboard)/dashboard/rep-performance/(services)/actions";
import { formatAmount } from "@/utils/helpers/formatter";
import type { IQuotaFormState } from "@/utils/interfaces/quotas";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

export default function SubRepQuotaSection() {
  const detail = useAppSelector((s) => s.subRepDetail.detail);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<IQuotaFormState | null, FormData>(
    setQuota,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Quota saved.");
      setOpen(false);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  if (!detail) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--navy)]">Quota</h2>
      <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text3)]">
            {periodLabel(detail.currentPeriod)}
          </p>
          {detail.quota == null ? (
            <p className="mt-1 text-sm text-[var(--text3)]">No quota set for this period.</p>
          ) : (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-[var(--navy)]">{formatAmount(detail.quota)} target</span>
              {detail.attainmentPct != null && (
                <span className="text-[var(--text3)]"> · {detail.attainmentPct.toFixed(1)}% attained</span>
              )}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Set Quota
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Set Quota</DialogTitle>
          <form action={formAction} className="space-y-3 mt-2">
            <input type="hidden" name="rep_id" value={detail.id} />

            <input type="hidden" name="period" value={detail.currentPeriod} />
            <p className="text-[11px] text-[var(--text3)]">
              Setting quota for <span className="font-semibold text-[var(--navy)]">{periodLabel(detail.currentPeriod)}</span>
            </p>

            <div>
              <Label htmlFor="target_amount">Target Amount ($)</Label>
              <Input
                id="target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={detail.quota ?? ""}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
