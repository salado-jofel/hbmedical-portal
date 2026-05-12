"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Package } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppDispatch } from "@/store/hooks";
import {
  addSampleEntry,
  getSampleEntries,
} from "../../(services)/sample-actions";
import { setSampleEntries } from "../../(redux)/transfers-of-value-slice";
import type { IValueSampleEntryFormState } from "@/utils/interfaces/value-transfers";

export function AddSampleModal({
  open,
  onClose,
  reportId,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
}) {
  const dispatch = useAppDispatch();
  const [state, formAction, isPending] = useActionState<
    IValueSampleEntryFormState | null,
    FormData
  >(addSampleEntry, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Sample logged.");
      void getSampleEntries(reportId).then((entries) => {
        dispatch(setSampleEntries(entries));
      });
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg sm:rounded-2xl max-h-[calc(100vh-2rem)] overflow-auto">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <Package className="w-4 h-4 text-[var(--navy)]" />
            Log a sample / evaluation unit
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="report_id" value={reportId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sample_date" className="text-xs">
                Date <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                id="sample_date"
                name="sample_date"
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.sample_date && (
                <p className="text-xs text-red-500">{state.fieldErrors.sample_date}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs">
                Quantity <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                id="quantity"
                name="quantity"
                min="1"
                step="1"
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.quantity && (
                <p className="text-xs text-red-500">{state.fieldErrors.quantity}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipient_facility" className="text-xs">
              Recipient / facility <span className="text-red-400">*</span>
            </Label>
            <Input
              id="recipient_facility"
              name="recipient_facility"
              className="h-9 text-sm"
              maxLength={240}
              required
            />
            {state?.fieldErrors?.recipient_facility && (
              <p className="text-xs text-red-500">{state.fieldErrors.recipient_facility}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product_lot" className="text-xs">
              Product / lot <span className="text-red-400">*</span>
            </Label>
            <Input
              id="product_lot"
              name="product_lot"
              className="h-9 text-sm"
              maxLength={240}
              required
            />
            {state?.fieldErrors?.product_lot && (
              <p className="text-xs text-red-500">{state.fieldErrors.product_lot}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purpose" className="text-xs">
                Purpose
              </Label>
              <Input
                id="purpose"
                name="purpose"
                placeholder="e.g. patient use, eval"
                className="h-9 text-sm"
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return_date" className="text-xs">
                Return date (if eval)
              </Label>
              <Input
                type="date"
                id="return_date"
                name="return_date"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
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
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Log sample"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
