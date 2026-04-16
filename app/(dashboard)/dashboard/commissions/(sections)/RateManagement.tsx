"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAppSelector } from "@/store/hooks";
import { setCommissionRate } from "../(services)/actions";
import { formatDate } from "@/utils/helpers/formatter";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import type { ICommissionRateFormState } from "@/utils/interfaces/commissions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RateManagement({
  reps,
  lockedRepId,
}: {
  reps: Array<{ id: string; name: string }>;
  lockedRepId?: string;
}) {
  const rates = useAppSelector((s) => s.commissions.rates);
  const role = useAppSelector((s) => s.dashboard.role) as UserRole;
  const userId = useAppSelector((s) => s.dashboard.userId);
  const admin = isAdmin(role);
  const isRep = isSalesRep(role);

  const displayRates = lockedRepId
    ? rates.filter((r) => r.repId === lockedRepId)
    : isRep
      ? rates.filter((r) => r.repId !== userId)
      : rates;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [state, formAction, isPending] = useActionState<ICommissionRateFormState | null, FormData>(
    setCommissionRate,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Commission rate set.");
      setOpen(false);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (!mounted) return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="animate-pulse px-4 py-[0.8rem]">
        <div className="h-4 w-36 rounded bg-[var(--border2)]" />
        <div className="mt-1.5 h-3 w-28 rounded bg-[var(--border2)]" />
      </div>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[0.8rem]">
          <div>
            <p className="text-[13px] font-semibold text-[var(--navy)]">
              {isRep ? "Sub-Rep Rates" : "Commission Rates"}
            </p>
            <p className="mt-[1px] text-[11px] text-[var(--text3)]">
              {isRep ? "Commission rates for your sub-representatives" : "Active rates per rep"}
            </p>
          </div>
          {(admin || reps.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[12px]"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {isRep ? "Set Sub-Rep Rate" : "Set Rate"}
            </Button>
          )}
        </div>

        {displayRates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="w-8 h-8 text-[#cbd5e1] mb-2" />
            <p className="text-[13px] text-[var(--text3)]">
              {isRep ? "No sub-rep rates configured" : "No rates configured yet"}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text3)]">
              {isRep
                ? "Set commission rates for your sub-representatives using the button above"
                : "No commission rates have been set yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  {[isRep ? "Sub-Rep" : "Rep Name", "Rate %", "Override %", "Effective From", "Set By"].map((h) => (
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
                {displayRates.map((rate) => (
                  <tr key={rate.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]">
                    <td className="px-4 py-[10px] text-[13px] font-medium text-[var(--navy)]">{rate.repName}</td>
                    <td className="px-4 py-[10px] text-[13px]">{rate.ratePercent}%</td>
                    <td className="px-4 py-[10px] text-[13px]">{rate.overridePercent}%</td>
                    <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">{formatDate(rate.effectiveFrom)}</td>
                    <td className="px-4 py-[10px] text-[13px] text-[var(--text2)]">{rate.setByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set Rate Modal */}
      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">Set Commission Rate</DialogTitle>
            <p className="mt-0.5 text-[11px] text-[var(--text3)]">
              {admin ? "Set rate for any sales rep" : "Set rate for your sub-reps"}
            </p>
          </div>

          <form action={formAction}>
            <div className="space-y-4 p-5">
              {/* Rep select */}
              {lockedRepId ? (
                <input type="hidden" name="rep_id" value={lockedRepId} />
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">
                    Sales Rep <span className="text-red-400">*</span>
                  </Label>
                  <select
                    name="rep_id"
                    required
                    className="h-9 w-full rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">Select a rep…</option>
                    {reps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.name}
                      </option>
                    ))}
                  </select>
                  {state?.fieldErrors?.rep_id && (
                    <p className="text-[11px] text-red-500">{state.fieldErrors.rep_id}</p>
                  )}
                </div>
              )}

              {/* Rate percent */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">
                  Rate % <span className="text-red-400">*</span>
                </Label>
                <Input
                  name="rate_percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="5"
                  className="h-9 text-sm"
                  required
                />
                {state?.fieldErrors?.rate_percent && (
                  <p className="text-[11px] text-red-500">{state.fieldErrors.rate_percent}</p>
                )}
              </div>

              {/* Override percent */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Override %</Label>
                <Input
                  name="override_percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="0"
                  defaultValue="0"
                  className="h-9 text-sm"
                />
                {state?.fieldErrors?.override_percent && (
                  <p className="text-[11px] text-red-500">{state.fieldErrors.override_percent}</p>
                )}
              </div>

              {state?.error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-500">
                  {state.error}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-[var(--border)] px-5 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 bg-[var(--navy)] hover:bg-[#1a3f60]"
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save Rate"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
