"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/app/(components)/EmptyState";
import { removeGroupMealEntryFromStore } from "../../(redux)/transfers-of-value-slice";
import { deleteGroupMealEntry } from "../../(services)/group-meal-actions";
import type { IValueGroupMealEntry } from "@/utils/interfaces/value-transfers";
import { AddGroupMealModal } from "./AddGroupMealModal";

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function GroupMealsTab({ canEdit }: { canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const reportId = useAppSelector((s) => s.transfersOfValue.activeReport?.id);
  const entries = useAppSelector((s) => s.transfersOfValue.groupMealEntries);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!reportId) return null;

  function handleDelete(entry: IValueGroupMealEntry) {
    if (!confirm(`Delete the group meal from ${entry.groupMealDate}?`)) return;
    setPendingDeleteId(entry.id);
    startTransition(async () => {
      const result = await deleteGroupMealEntry(entry.id, reportId!);
      if (result.success) {
        dispatch(removeGroupMealEntryFromStore(entry.id));
        toast.success("Group meal deleted.");
      } else {
        toast.error(result.error ?? "Failed to delete.");
      }
      setPendingDeleteId(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">
            {entries.length} group meal{entries.length === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-[var(--text3)] max-w-md">
            Per-person allocation = total cost ÷ total attendees, applied to each Covered Recipient.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Log group meal
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 stroke-1" />}
          message="No group meals logged"
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-lg border border-[#E8EFF5] p-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--navy)]">
                    {new Date(e.groupMealDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-[var(--text3)] mt-0.5">
                    {formatUsd(e.totalCost)} ÷ {e.totalAttendees} attendees ={" "}
                    <span className="font-medium text-[#15689E]">
                      {formatUsd(e.perPersonAllocation)}
                    </span>{" "}
                    per recipient
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(e)}
                    disabled={pendingDeleteId === e.id}
                    aria-label="Delete"
                    className="self-end sm:self-start p-1.5 rounded text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {pendingDeleteId === e.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    )}
                  </button>
                )}
              </div>

              {e.coveredRecipients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.coveredRecipients.map((r, i) => (
                    <span
                      key={`${r.name}-${i}`}
                      className="text-[11px] px-2 py-0.5 rounded bg-[#15689E]/5 text-[#15689E] border border-[#15689E]/10"
                    >
                      {r.name} ({r.credential})
                    </span>
                  ))}
                </div>
              )}

              {e.notes && (
                <p className="mt-2 text-xs text-[var(--text2)]">{e.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <AddGroupMealModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          reportId={reportId}
        />
      )}
    </div>
  );
}
