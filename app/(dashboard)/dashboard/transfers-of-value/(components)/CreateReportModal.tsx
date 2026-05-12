"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FilePlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createValueReport } from "../(services)/actions";
import {
  MONTH_LABELS,
  TRANSFERS_OF_VALUE_PATH,
} from "@/utils/constants/value-transfers";
import type { IValueReportFormState } from "@/utils/interfaces/value-transfers";

export function CreateReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const [state, formAction, isPending] = useActionState<
    IValueReportFormState | null,
    FormData
  >(createValueReport, null);

  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));

  useEffect(() => {
    if (!state) return;
    if (state.success && state.reportId) {
      toast.success("Report created.");
      router.push(`${TRANSFERS_OF_VALUE_PATH}/${state.reportId}`);
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Year dropdown: current year + prior year (reps may need to file a late
  // report for last year's last month).
  const yearOptions = [currentYear, currentYear - 1];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <FilePlus className="w-4 h-4 text-[var(--navy)]" />
            Start a new monthly report
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reporting_month" className="text-xs">
                Month <span className="text-red-400">*</span>
              </Label>
              <input type="hidden" name="reporting_month" value={month} />
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="reporting_month" className="h-9 text-sm">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((label, idx) => (
                    <SelectItem key={label} value={String(idx + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.fieldErrors?.reporting_month && (
                <p className="text-xs text-red-500">{state.fieldErrors.reporting_month}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reporting_year" className="text-xs">
                Year <span className="text-red-400">*</span>
              </Label>
              <input type="hidden" name="reporting_year" value={year} />
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="reporting_year" className="h-9 text-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.fieldErrors?.reporting_year && (
                <p className="text-xs text-red-500">{state.fieldErrors.reporting_year}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="territory" className="text-xs">
              Territory
            </Label>
            <Input
              id="territory"
              name="territory"
              placeholder="Optional — e.g. Northeast, Pacific NW"
              className="h-9 text-sm"
              maxLength={120}
            />
            {state?.fieldErrors?.territory && (
              <p className="text-xs text-red-500">{state.fieldErrors.territory}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Start report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
