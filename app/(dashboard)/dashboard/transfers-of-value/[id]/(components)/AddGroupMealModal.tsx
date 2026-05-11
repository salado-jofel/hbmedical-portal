"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Users, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAppDispatch } from "@/store/hooks";
import {
  addGroupMealEntry,
  getGroupMealEntries,
} from "../../(services)/group-meal-actions";
import { setGroupMealEntries } from "../../(redux)/transfers-of-value-slice";
import {
  RECIPIENT_CREDENTIALS,
  RECIPIENT_CREDENTIAL_LABELS,
  type RecipientCredential,
} from "@/utils/constants/value-transfers";
import type {
  IGroupMealRecipient,
  IValueGroupMealEntryFormState,
} from "@/utils/interfaces/value-transfers";

function newRecipient(): IGroupMealRecipient {
  return { name: "", credential: "MD", npi: "" };
}

export function AddGroupMealModal({
  open,
  onClose,
  reportId,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
}) {
  const dispatch = useAppDispatch();
  const [recipients, setRecipients] = useState<IGroupMealRecipient[]>([newRecipient()]);
  const [totalCost, setTotalCost] = useState("");
  const [totalAttendees, setTotalAttendees] = useState("");

  const perPerson = useMemo(() => {
    const c = parseFloat(totalCost);
    const a = parseInt(totalAttendees, 10);
    if (!c || !a) return 0;
    return c / a;
  }, [totalCost, totalAttendees]);

  const [state, formAction, isPending] = useActionState<
    IValueGroupMealEntryFormState | null,
    FormData
  >(addGroupMealEntry, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Group meal logged.");
      void getGroupMealEntries(reportId).then((entries) => {
        dispatch(setGroupMealEntries(entries));
      });
      onClose();
      // reset local state for the next open
      setRecipients([newRecipient()]);
      setTotalCost("");
      setTotalAttendees("");
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function updateRecipient(idx: number, patch: Partial<IGroupMealRecipient>) {
    setRecipients((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRecipient() {
    setRecipients((prev) => [...prev, newRecipient()]);
  }
  function removeRecipient(idx: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  }

  // Strip empty rows before serializing.
  const cleanedRecipients = recipients
    .map((r) => ({ ...r, name: r.name.trim() }))
    .filter((r) => r.name.length > 0);
  const recipientsJson = JSON.stringify(cleanedRecipients);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl sm:rounded-2xl max-h-[calc(100vh-2rem)] overflow-auto">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <Users className="w-4 h-4 text-[var(--navy)]" />
            Log a group meal
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="report_id" value={reportId} />
          <input type="hidden" name="covered_recipients" value={recipientsJson} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="group_meal_date" className="text-xs">
                Date <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                id="group_meal_date"
                name="group_meal_date"
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.group_meal_date && (
                <p className="text-xs text-red-500">{state.fieldErrors.group_meal_date}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="total_cost" className="text-xs">
                Total cost <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                id="total_cost"
                name="total_cost"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.total_cost && (
                <p className="text-xs text-red-500">{state.fieldErrors.total_cost}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="total_attendees" className="text-xs">
                Total attendees <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                step="1"
                min="1"
                id="total_attendees"
                name="total_attendees"
                value={totalAttendees}
                onChange={(e) => setTotalAttendees(e.target.value)}
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.total_attendees && (
                <p className="text-xs text-red-500">{state.fieldErrors.total_attendees}</p>
              )}
            </div>
          </div>

          {perPerson > 0 && (
            <div className="px-3 py-2 bg-[#15689E]/5 border border-[#15689E]/20 rounded text-xs">
              Per-person allocation:{" "}
              <span className="font-semibold text-[#15689E]">
                {perPerson.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>{" "}
              applied to each Covered Recipient attendee below.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Covered Recipient attendees</Label>
              <button
                type="button"
                onClick={addRecipient}
                className="text-xs text-[#15689E] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add recipient
              </button>
            </div>

            {recipients.map((r, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-start p-2 bg-[#FAFBFC] border border-[#E8EFF5] rounded"
              >
                <Input
                  placeholder="Name"
                  value={r.name}
                  onChange={(e) => updateRecipient(idx, { name: e.target.value })}
                  className="col-span-5 h-8 text-xs"
                  maxLength={240}
                />
                <Select
                  value={r.credential}
                  onValueChange={(v) =>
                    updateRecipient(idx, { credential: v as RecipientCredential })
                  }
                >
                  <SelectTrigger className="col-span-3 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_CREDENTIALS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {RECIPIENT_CREDENTIAL_LABELS[c].split(" — ")[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="NPI (optional)"
                  value={r.npi ?? ""}
                  onChange={(e) => updateRecipient(idx, { npi: e.target.value })}
                  className="col-span-3 h-8 text-xs"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  aria-label="Remove recipient"
                  className="col-span-1 h-8 flex items-center justify-center text-[var(--text3)] hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Optional — occasion, venue, etc."
              className="min-h-[60px] text-sm"
              maxLength={1000}
            />
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
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Log group meal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
