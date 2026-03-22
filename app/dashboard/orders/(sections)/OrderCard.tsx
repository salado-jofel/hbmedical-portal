"use client";

import { useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { removeOrderFromStore } from "../(redux)/orders-slice";
import {
  deleteOrder,
  createStripeCheckoutSession,
} from "../(services)/actions";
import type { Order } from "@/app/(interfaces)/order";
import {
  Trash2,
  Package,
  Building2,
  User,
  Loader2,
  CreditCard,
  CheckCircle2,
  Boxes,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import { getFulfillmentLabel } from "./kanban-config";
import toast from "react-hot-toast";

export function OrderCard({ order }: { order: Order }) {
  const dispatch = useAppDispatch();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPaid = order.payment_status === "paid";
  const isPaymentPending = order.payment_status === "pending";
  const fulfillmentLabel = getFulfillmentLabel(order);

  const quantity = Number(order.quantity ?? 1);
  const totalAmount = Number(order.amount ?? 0);
  const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

  async function handleDelete() {
    if (!order.id) return;

    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      dispatch(removeOrderFromStore(order.id));
      toast.success(`Order ${order.order_id} deleted successfully.`);
    } catch (err) {
      console.error("[handleDelete]", err);
      toast.error("Failed to delete order. Please try again.");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function handlePayNow() {
    if (!order.id || isPaying || isPaid) return;

    setIsPaying(true);
    try {
      const checkoutUrl = await createStripeCheckoutSession(order.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("[handlePayNow]", err);
      toast.error("Failed to start payment. Please try again.");
      setIsPaying(false);
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Order?"
        description={`Order ${order.order_id} will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#15689E] tracking-wide">
            {order.order_id}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={isDeleting}
            className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <OrderInfoRow
          icon={Package}
          text={`Product: ${order.product_name ?? "—"}`}
          primary
        />

        <OrderInfoRow
          icon={Building2}
          text={`Facility: ${order.facility_name ?? "—"}`}
        />

        {order.created_by_email && (
          <OrderInfoRow icon={User} text={order.created_by_email} />
        )}

        <OrderInfoRow icon={Boxes} text={`Qty: ${quantity}`} />
        <OrderInfoRow
          icon={DollarSign}
          text={`Unit Price: $${unitPrice.toFixed(2)}`}
        />

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">
                ${totalAmount.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">
                Total ({quantity} × ${unitPrice.toFixed(2)})
              </span>
            </div>

            {isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Paid
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handlePayNow}
                disabled={isPaying}
                className="h-8 bg-[#15689E] hover:bg-[#0f4f7a] text-white text-xs cursor-pointer"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 mr-1" />
                    {isPaymentPending ? "Resume Payment" : "Pay Now"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Payment:{" "}
            <span className="font-medium text-slate-700">
              {order.payment_status ?? "unpaid"}
            </span>
          </span>

          <span className="text-xs font-medium text-slate-500">
            {fulfillmentLabel}
          </span>
        </div>
      </div>
    </>
  );
}
