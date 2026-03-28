"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import ConfirmModal from "@/app/(components)/ConfirmModal";

interface AdminBulkBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => Promise<void>;
}

export function AdminBulkBar({ selectedCount, onClear, onBulkDelete }: AdminBulkBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (selectedCount === 0) return null;

  async function handleConfirmDelete() {
    try {
      setLoading(true);
      await onBulkDelete();
      setConfirmOpen(false);
      onClear();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-slate-700">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Selected
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(val) => { if (!loading) setConfirmOpen(val); }}
        onConfirm={handleConfirmDelete}
        isLoading={loading}
        title="Delete Selected Materials"
        description={`Are you sure you want to delete ${selectedCount} ${selectedCount === 1 ? "material" : "materials"}? This will permanently remove the files from storage and cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}
