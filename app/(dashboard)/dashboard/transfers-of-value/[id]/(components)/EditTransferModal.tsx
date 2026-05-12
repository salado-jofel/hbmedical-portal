"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Pencil } from "lucide-react";
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
  updateTransferEntry,
  getTransferEntries,
} from "../../(services)/transfer-entry-actions";
import { setTransferEntries } from "../../(redux)/transfers-of-value-slice";
import type {
  IValueTransferEntry,
  IValueTransferEntryFormState,
} from "@/utils/interfaces/value-transfers";
import { TransferEntryFields } from "./TransferEntryFields";

export function EditTransferModal({
  open,
  onClose,
  entry,
  reportId,
}: {
  open: boolean;
  onClose: () => void;
  entry: IValueTransferEntry;
  reportId: string;
}) {
  const dispatch = useAppDispatch();
  const [state, formAction, isPending] = useActionState<
    IValueTransferEntryFormState | null,
    FormData
  >(updateTransferEntry, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Transfer updated.");
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
            <Pencil className="w-4 h-4 text-[var(--navy)]" />
            Edit transfer
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="report_id" value={reportId} />
          <input type="hidden" name="entry_id" value={entry.id} />
          <TransferEntryFields initial={entry} fieldErrors={state?.fieldErrors} />

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
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
