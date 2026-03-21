"use client";

import { useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  updateOrderInStore,
  removeOrderFromStore,
} from "../(redux)/orders-slice";
import {
  updateOrderStatus,
  deleteOrder,
  createStripeCheckoutSession,
} from "../(services)/actions";
import type { Order } from "@/app/(interfaces)/order";
import {
  Trash2,
  Package,
  Building2,
  User,
  ChevronRight,
  Loader2,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import { STATUS_CONFIG, type BoardStatus } from "./kanban-config";
import toast from "react-hot-toast";

export function OrderCard({ order }: { order: Order }) {
  const dispatch = useAppDispatch();
  const config = STATUS_CONFIG[order.status as BoardStatus];
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPaid = order.payment_status === "paid";
  const isPaymentPending = order.payment_status === "pending";

  async function handleAdvance() {
    if (!order.id || !config?.next || isAdvancing) return;

    setIsAdvancing(true);
    try {
      const formData = new FormData();
      formData.set("status", config.next);
      await updateOrderStatus(order.id, formData);
      dispatch(updateOrderInStore({ ...order, status: config.next }));
      toast.success(`Order moved to "${config.next}".`);
    } catch (err) {
      console.error("[handleAdvance]", err);
      toast.error("Failed to advance order. Please try again.");
    } finally {
      setIsAdvancing(false);
    }
  }

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

        <OrderInfoRow icon={Package} text={order.product_name ?? "—"} primary />
        <OrderInfoRow icon={Building2} text={order.facility_name ?? "—"} />

        {order.created_by_email && (
          <OrderInfoRow icon={User} text={order.created_by_email} />
        )}

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-slate-800">
              ${Number(order.amount).toFixed(2)}
            </span>

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

          {config?.next && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAdvance}
              disabled={isAdvancing}
              className="h-7 px-2 text-xs text-[#15689E] hover:text-[#0f4f7a] hover:bg-[#15689E]/10 font-medium cursor-pointer"
            >
              {isAdvancing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Moving...
                </>
              ) : (
                <>
                  {config.next}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
