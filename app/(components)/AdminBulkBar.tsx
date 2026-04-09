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
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <span className="text-sm font-medium text-[var(--navy)]">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 h-9 text-sm font-medium text-[#374151] transition-colors hover:bg-[var(--bg)]"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 h-9 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
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
