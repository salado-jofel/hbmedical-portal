"use client";

import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { approveOrder } from "../(services)/order-workflow-actions";
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
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveOrder(order.id);
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

          <p className="text-sm text-slate-600">
            Approve this order? The clinic will be notified and you can set the
            payment method after approval.
          </p>

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
