"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Loader2, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/app/(components)/EmptyState";
import { removeTransferEntryFromStore } from "../../(redux)/transfers-of-value-slice";
import { deleteTransferEntry } from "../../(services)/transfer-entry-actions";
import {
  FORM_CATEGORY_LABELS,
  RECIPIENT_CREDENTIAL_LABELS,
} from "@/utils/constants/value-transfers";
import type { IValueTransferEntry } from "@/utils/interfaces/value-transfers";
import { AddTransferModal } from "./AddTransferModal";
import { EditTransferModal } from "./EditTransferModal";

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function TransferEntriesTab({ canEdit }: { canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const reportId = useAppSelector((s) => s.transfersOfValue.activeReport?.id);
  const entries = useAppSelector((s) => s.transfersOfValue.transferEntries);
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<IValueTransferEntry | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.valueAmount, 0),
    [entries],
  );

  if (!reportId) return null;

  function handleDelete(entry: IValueTransferEntry) {
    if (!confirm(`Delete the ${entry.transferDate} entry for ${entry.recipientName}?`))
      return;
    setPendingDeleteId(entry.id);
    startTransition(async () => {
      const result = await deleteTransferEntry(entry.id, reportId!);
      if (result.success) {
        dispatch(removeTransferEntryFromStore(entry.id));
        toast.success("Entry deleted.");
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
            {entries.length} transfer{entries.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-[var(--text3)]">
            Total value: <span className="font-medium">{formatUsd(total)}</span>
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Log transfer
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-10 h-10 stroke-1" />}
          message="No transfers logged yet"
          description={
            canEdit
              ? "Use 'Log transfer' to record any meal, gift, travel, or other transfer of value to a Covered Recipient."
              : "This rep has not logged any transfers for this month."
          }
        />
      ) : (
        <div className="bg-white rounded-lg border border-[#E8EFF5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFBFC] border-b border-[#E8EFF5]">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text3)] font-semibold">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Recipient</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Type</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Affiliation</th>
                  <th className="px-3 py-2.5">Form</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  {canEdit && <th className="px-3 py-2.5 text-right w-[80px]" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-[#E8EFF5] hover:bg-[#FAFBFC]">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {new Date(e.transferDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--navy)]">{e.recipientName}</div>
                      {e.recipientNpi && (
                        <div className="text-[10px] text-[var(--text3)]">NPI {e.recipientNpi}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      {RECIPIENT_CREDENTIAL_LABELS[e.recipientCredential].split(" — ")[0]}
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden lg:table-cell text-[var(--text2)]">
                      {e.affiliation ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {FORM_CATEGORY_LABELS[e.formCategory]}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {formatUsd(e.valueAmount)}
                      {e.isEstimate && (
                        <span className="ml-1 text-[10px] text-amber-600">est.</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditEntry(e)}
                          aria-label="Edit"
                          className="p-1.5 rounded text-[var(--text3)] hover:text-[#15689E] hover:bg-[#15689E]/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(e)}
                          disabled={pendingDeleteId === e.id}
                          aria-label="Delete"
                          className="ml-1 p-1.5 rounded text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
        <AddTransferModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          reportId={reportId}
        />
      )}
      {canEdit && editEntry && (
        <EditTransferModal
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          entry={editEntry}
          reportId={reportId}
        />
      )}
    </div>
  );
}
