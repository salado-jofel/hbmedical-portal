"use client";

import { Product } from "@/utils/interfaces/products";
import { useAppDispatch } from "@/store/hooks";
import { useState } from "react";
import {
  removeProductFromStore,
  updateProductInStore,
} from "../(redux)/products-slice";
import { deleteProduct, editProduct } from "../(services)/actions";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import SubmitButton from "@/app/(components)/SubmitButton";
import { Input } from "@/components/ui/input";
import { Package, X, Check, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sku, setSku] = useState(product.sku);
  const [name, setName] = useState(product.name);
  const [unitPrice, setUnitPrice] = useState(String(product.unit_price));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("sku", sku);
      formData.set("name", name);
      formData.set("description", product.description ?? "");
      formData.set("category", product.category ?? "");
      formData.set("unit_price", unitPrice);
      formData.set("sort_order", String(product.sort_order));
      if (product.is_active) formData.set("is_active", "on");

      const updated = await editProduct(product.id, formData);
      dispatch(updateProductInStore(updated));
      setIsEditing(false);
      toast.success("Product updated successfully!");
    } catch (err) {
      console.error("[ProductCard] Edit error:", err);
      toast.error("Failed to update product.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await deleteProduct(product.id);
      dispatch(removeProductFromStore(product.id));
      setConfirmOpen(false);
      toast.success(`"${product.name}" deleted successfully.`);
    } catch (err) {
      console.error("[ProductCard] Delete error:", err);
      toast.error("Failed to delete product.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Product?"
        description={`"${product.name}" will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      <div className="p-4 border-b border-[var(--border)] last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
              <Package className="w-4 h-4 text-[var(--navy)]" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-sm"
                    disabled={isSaving}
                  />
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="h-8 text-sm"
                    disabled={isSaving}
                  />
                  <Input
                    value={unitPrice}
                    type="number"
                    min="0"
                    step="0.01"
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="h-8 text-sm w-28"
                    disabled={isSaving}
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[var(--navy)] truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-[var(--text3)] truncate">
                    {product.sku}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#E8821A]">
                      ${Number(product.unit_price).toFixed(2)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        product.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[var(--border)] text-[var(--text2)]"
                      }`}
                    >
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSku(product.sku);
                    setName(product.name);
                    setUnitPrice(String(product.unit_price));
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                  className="p-1.5 text-[var(--text3)] hover:text-[var(--text2)] rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <SubmitButton
                  type="button"
                  onClick={handleSave}
                  isPending={isSaving}
                  cta={<Check className="w-4 h-4" />}
                  isPendingMesssage=""
                  variant="ghost"
                  size="icon-xs"
                  classname="text-[var(--navy)] hover:bg-transparent cursor-pointer"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isDeleting}
                  className="p-1.5 text-[var(--text3)] hover:text-[var(--navy)] rounded cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isDeleting}
                  className="p-1.5 text-[var(--text3)] hover:text-red-600 rounded cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
