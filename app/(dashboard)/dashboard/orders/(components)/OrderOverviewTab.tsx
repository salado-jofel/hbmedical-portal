"use client";

import { Loader2, Plus, Minus, X, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardOrder, ProductRecord } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

export type DraftOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  totalAmount: number;
  isNew?: boolean;
};

interface OrderOverviewTabProps {
  isActive: boolean;
  order: DashboardOrder;
  liveOrder: DashboardOrder;
  canEdit: boolean;
  status: string;
  draftItems: DraftOrderItem[];
  savedItems: DraftOrderItem[];
  draftNotes: string;
  isOverviewDirty: boolean;
  isSavingOverview: boolean;
  showProductPicker: boolean;
  products: ProductRecord[];
  loadingProducts: boolean;
  quantities: Record<string, number>;
  orderTotal: number;
  setDraftNotes: (v: string) => void;
  setShowProductPicker: (v: boolean) => void;
  setQuantities: (
    fn: (prev: Record<string, number>) => Record<string, number>,
  ) => void;
  setItemToDelete: (v: { id: string; name: string } | null) => void;
  draftQtyChange: (itemId: string, newQty: number) => void;
  handleDiscardOverview: () => void;
  handleSaveOverview: () => void;
  handleAddProductsToDraft: () => void;
}

export function OrderOverviewTab({
  isActive,
  order,
  liveOrder,
  canEdit,
  status,
  draftItems,
  savedItems,
  draftNotes,
  isOverviewDirty,
  isSavingOverview,
  showProductPicker,
  products,
  loadingProducts,
  quantities,
  orderTotal,
  setDraftNotes,
  setShowProductPicker,
  setQuantities,
  setItemToDelete,
  draftQtyChange,
  handleDiscardOverview,
  handleSaveOverview,
  handleAddProductsToDraft,
}: OrderOverviewTabProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-6 space-y-5",
        !isActive && "hidden",
      )}
    >
      {/* ── Unified Save/Discard toolbar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-300 py-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Overview
          {canEdit && status === "draft" && isOverviewDirty && !isSavingOverview && (
            <span className="ml-2 text-amber-500 normal-case font-normal tracking-normal">
              • Unsaved changes
            </span>
          )}
        </h3>
        {canEdit && status === "draft" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardOverview}
              disabled={!isOverviewDirty || isSavingOverview}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg",
                "border border-gray-200 text-gray-500",
                "hover:bg-gray-50 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSaveOverview}
              disabled={!isOverviewDirty || isSavingOverview}
              className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-lg",
                "bg-[var(--navy)] text-white",
                "hover:bg-[var(--navy)]/90 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "flex items-center gap-2",
              )}
            >
              {isSavingOverview && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSavingOverview ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {/* ── Order Items ── */}
      <div className="space-y-3 ">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Order Items
            {draftItems.length > 0 && (
              <span className="ml-2 text-gray-300 normal-case font-normal">
                ({draftItems.length} item{draftItems.length !== 1 ? "s" : ""})
              </span>
            )}
          </h3>
        </div>

        {draftItems.length === 0 ? (
          <div className="py-8 text-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No products added yet.</p>
            <p className="text-xs text-gray-300 mt-1">
              Use &quot;+ Add Product&quot; to add items to this order.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            {/* Scrollable items list */}
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">
                      Qty
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">
                      Unit
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">
                      Total
                    </th>
                    {canEdit && status === "draft" && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {draftItems.map((item) => {
                    const qtyChanged =
                      !item.isNew &&
                      savedItems.find((s) => s.id === item.id)?.quantity !==
                        item.quantity;
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "transition-colors",
                          item.isNew
                            ? "bg-blue-50/40 hover:bg-blue-50/60"
                            : qtyChanged
                              ? "bg-amber-50/30 hover:bg-amber-50/50"
                              : "hover:bg-gray-50/50",
                        )}
                      >
                        <td className="px-4 py-3">
                          <p
                            className="font-medium text-gray-900 text-sm max-w-[180px] truncate"
                            title={item.productName}
                          >
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">
                              {item.productSku}
                            </p>
                            {item.isNew && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && status === "draft" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  draftQtyChange(item.id, item.quantity - 1)
                                }
                                className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30 transition-colors text-xs"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  draftQtyChange(item.id, item.quantity + 1)
                                }
                                className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30 transition-colors text-xs"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-right text-sm tabular-nums text-gray-700">
                              ×{item.quantity}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                          $
                          {(
                            item.subtotal ?? item.unitPrice * item.quantity
                          ).toFixed(2)}
                        </td>
                        {canEdit && status === "draft" && (
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setItemToDelete({
                                  id: item.id,
                                  name: item.productName,
                                })
                              }
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title="Remove item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Order total — always visible below scroll */}
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex justify-end">
              <div className="flex items-center gap-8">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Order Total
                </span>
                <span className="text-base font-bold text-gray-900 tabular-nums">
                  ${orderTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Add product — draft only */}
        {canEdit && status === "draft" && !showProductPicker && (
          <button
            type="button"
            onClick={() => setShowProductPicker(true)}
            className="text-sm text-[var(--navy)] font-medium hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        )}

        {/* Product picker */}
        {canEdit &&
          status === "draft" &&
          showProductPicker &&
          (() => {
            const addedProductIds = new Set(
              draftItems.map((i) => i.productId).filter(Boolean),
            );
            const availableProducts = products.filter(
              (p) => !addedProductIds.has(p.id),
            );
            const hasCartItems = Object.values(quantities).some((q) => q > 0);
            return (
              <div className="rounded-xl border border-gray-100 p-3 space-y-3">
                {loadingProducts ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading
                    products...
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-gray-400">
                      All available products have been added to this order.
                    </p>
                  </div>
                ) : (
                  availableProducts.map((prod) => {
                    const qty = quantities[prod.id] ?? 0;
                    return (
                      <div
                        key={prod.id}
                        className={cn(
                          "flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0",
                        )}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {prod.sku} · ${Number(prod.unit_price).toFixed(2)}
                            /unit
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={qty === 0}
                            onClick={() =>
                              setQuantities((p) => {
                                const n = { ...p };
                                if (qty <= 1) delete n[prod.id];
                                else n[prod.id] = qty - 1;
                                return n;
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((p) => ({
                                ...p,
                                [prod.id]: qty + 1,
                              }))
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setShowProductPicker(false);
                      setQuantities(() => ({}));
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-[var(--navy)] text-white"
                    disabled={!hasCartItems}
                    onClick={handleAddProductsToDraft}
                  >
                    Add to Order
                  </Button>
                </div>
              </div>
            );
          })()}
      </div>

      {/* ── Admin Notes (info request reason) ── */}
      {liveOrder.admin_notes && (
        <div className="space-y-2 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Additional Information Requested
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center">
                <Shield className="w-3 h-3 text-amber-700" />
              </div>
              <span className="text-xs font-semibold text-amber-700">
                Admin Request
              </span>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              {liveOrder.admin_notes}
            </p>
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      <div className="space-y-2 pb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Notes
        </h3>
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          disabled={!canEdit || status !== "draft"}
          placeholder={
            canEdit && status === "draft"
              ? "Add clinical notes..."
              : "No notes added."
          }
          rows={4}
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 resize-none disabled:opacity-60 disabled:cursor-default transition-shadow"
        />
      </div>
    </div>
  );
}
