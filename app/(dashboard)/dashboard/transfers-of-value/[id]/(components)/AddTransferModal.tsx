"use client";

import { useActionState, useEffect } from "react";
import { Loader2, FilePlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppDispatch } from "@/store/hooks";
import {
  addTransferEntry,
  getTransferEntries,
} from "../../(services)/transfer-entry-actions";
import { setTransferEntries } from "../../(redux)/transfers-of-value-slice";
import type { IValueTransferEntryFormState } from "@/utils/interfaces/value-transfers";
import { TransferEntryFields } from "./TransferEntryFields";

export function AddTransferModal({
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
    IValueTransferEntryFormState | null,
    FormData
  >(addTransferEntry, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Transfer logged.");
      // Re-fetch the list so the new row appears (server has already revalidated
      // the route, but Redux still holds the old list until we dispatch).
      void getTransferEntries(reportId).then((entries) => {
        dispatch(setTransferEntries(entries));
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
            <FilePlus className="w-4 h-4 text-[var(--navy)]" />
            Log a transfer of value
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="report_id" value={reportId} />
          <TransferEntryFields fieldErrors={state?.fieldErrors} />

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
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Log transfer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
