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
  CreditCard,
  CalendarClock,
} from "lucide-react";
import {
  addOrder,
  getUserFacility,
  getAllProducts,
} from "../(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addOrderToStore } from "../(redux)/orders-slice";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Product } from "@/app/(interfaces)/product";
import type { PaymentMode } from "@/app/(interfaces)/payment";
import SubmitButton from "@/app/(components)/SubmitButton";
import toast from "react-hot-toast";

export function CreateOrderModal() {
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [productId, setProductId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("pay_now");
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

    const pad = (n: number) => String(n).padStart(3, "0");
    setOrderId(`ORD-${pad(Math.floor(Math.random() * 999) + 1)}`);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setIsLoadingData(true);

      try {
        const [fetchedFacility, fetchedProducts] = await Promise.all([
          getUserFacility(),
          getAllProducts(),
        ]);

        setFacility(fetchedFacility);
        setFacilityId(fetchedFacility?.id ?? "");
        setProducts(fetchedProducts);
      } finally {
        setIsLoadingData(false);
      }
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
    quantity >= 1 &&
    !!paymentMode;

  function resetForm() {
    setFacilityId(facility?.id ?? "");
    setProductId("");
    setQuantity(1);
    setPaymentMode("pay_now");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!facility || !selectedProduct) return;

    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("order_id", orderId);
    formData.set("facility_id", facilityId);
    formData.set("product_id", productId);
    formData.set("quantity", String(quantity));
    formData.set("amount", String(totalAmount));
    formData.set("payment_mode", paymentMode);

    try {
      const createdOrder = await addOrder(formData);
      dispatch(addOrderToStore(createdOrder));

      toast.success(
        paymentMode === "net_30"
          ? "Order created with Net 30 billing."
          : "Order created successfully!",
      );

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
            Create New Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Hash className="w-4 h-4 text-[#15689E]" />
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

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 className="w-4 h-4 text-[#15689E]" />
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
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              {paymentMode === "pay_now" ? (
                <CreditCard className="w-4 h-4 text-[#15689E]" />
              ) : (
                <CalendarClock className="w-4 h-4 text-[#15689E]" />
              )}
              Billing Terms
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode("pay_now")}
                disabled={isPending}
                className={`rounded-xl border px-3 py-3 text-left transition ${paymentMode === "pay_now"
                  ? "border-[#15689E] bg-[#15689E]/5 ring-1 ring-[#15689E]/20"
                  : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CreditCard className="w-4 h-4 text-[#15689E]" />
                  Pay Now
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Customer pays by card through Stripe checkout.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode("net_30")}
                disabled={isPending}
                className={`rounded-xl border px-3 py-3 text-left transition ${paymentMode === "net_30"
                  ? "border-[#15689E] bg-[#15689E]/5 ring-1 ring-[#15689E]/20"
                  : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarClock className="w-4 h-4 text-[#15689E]" />
                  Pay Later (Net 30)
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Marks the order for invoice-based billing terms.
                </p>
              </button>
            </div>

            <input type="hidden" name="payment_mode" value={paymentMode} />
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
              <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[38px]">
                <span className="text-sm text-slate-500">
                  {selectedProduct ? `$${unitPrice.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="w-4 h-4 text-[#15689E]" />
              Total Amount
            </label>
            <div className="flex items-center w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 min-h-[38px]">
              <span
                className={`text-sm font-semibold ${totalAmount > 0 ? "text-[#f5a255]" : "text-slate-400"
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
