"use client";

import { useEffect, useMemo, useState } from "react";
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
  Building2,
  Package,
  DollarSign,
  Layers,
  FileText,
} from "lucide-react";
import {
  createOrder,
  getUserFacility,
  getActiveProducts,
} from "../(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addOrderToStore } from "../(redux)/orders-slice";
import type { FacilityRecord, ProductRecord } from "@/utils/interfaces/orders";
import SubmitButton from "@/app/(components)/SubmitButton";
import toast from "react-hot-toast";

export function CreateOrderModal() {
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState<FacilityRecord | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [isPending, setIsPending] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

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
        console.error("[CreateOrderModal.fetchData]", err);
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

  const isFormValid =
    !!facility && !!selectedProduct && quantity >= 1 && !isLoadingData;

  function resetForm() {
    setProductId("");
    setQuantity(1);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!facility || !selectedProduct) return;

    setIsPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("product_id", selectedProduct.id);
    formData.set("quantity", String(quantity));

    try {
      const createdOrder = await createOrder(formData);
      dispatch(addOrderToStore(createdOrder));

      toast.success("Draft order created successfully.");
      resetForm();
      setOpen(false);
    } catch (err) {
      console.error("[CreateOrderModal.handleSubmit]", err);
      const message =
        err instanceof Error ? err.message : "Failed to create draft order.";
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
        if (!isPending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <SubmitButton
          type="button"
          variant="default"
          size="default"
          classname="bg-[#15689E] hover:bg-[#0f4f7a] text-white cursor-pointer w-full sm:w-auto"
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
            Create Draft Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 className="w-4 h-4 text-[#15689E]" />
              Facility
            </label>
            <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[42px]">
              {isLoadingData ? (
                <span className="text-sm text-slate-400 animate-pulse">
                  Loading facility...
                </span>
              ) : facility ? (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-slate-700 font-medium truncate">
                    {facility.name}
                  </span>
                  {[facility.contact, facility.phone].filter(Boolean).length >
                    0 && (
                    <span className="text-xs text-slate-400 truncate">
                      {[facility.contact, facility.phone]
                        .filter(Boolean)
                        .join(" • ")}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-red-500">
                  ⚠ No facility found — contact support
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Package className="w-4 h-4 text-[#15689E]" />
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setQuantity(1);
              }}
              required
              disabled={isPending || isLoadingData || products.length === 0}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#15689E] bg-white disabled:opacity-50"
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
              <div className="text-xs text-slate-500 px-1">
                {[selectedProduct.category, selectedProduct.sku]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Layers className="w-4 h-4 text-[#15689E]" />
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
                disabled={isPending || !selectedProduct}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <DollarSign className="w-4 h-4 text-[#15689E]" />
                Unit Price
              </label>
              <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[42px]">
                <span className="text-sm text-slate-500">
                  {selectedProduct ? `$${unitPrice.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="w-4 h-4 text-[#15689E]" />
              Estimated Total
            </label>
            <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[42px]">
              <span
                className={`text-sm font-semibold ${
                  totalAmount > 0 ? "text-[#f5a255]" : "text-slate-400"
                }`}
              >
                {totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : "—"}
              </span>

              {selectedProduct && quantity > 1 && (
                <span className="text-xs text-slate-400 ml-2">
                  ${unitPrice.toFixed(2)} × {quantity}
                </span>
              )}
            </div>
          </div>

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
              onClick={() => setOpen(false)}
              disabled={isPending}
              classname="text-slate-600 w-full sm:w-auto cursor-pointer"
              cta={<span>Cancel</span>}
            />

            <SubmitButton
              type="submit"
              isPending={isPending}
              disabled={!isFormValid || isPending}
              cta={
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Save Draft
                </>
              }
              isPendingMesssage="Saving..."
              variant="default"
              size="default"
              classname="bg-[#15689E] hover:bg-[#0f4f7a] text-white w-full sm:w-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
