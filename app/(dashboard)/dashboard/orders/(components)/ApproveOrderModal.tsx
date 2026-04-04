"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, CreditCard, Clock } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { approveOrder } from "../(services)/actions";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface ApproveOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder;
  onSuccess?: () => void;
}

export function ApproveOrderModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: ApproveOrderModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"pay_now" | "net_30">("pay_now");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveOrder(order.id, paymentMethod);
      if (result.success) {
        toast.success("Order approved.");
        handleClose();
        onSuccess?.();
      } else {
        toast.error(result.error ?? "Failed to approve order.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-500" />

        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Approve Order
            </DialogTitle>
          </DialogHeader>

          {/* Order summary */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Order</span>
              <span className="font-semibold text-slate-800">{order.order_number}</span>
            </div>
            {order.patient_full_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">{order.patient_full_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Facility</span>
              <span className="font-semibold text-slate-800">{order.facility_name}</span>
            </div>
          </div>

          {/* Payment method selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Select Payment Method</p>

            <button
              type="button"
              onClick={() => setPaymentMethod("pay_now")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                paymentMethod === "pay_now"
                  ? "border-green-500 bg-green-50"
                  : "border-slate-200 hover:border-slate-300 bg-white",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  paymentMethod === "pay_now" ? "bg-green-100" : "bg-slate-100",
                )}
              >
                <CreditCard
                  className={cn(
                    "w-4 h-4",
                    paymentMethod === "pay_now" ? "text-green-600" : "text-slate-400",
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    paymentMethod === "pay_now" ? "text-green-700" : "text-slate-700",
                  )}
                >
                  Pay Now
                </p>
                <p className="text-xs text-slate-500">Immediate payment required</p>
              </div>
              {paymentMethod === "pay_now" && (
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("net_30")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                paymentMethod === "net_30"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  paymentMethod === "net_30" ? "bg-blue-100" : "bg-slate-100",
                )}
              >
                <Clock
                  className={cn(
                    "w-4 h-4",
                    paymentMethod === "net_30" ? "text-blue-600" : "text-slate-400",
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    paymentMethod === "net_30" ? "text-blue-700" : "text-slate-700",
                  )}
                >
                  Net 30
                </p>
                <p className="text-xs text-slate-500">Invoice issued, payment due in 30 days</p>
              </div>
              {paymentMethod === "net_30" && (
                <CheckCircle className="w-4 h-4 text-blue-500 ml-auto shrink-0" />
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-slate-200"
              disabled={isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white"
              disabled={isPending}
              onClick={handleApprove}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
