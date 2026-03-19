"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Hash,
  Building2,
  Package,
  DollarSign,
  Layers,
} from "lucide-react";
import {
  addOrder,
  getUserFacility,
  getAllProducts,
} from "../(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addOrderToStore } from "../(redux)/orders-slice";
import type { Order } from "@/app/(interfaces)/order";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import SubmitButton from "@/app/(components)/SubmitButton";

export function CreateOrderModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [productId, setProductId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isPending, setIsPending] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when modal closes
  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  // Generate random order ID on open
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(3, "0");
    setOrderId(`ORD-${pad(Math.floor(Math.random() * 999) + 1)}`);
  }, [open]);

  // Fetch facility + products when modal opens
  useEffect(() => {
    if (!open) return;
    async function fetchData() {
      setIsLoadingData(true);
      const [fetchedFacility, fetchedProducts] = await Promise.all([
        getUserFacility(),
        getAllProducts(),
      ]);
      setFacility(fetchedFacility);
      setFacilityId(fetchedFacility?.id ?? "");
      setProducts(fetchedProducts);
      setIsLoadingData(false);
    }
    fetchData();
  }, [open]);

  const selectedProduct = products.find((p) => p.id === productId);

  // ── Computed total: price × quantity ──────────────────────────────────────
  const unitPrice = selectedProduct?.price ?? 0;
  const totalAmount = unitPrice * quantity;

  function resetForm() {
    setFacilityId(facility?.id ?? "");
    setProductId("");
    setQuantity(1);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!facility) return;
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("order_id", orderId);
    formData.set("facility_id", facilityId);
    formData.set("product_id", productId);
    formData.set("amount", String(totalAmount)); // ✅ price × quantity

    const optimistic: Order = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      order_id: orderId,
      facility_id: facilityId,
      product_id: productId,
      amount: totalAmount,
      status: "Processing",
      facility_name: facility?.name ?? "—",
      product_name: selectedProduct?.name ?? "—",
    };

    try {
      await addOrder(formData);
      dispatch(addOrderToStore(optimistic));
      resetForm();
      setOpen(false);
    } catch (err) {
      console.error("[CreateOrderModal]", err);
      setError(err instanceof Error ? err.message : "Failed to create order.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isPending) setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        <SubmitButton
          type="button"
          variant="default"
          size="default"
          classname="bg-[#2db0b0] hover:bg-[#249191] text-white cursor-pointer w-full sm:w-auto"
          cta={
            <>
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </>
          }
        />
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Create New Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Order ID */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Hash className="w-4 h-4 text-[#2db0b0]" />
              Order ID
            </label>
            <Input
              name="order_id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="ORD-001"
              required
            />
          </div>

          {/* Facility — Read Only */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 className="w-4 h-4 text-[#2db0b0]" />
              Facility
            </label>
            <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[38px]">
              {isLoadingData ? (
                <span className="text-sm text-slate-400 animate-pulse">
                  Loading facility...
                </span>
              ) : facility ? (
                <>
                  <span className="text-sm text-slate-700 flex-1 truncate font-medium">
                    {facility.name}
                  </span>
                  {facility.location && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {facility.location as string}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-red-500">
                  ⚠ No facility found — contact support
                </span>
              )}
            </div>
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Package className="w-4 h-4 text-[#2db0b0]" />
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setQuantity(1); // reset quantity on product change
              }}
              required
              disabled={isPending || isLoadingData || products.length === 0}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white disabled:opacity-50"
            >
              <option value="">
                {isLoadingData
                  ? "Loading products..."
                  : products.length === 0
                    ? "No products available"
                    : "Select product"}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity + Unit Price — side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Layers className="w-4 h-4 text-[#2db0b0]" />
                Quantity
              </label>
              <Input
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={isPending || !selectedProduct}
                required
              />
            </div>

            {/* Unit Price — locked */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <DollarSign className="w-4 h-4 text-[#2db0b0]" />
                Unit Price
              </label>
              <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[38px]">
                <span className="text-sm text-slate-500">
                  {selectedProduct ? `$${Number(unitPrice).toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Total Amount — computed, read only */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="w-4 h-4 text-[#2db0b0]" />
              Total Amount
            </label>
            <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[38px]">
              <span
                className={`text-sm font-semibold ${
                  totalAmount > 0 ? "text-[#2db0b0]" : "text-slate-400"
                }`}
              >
                {totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : "—"}
              </span>
              {selectedProduct && quantity > 1 && (
                <span className="text-xs text-slate-400 ml-2">
                  ${Number(unitPrice).toFixed(2)} × {quantity}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <SubmitButton
              type="button"
              variant="outline"
              size="default"
              onClick={() => setOpen(false)}
              isPending={isPending}
              classname="text-slate-600 w-full sm:w-auto cursor-pointer"
              cta={<span>Cancel</span>}
            />
            <SubmitButton
              type="submit"
              isPending={isPending}
              disabled={!facility || isLoadingData || !selectedProduct}
              cta={
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Order
                </>
              }
              isPendingMesssage="Creating..."
              variant="default"
              size="default"
              classname="bg-[#2db0b0] hover:bg-[#249191] text-white w-full sm:w-auto cursor-pointer"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
