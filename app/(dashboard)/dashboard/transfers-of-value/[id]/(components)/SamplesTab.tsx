"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/app/(components)/EmptyState";
import { removeSampleEntryFromStore } from "../../(redux)/transfers-of-value-slice";
import { deleteSampleEntry } from "../../(services)/sample-actions";
import type { IValueSampleEntry } from "@/utils/interfaces/value-transfers";
import { AddSampleModal } from "./AddSampleModal";

export function SamplesTab({ canEdit }: { canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const reportId = useAppSelector((s) => s.transfersOfValue.activeReport?.id);
  const entries = useAppSelector((s) => s.transfersOfValue.sampleEntries);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!reportId) return null;

  function handleDelete(entry: IValueSampleEntry) {
    if (!confirm(`Delete ${entry.productLot} for ${entry.recipientFacility}?`)) return;
    setPendingDeleteId(entry.id);
    startTransition(async () => {
      const result = await deleteSampleEntry(entry.id, reportId!);
      if (result.success) {
        dispatch(removeSampleEntryFromStore(entry.id));
        toast.success("Sample deleted.");
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
            {entries.length} sample{entries.length === 1 ? "" : "s"} / eval unit{entries.length === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-[var(--text3)] max-w-md">
            Tracked separately — samples for patient use and short-term evals (under 90 days) are not reportable, but logged here for FDA/inventory.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Log sample
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No samples logged"
        />
      ) : (
        <div className="bg-white rounded-lg border border-[#E8EFF5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFBFC] border-b border-[#E8EFF5]">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text3)] font-semibold">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Recipient / facility</th>
                  <th className="px-3 py-2.5">Product / lot</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Purpose</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Return</th>
                  {canEdit && <th className="px-3 py-2.5 w-[60px]" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-[#E8EFF5] hover:bg-[#FAFBFC]">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {new Date(e.sampleDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">{e.recipientFacility}</td>
                    <td className="px-3 py-2.5">{e.productLot}</td>
                    <td className="px-3 py-2.5 text-right">{e.quantity}</td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      {e.purpose ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden lg:table-cell">
                      {e.returnDate ? new Date(e.returnDate).toLocaleDateString() : "—"}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(e)}
                          disabled={pendingDeleteId === e.id}
                          aria-label="Delete"
                          className="p-1.5 rounded text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {pendingDeleteId === e.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canEdit && (
        <AddSampleModal open={addOpen} onClose={() => setAddOpen(false)} reportId={reportId} />
      )}
    </div>
  );
}
