"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Building2, Package, DollarSign, Layers, Pencil, AlertTriangle } from "lucide-react";
import { editOrder } from "../(services)/order-write-actions";
import {
  getUserFacility,
  getActiveProducts,
} from "../(services)/order-misc-actions";
import { useAppDispatch } from "@/store/hooks";
import { updateOrderInStore } from "../(redux)/orders-slice";
import type {
  DashboardOrder,
  FacilityRecord,
  ProductRecord,
} from "@/utils/interfaces/orders";
import { canEditOrder, getOrderLockReason } from "@/utils/helpers/orders";
import SubmitButton from "@/app/(components)/SubmitButton";
import toast from "react-hot-toast";

type EditOrderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder | null;
};

export function EditOrderModal({
  open,
  onOpenChange,
  order,
}: EditOrderModalProps) {
  const dispatch = useAppDispatch();

  const [facility, setFacility] = useState<FacilityRecord | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [isPending, setIsPending] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = order ? canEditOrder(order) : false;
  const lockReason = order ? getOrderLockReason(order) : null;

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !order) return;

    setProductId(order.product_id ?? "");
    setQuantity(Number(order.quantity) || 1);
  }, [open, order]);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setIsLoadingData(true);
      setError(null);

      try {
        const [fetchedFacility, fetchedProducts] = await Promise.all([
          getUserFacility(),
          getActiveProducts(),
        ]);

        setFacility(fetchedFacility);
        setProducts(fetchedProducts);
      } catch (err) {
        console.error("[EditOrderModal.fetchData]", err);
        const message =
          err instanceof Error ? err.message : "Failed to load order data.";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchData();
  }, [open]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  const unitPrice = Number(selectedProduct?.unit_price ?? 0);
  const totalAmount = unitPrice * quantity;

  const hasChanges =
    !!order &&
    (productId !== (order.product_id ?? "") || quantity !== Number(order.quantity));

  const isFormValid =
    !!facility &&
    !!selectedProduct &&
    quantity >= 1 &&
    !isLoadingData &&
    isEditable &&
    hasChanges;

  function resetForm() {
    if (order) {
      setProductId(order.product_id ?? "");
      setQuantity(Number(order.quantity) || 1);
    } else {
      setProductId("");
      setQuantity(1);
    }

    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!order) return;

    if (!isEditable) {
      const message = lockReason || "This order cannot be edited.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!selectedProduct) return;

    setIsPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("id", order.id);
    formData.set("product_id", selectedProduct.id);
    formData.set("quantity", String(quantity));

    try {
      const updatedOrder = await editOrder(formData);
      dispatch(updateOrderInStore(updatedOrder));

      toast.success("Order updated successfully.");
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error("[EditOrderModal.handleSubmit]", err);
      const message =
        err instanceof Error ? err.message : "Failed to update order.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!isPending) onOpenChange(value);
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[var(--navy)]">
            Edit Order
          </DialogTitle>
        </DialogHeader>

        {!order ? (
          <div className="pt-2 text-sm text-[var(--text2)]">No order selected.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Building2 className="w-4 h-4 text-[var(--navy)]" />
                Facility
              </label>
              <div className="flex items-center gap-2 w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg)] min-h-[42px]">
                {isLoadingData ? (
                  <span className="text-sm text-[var(--text3)] animate-pulse">
                    Loading facility...
                  </span>
                ) : facility ? (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-[var(--navy)] font-medium truncate">
                      {facility.name}
                    </span>
                    {[facility.contact, facility.phone].filter(Boolean).length >
                      0 && (
                      <span className="text-xs text-[var(--text3)] truncate">
                        {[facility.contact, facility.phone]
                          .filter(Boolean)
                          .join(" • ")}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-red-500">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    No facility found — contact support
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Package className="w-4 h-4 text-[var(--navy)]" />
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setQuantity(1);
                }}
                required
                disabled={
                  isPending ||
                  isLoadingData ||
                  products.length === 0 ||
                  !isEditable
                }
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/10 focus:border-[var(--navy)] bg-white disabled:opacity-50"
              >
                <option value="">
                  {isLoadingData
                    ? "Loading products..."
                    : products.length === 0
                      ? "No products available"
                      : "Select product"}
                </option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku
                      ? `${product.name} (${product.sku})`
                      : product.name}
                  </option>
                ))}
              </select>

              {selectedProduct && (
                <div className="text-xs text-[var(--text2)] px-1">
                  {[selectedProduct.category, selectedProduct.sku]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                  <Layers className="w-4 h-4 text-[var(--navy)]" />
                  Quantity
                </label>
                <Input
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={isPending || !selectedProduct || !isEditable}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                  <DollarSign className="w-4 h-4 text-[var(--navy)]" />
                  Unit Price
                </label>
                <div className="flex items-center w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg)] min-h-[42px]">
                  <span className="text-sm text-[var(--text2)]">
                    {selectedProduct ? `$${unitPrice.toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <DollarSign className="w-4 h-4 text-[var(--navy)]" />
                Estimated Total
              </label>
              <div className="flex items-center w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg)] min-h-[42px]">
                <span
                  className={`text-sm font-semibold ${
                    totalAmount > 0 ? "text-[#E8821A]" : "text-[var(--text3)]"
                  }`}
                >
                  {totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : "—"}
                </span>

                {selectedProduct && quantity > 1 && (
                  <span className="text-xs text-[var(--text3)] ml-2">
                    ${unitPrice.toFixed(2)} × {quantity}
                  </span>
                )}
              </div>
            </div>

            {order && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                  <Pencil className="w-4 h-4 text-[var(--navy)]" />
                  Editing
                </div>
                <div className="mt-1 text-sm text-[var(--text2)]">
                  {order.order_number}
                </div>
              </div>
            )}

            {!isEditable && lockReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                {lockReason}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <SubmitButton
                type="button"
                variant="outline"
                size="default"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                classname="border-[var(--border)] text-[#374151] hover:bg-[var(--bg)] w-full sm:w-auto cursor-pointer"
                cta={<span>Cancel</span>}
              />

              <SubmitButton
                type="submit"
                isPending={isPending}
                disabled={!isFormValid || isPending}
                cta={
                  <>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Save Changes
                  </>
                }
                isPendingMesssage="Saving..."
                variant="default"
                size="default"
                classname="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white w-full sm:w-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
