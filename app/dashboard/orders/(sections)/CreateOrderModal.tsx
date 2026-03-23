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
  AlertTriangle,
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
import toast from "react-hot-toast";

type CreateOrderModalProps = {
  disabled?: boolean;
  disabledReason?: string | null;
};

export function CreateOrderModal({
  disabled = false,
  disabledReason = null,
}: CreateOrderModalProps) {
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

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const pad = (n: number) => String(n).padStart(3, "0");
    setOrderId(`ORD-${pad(Math.floor(Math.random() * 999) + 1)}`);
  }, [open]);

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
  const unitPrice = Number(selectedProduct?.price ?? 0);
  const totalAmount = unitPrice * quantity;

  const isFormValid =
    orderId.trim() !== "" &&
    !!facility &&
    !isLoadingData &&
    !!selectedProduct &&
    !disabled;

  function resetForm() {
    setFacilityId(facility?.id ?? "");
    setProductId("");
    setQuantity(1);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (disabled) {
      const message =
        disabledReason ??
        "Ordering is currently disabled for this account.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!facility) return;

    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("order_id", orderId);
    formData.set("facility_id", facilityId);
    formData.set("product_id", productId);
    formData.set("amount", String(totalAmount));

    const optimistic: Order = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      order_id: orderId,
      facility_id: facilityId,
      product_id: productId,
      amount: totalAmount,
      quantity,
      status: "Processing",
      facility_name: facility?.name ?? "—",
      product_name: selectedProduct?.name ?? "—",
      payment_status: "pending",
    };

    try {
      await addOrder(formData);
      dispatch(addOrderToStore(optimistic));
      toast.success("Order created successfully!");
      resetForm();
      setOpen(false);
    } catch (err) {
      console.error("[CreateOrderModal]", err);
      const message =
        err instanceof Error ? err.message : "Failed to create order.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (disabled) {
          setOpen(false);
          return;
        }

        if (!isPending) setOpen(val);
      }}
    >
      <div className="space-y-2">
        <DialogTrigger asChild>
          <div>
            <SubmitButton
              type="button"
              variant="default"
              size="default"
              disabled={disabled}
              classname="bg-[#15689E] hover:bg-[#0f4f7a] text-white cursor-pointer w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300"
              cta={
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </>
              }
            />
          </div>
        </DialogTrigger>

        {disabledReason ? (
          <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{disabledReason}</span>
            </div>
          </div>
        ) : null}
      </div>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Create New Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Hash className="h-4 w-4 text-[#15689E]" />
              Order ID
            </label>
            <Input
              name="order_id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="ORD-001"
              required
              disabled={isPending || disabled}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 className="h-4 w-4 text-[#15689E]" />
              Facility
            </label>
            <div className="flex min-h-[38px] w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {isLoadingData ? (
                <span className="animate-pulse text-sm text-slate-400">
                  Loading facility...
                </span>
              ) : facility ? (
                <>
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">
                    {facility.name}
                  </span>
                  {facility.location && (
                    <span className="shrink-0 text-xs text-slate-400">
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

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Package className="h-4 w-4 text-[#15689E]" />
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setQuantity(1);
              }}
              required
              disabled={isPending || isLoadingData || products.length === 0 || disabled}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#15689E] disabled:opacity-50"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Layers className="h-4 w-4 text-[#15689E]" />
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
                disabled={isPending || !selectedProduct || disabled}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <DollarSign className="h-4 w-4 text-[#15689E]" />
                Unit Price
              </label>
              <div className="flex min-h-[38px] w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-500">
                  {selectedProduct ? `$${Number(unitPrice).toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="h-4 w-4 text-[#15689E]" />
              Total Amount
            </label>
            <div className="flex min-h-[38px] w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span
                className={`text-sm font-semibold ${totalAmount > 0 ? "text-[#f5a255]" : "text-slate-400"
                  }`}
              >
                {totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : "—"}
              </span>
              {selectedProduct && quantity > 1 && (
                <span className="ml-2 text-xs text-slate-400">
                  ${Number(unitPrice).toFixed(2)} × {quantity}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
              disabled={!isFormValid || isPending || disabled}
              cta={
                <>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Order
                </>
              }
              isPendingMesssage="Creating..."
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
