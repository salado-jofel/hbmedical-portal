import { Product } from "@/app/(interfaces)/product";
import { useAppDispatch } from "@/store/hooks";
import { useState } from "react";
import { removeProductFromStore, updateProductInStore } from "../(redux)/products-slice";
import { deleteProduct, editProduct } from "../(services)/actions";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { NotSyncedBadge } from "@/app/(components)/NotSyncBadge";
import { QBSyncBadge } from "@/app/(components)/QBSyncBadge";
import SubmitButton from "@/app/(components)/SubmitButton";
import { Input } from "@/components/ui/input";
import { Package, X, Check, Pencil, Trash2 } from "lucide-react";

// ─── Product Card (mobile) ────────────────────────────────────────────────────
export function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!product.id) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("price", price);
      await editProduct(product.id, formData);
      dispatch(
        updateProductInStore({
          ...product,
          name,
          price: parseFloat(price) || 0,
        }),
      );
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!product.id) return;
    setIsDeleting(true);
    try {
      await deleteProduct(product.id);
      dispatch(removeProductFromStore(product.id));
      setConfirmOpen(false);
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

      <div className="p-4 border-b border-slate-100 last:border-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2db0b0]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Package className="w-4 h-4 text-[#2db0b0]" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {isEditing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm"
                  disabled={isSaving}
                />
              ) : (
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {product.name}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {isEditing ? (
                  <Input
                    value={price}
                    type="number"
                    min="0"
                    step="0.01"
                    onChange={(e) => setPrice(e.target.value)}
                    className="h-7 text-sm w-28"
                    disabled={isSaving}
                  />
                ) : (
                  <span className="text-sm font-medium text-[#2db0b0]">
                    ${Number(product.price).toFixed(2)}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {product.created_at
                    ? new Date(product.created_at).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>
              {/* ✅ QB status → QBSyncBadge / NotSyncedBadge */}
              <div>
                {product.qb_item_id ? (
                  <QBSyncBadge syncedAt={product.qb_synced_at} />
                ) : (
                  <NotSyncedBadge />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setName(product.name);
                    setPrice(String(product.price));
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
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
                  classname="text-[#2db0b0] hover:bg-transparent cursor-pointer"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isDeleting}
                  className="p-1.5 text-slate-300 hover:text-[#2db0b0] rounded cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isDeleting}
                  className="p-1.5 text-slate-300 hover:text-red-500 rounded cursor-pointer"
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
