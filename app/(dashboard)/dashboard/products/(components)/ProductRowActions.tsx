"use client";

import { X, Check, Pencil, Trash2 } from "lucide-react";
import SubmitButton from "@/app/(components)/SubmitButton";
import type { Product, RowEdit } from "@/utils/interfaces/products";

export function ProductRowActions({
  product,
  editingRow,
  savingId,
  deletingId,
  onStartEditing,
  onCancelEditing,
  onSave,
  onDeleteClick,
}: {
  product: Product;
  editingRow: RowEdit | undefined;
  savingId: string | null;
  deletingId: string | null;
  onStartEditing: (product: Product) => void;
  onCancelEditing: (id: string) => void;
  onSave: (product: Product) => void;
  onDeleteClick: (id: string) => void;
}) {
  const isEditing = !!editingRow;
  const saving = savingId === product.id;
  const deleting = deletingId === product.id;

  const isRowValid =
    isEditing &&
    editingRow.sku.trim() !== "" &&
    editingRow.name.trim() !== "" &&
    editingRow.unit_price.trim() !== "" &&
    Number(editingRow.unit_price) >= 0;

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <>
          <button
            type="button"
            onClick={() => onCancelEditing(product.id)}
            disabled={saving}
            className="p-1.5 text-[var(--text3)] hover:text-[var(--text2)] transition-colors rounded disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <SubmitButton
            type="button"
            onClick={() => onSave(product)}
            isPending={saving}
            disabled={!isRowValid || saving}
            cta={<Check className="w-4 h-4" />}
            isPendingMesssage=""
            variant="ghost"
            size="icon-xs"
            classname="text-[var(--navy)] hover:text-[#125d8e] hover:bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onStartEditing(product)}
            disabled={deleting}
            className="p-1.5 text-[var(--text3)] hover:text-[var(--navy)] transition-colors rounded disabled:opacity-40 cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteClick(product.id)}
            disabled={deleting}
            className="p-1.5 text-[var(--text3)] hover:text-red-600 transition-colors rounded disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
